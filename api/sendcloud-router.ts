import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, shippingMethods } from "@db/schema";
import { carrierLabel } from "@contracts/constants";
import {
  type SendcloudService,
  groupSendcloudServices,
  hasWeightRange,
  offerServiceHints,
  pickBracket,
  pickSendcloudService,
  ratesFromService,
  serviceMaxWeight,
  writeMethodConfig,
} from "@contracts/shipping-rates";
import { gramsToKg, parcelWeightGrams } from "./lib/weight";
import {
  type ParcelResult,
  createParcel,
  demoPriceFor,
  filterFrenchCarrierMethods,
  getAccount,
  getParcel,
  getSendcloudCredentials,
  listShippingMethods,
  searchServicePoints,
} from "./lib/sendcloud";

/** Services Sendcloud du compte (ou de demonstration), regroupes par produit. */
async function loadServices() {
  const { source, methods, error } = await listShippingMethods();
  return { source, error, services: groupSendcloudServices(filterFrenchCarrierMethods(methods)) };
}

/** Service Sendcloud retenu pour une offre du CRM. */
function serviceForOffer(
  services: SendcloudService[],
  offer: typeof shippingMethods.$inferSelect,
): SendcloudService | null {
  return pickSendcloudService(services, {
    carrier: offer.carrier,
    servicePoint: Boolean(offer.requiresServicePoint),
    hints: offerServiceHints(services, offer),
  });
}

/** "Colissimo (La Poste)" + point relais -> "Colissimo Point Relais". */
function defaultOfferName(service: SendcloudService): string {
  const carrier = carrierLabel(service.carrier).replace(/\s*\(.*\)$/, "");
  return `${carrier} ${service.requiresServicePoint ? "Point Relais" : "Domicile"}`;
}

/** Sendcloud borne ses tranches a 30.001 kg : on affiche 30 kg. */
function roundKg(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function labelError(message: string): ParcelResult {
  return {
    ok: false,
    message,
    parcelId: null,
    trackingNumber: null,
    trackingUrl: null,
    labelUrl: null,
  };
}

/**
 * Routeur Sendcloud : configuration, synchronisation des methodes,
 * recherche de points relais (Mondial Relay) et generation d'etiquettes.
 */
export const sendcloudRouter = createRouter({
  status: adminQuery.query(async () => {
    const creds = await getSendcloudCredentials();
    return {
      configured: creds.configured,
      mode: creds.configured ? ("live" as const) : ("demo" as const),
      publicKeySet: creds.publicKey !== "",
      secretKeySet: creds.secretKey !== "",
      senderAddressId: creds.senderAddressId || null,
    };
  }),

  testConnection: adminQuery.mutation(async () => {
    const creds = await getSendcloudCredentials();
    if (!creds.configured) {
      return {
        ok: false,
        message: "Cles API manquantes : mode demo actif.",
      };
    }
    const account = await getAccount();
    if (!account.ok) {
      return { ok: false, message: account.error || "Connexion refusee par Sendcloud." };
    }
    return {
      ok: true,
      message: `Connecte a Sendcloud${account.username ? ` (${account.username})` : ""}.`,
    };
  }),

  listCarrierMethods: adminQuery.query(async () => {
    const { source, methods } = await listShippingMethods();
    return { source, methods: filterFrenchCarrierMethods(methods) };
  }),

  /** Services Sendcloud disponibles, et celui que chaque offre utilisera. */
  services: adminQuery.query(async () => {
    const db = getDb();
    const { source, error, services } = await loadServices();
    const offers = await db.select().from(shippingMethods);
    return {
      source,
      error: error ?? null,
      services: services.map((s) => ({
        name: s.name,
        carrier: s.carrier,
        requiresServicePoint: s.requiresServicePoint,
        maxWeight: roundKg(serviceMaxWeight(s)),
        brackets: s.brackets.length,
        suggestedRates: ratesFromService(s),
      })),
      links: offers.map((offer) => ({
        methodId: offer.id,
        service: serviceForOffer(services, offer)?.name ?? null,
      })),
    };
  }),

  /**
   * Relie les offres du CRM aux services Sendcloud.
   *
   * Sendcloud expose une methode par tranche de poids ; l'ancienne
   * synchronisation en faisait autant de choix au checkout, sans prix. Ces
   * lignes sont supprimees : la tranche est desormais choisie a la creation
   * de l'etiquette, d'apres le poids reel du colis, et le prix client vient
   * de la grille de chaque offre.
   */
  syncMethods: adminQuery.mutation(async () => {
    const db = getDb();
    const creds = await getSendcloudCredentials();
    const { source, error, services } = await loadServices();
    if (creds.configured && source !== "sendcloud") {
      return {
        removed: 0,
        created: 0,
        unlinked: [] as string[],
        source,
        message: `Sendcloud injoignable, rien n'a ete modifie${error ? ` (${error})` : ""}.`,
      };
    }

    const rows = await db.select().from(shippingMethods).orderBy(shippingMethods.sortOrder);
    const legacy = rows.filter((r) => r.sendcloudMethodId !== null && hasWeightRange(r.name));
    if (legacy.length > 0) {
      await db.delete(shippingMethods).where(inArray(shippingMethods.id, legacy.map((r) => r.id)));
    }
    let offers = rows.filter((r) => !legacy.includes(r));

    // Aucune offre : une par transporteur et par mode (domicile / point
    // relais), avec le service le plus standard.
    let created = 0;
    if (offers.length === 0) {
      const seen = new Set<string>();
      for (const service of services) {
        const key = `${service.carrier}|${service.requiresServicePoint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rates = ratesFromService(service);
        created += 1;
        await db.insert(shippingMethods).values({
          name: defaultOfferName(service),
          carrier: service.carrier,
          price: String(rates[0]?.price ?? demoPriceFor(service.carrier)),
          requiresServicePoint: service.requiresServicePoint,
          config: writeMethodConfig(null, { rates }),
          countries: ["FR"],
          sortOrder: created,
          isActive: true,
        });
      }
      offers = await db.select().from(shippingMethods);
    }

    // Poids maximal du transporteur : au-dela, le checkout masque l'offre.
    const unlinked: string[] = [];
    for (const offer of offers) {
      const service = serviceForOffer(services, offer);
      if (!service) {
        unlinked.push(offer.name);
        continue;
      }
      const maxWeight = serviceMaxWeight(service);
      await db
        .update(shippingMethods)
        .set({ minWeight: null, maxWeight: maxWeight !== null ? String(maxWeight) : null })
        .where(eq(shippingMethods.id, offer.id));
    }

    const parts = [
      legacy.length > 0 ? `${legacy.length} tranche(s) de poids regroupee(s)` : null,
      created > 0 ? `${created} offre(s) creee(s)` : null,
      `${offers.length - unlinked.length} offre(s) reliee(s) a Sendcloud`,
      unlinked.length > 0 ? `Aucun service Sendcloud pour : ${unlinked.join(", ")}` : null,
    ].filter(Boolean);
    const message = `${source === "demo" ? "Mode demo : " : ""}${parts.join(". ")}.`;

    return { removed: legacy.length, created, unlinked, source, message };
  }),

  /** Recherche de points relais, appelee depuis le tunnel de commande. */
  servicePoints: publicQuery
    .input(
      z.object({
        postalCode: z.string().min(1),
        city: z.string().optional(),
        country: z.string().optional(),
        carrier: z.string().min(1),
        radius: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { source, points } = await searchServicePoints(input);
      return { source, points };
    }),

  createLabel: adminQuery
    .input(
      z.object({
        orderId: z.number(),
        shippingMethodId: z.number().optional(),
        weight: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const creds = await getSendcloudCredentials();

      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) return labelError("Commande introuvable.");

      if (!creds.configured) {
        return labelError(
          "Sendcloud n'est pas configure. Renseignez vos cles API dans Parametres.",
        );
      }

      // Offre choisie au checkout (ou imposee en entree). Elle a pu etre
      // supprimee depuis : la commande garde son transporteur et son nom.
      const offerId = input.shippingMethodId ?? order.shippingMethodId ?? null;
      const [offer] = offerId
        ? await db.select().from(shippingMethods).where(eq(shippingMethods.id, offerId))
        : [];
      const carrier = offer?.carrier ?? order.shippingCarrier;
      if (!carrier) return labelError("Aucun transporteur sur cette commande.");

      const { source, error, services } = await loadServices();
      if (source !== "sendcloud") {
        return labelError(`Sendcloud injoignable${error ? ` : ${error}` : ""}.`);
      }

      // Le mode suit la commande : un point relais choisi = service point relais.
      const servicePoint = Boolean(order.servicePointId);
      const service = pickSendcloudService(services, {
        carrier,
        servicePoint,
        hints: [...(offer ? offerServiceHints(services, offer) : []), order.shippingMethodName],
      });
      if (!service) {
        return labelError(
          `Aucun service ${carrierLabel(carrier)} ${
            servicePoint ? "en point relais" : "a domicile"
          } n'est active sur votre compte Sendcloud. Activez-le dans Sendcloud, puis reessayez.`,
        );
      }

      // Poids reel : somme des poids figes sur les lignes + emballage.
      // On ne retombe sur le poids par defaut que si l'entree l'impose.
      const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const computedGrams = await parcelWeightGrams(lines);
      const weightKg = input.weight ?? gramsToKg(computedGrams);

      // Sendcloud facture par tranche de poids : on prend celle du colis.
      const bracket = pickBracket(service, weightKg);
      if (!bracket) {
        return labelError(`${service.name} n'accepte pas un colis de ${weightKg.toFixed(2)} kg.`);
      }

      const result = await createParcel({
        name: [order.firstName, order.lastName].filter(Boolean).join(" ") || order.email,
        address: order.address || "",
        city: order.city || "",
        postalCode: order.postalCode || "",
        country: order.country || "France",
        email: order.email,
        telephone: order.phone || "",
        orderNumber: order.orderNumber,
        weight: weightKg,
        shippingMethodId: bracket.id,
        servicePointId: order.servicePointId,
      });

      if (result.ok) {
        await db
          .update(orders)
          .set({
            sendcloudParcelId: result.parcelId,
            trackingNumber: result.trackingNumber,
            trackingUrl: result.trackingUrl,
            labelUrl: result.labelUrl,
            status: "shipped",
          })
          .where(eq(orders.id, order.id));
        return { ...result, message: `${result.message} · ${bracket.name} · ${weightKg.toFixed(2)} kg` };
      }

      return result;
    }),

  tracking: publicQuery
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId));
      // Meme regle que order.getById : le client de la commande ou le CRM.
      // Les numeros se suivent, sans cette verification n'importe qui lisait
      // le suivi de toutes les commandes.
      const isOwner = order?.userId != null && order.userId === ctx.user?.id;
      if (!order || (ctx.user?.role !== "admin" && !isOwner)) return null;

      let trackingNumber = order.trackingNumber;
      let trackingUrl = order.trackingUrl;
      let status: string | null = order.status ?? null;

      // Rafraichit depuis Sendcloud quand un colis existe deja.
      if (order.sendcloudParcelId) {
        const creds = await getSendcloudCredentials();
        if (creds.configured) {
          const parcel = await getParcel(order.sendcloudParcelId);
          if (parcel.ok) {
            trackingNumber = parcel.trackingNumber ?? trackingNumber;
            trackingUrl = parcel.trackingUrl ?? trackingUrl;
            status = parcel.status ?? status;
            if (
              parcel.trackingNumber !== order.trackingNumber ||
              parcel.trackingUrl !== order.trackingUrl
            ) {
              await db
                .update(orders)
                .set({ trackingNumber, trackingUrl })
                .where(eq(orders.id, order.id));
            }
          }
        }
      }

      return {
        trackingNumber,
        trackingUrl,
        carrier: order.shippingCarrier ? carrierLabel(order.shippingCarrier) : null,
        status,
      };
    }),
});
