import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, shippingMethods } from "@db/schema";
import { carrierLabel } from "@contracts/constants";
import {
  type SendcloudService,
  hasWeightRange,
  offerServiceHints,
  pickSendcloudService,
  ratesFromQuotes,
  sortServices,
} from "@contracts/shipping-rates";
import { gramsToKg, parcelWeightGrams } from "./lib/weight";
import {
  announceShipment,
  demoPriceFor,
  fetchLabelPdf,
  getAccount,
  getParcel,
  getSendcloudCredentials,
  listShippingOptions,
  parcelFailure,
  quoteShippingOption,
  resolveSenderAddressId,
  searchServicePoints,
} from "./lib/sendcloud";

/** Option Sendcloud retenue pour une offre du CRM. */
function serviceForOffer(
  services: SendcloudService[],
  offer: typeof shippingMethods.$inferSelect,
): SendcloudService | null {
  return pickSendcloudService(services, {
    carrier: offer.carrier,
    servicePoint: Boolean(offer.requiresServicePoint),
    hints: offerServiceHints(offer),
  });
}

/** "Colissimo (La Poste)" + point relais -> "Colissimo Point Relais". */
function defaultOfferName(service: SendcloudService): string {
  const carrier = carrierLabel(service.carrier).replace(/\s*\(.*\)$/, "");
  return `${carrier} ${service.requiresServicePoint ? "Point Relais" : "Domicile"}`;
}

/** Sendcloud borne ses poids a 30.001 kg : on affiche 30 kg. */
function roundKg(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

/** Poids de reference pour relever les tarifs Sendcloud d'une option. */
const QUOTE_WEIGHTS_KG = [0.25, 0.5, 1, 2, 5, 10, 20, 30];

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

  /** Options Sendcloud disponibles, et celle que chaque offre utilisera. */
  services: adminQuery.query(async () => {
    const db = getDb();
    const { source, error, services } = await listShippingOptions();
    const offers = await db.select().from(shippingMethods);
    return {
      source,
      error: error ?? null,
      // Triees : pour un transporteur et un mode, la premiere est le choix automatique.
      services: sortServices(services).map((s) => ({
        code: s.code,
        name: s.name,
        carrier: s.carrier,
        requiresServicePoint: s.requiresServicePoint,
        maxWeight: roundKg(s.maxWeight),
      })),
      links: offers.map((offer) => ({
        methodId: offer.id,
        service: serviceForOffer(services, offer)?.name ?? null,
      })),
    };
  }),

  /** Releve les tarifs Sendcloud d'une option a plusieurs poids, pour pre-remplir une grille. */
  quoteRates: adminQuery
    .input(z.object({ code: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const prices = await Promise.all(
        QUOTE_WEIGHTS_KG.map(async (upToKg) => ({
          upToKg,
          price: await quoteShippingOption(input.code, upToKg),
        })),
      );
      const rates = ratesFromQuotes(prices);
      return {
        rates,
        message:
          rates.length > 0
            ? null
            : "Sendcloud ne communique pas de tarif pour cette option (contrat transporteur propre, par exemple).",
      };
    }),

  /**
   * Relie les offres du CRM aux options Sendcloud.
   *
   * L'ancienne synchronisation (API v2) importait une methode par tranche de
   * poids, autant de choix au checkout, sans prix. Ces lignes sont
   * supprimees : le prix client vient de la grille de chaque offre, et
   * Sendcloud applique lui-meme le tarif du poids declare sur l'etiquette.
   */
  syncMethods: adminQuery.mutation(async () => {
    const db = getDb();
    const creds = await getSendcloudCredentials();
    const { source, error, services } = await listShippingOptions();
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
    // relais), avec l'option la plus standard.
    let created = 0;
    if (offers.length === 0) {
      const seen = new Set<string>();
      for (const service of sortServices(services)) {
        const key = `${service.carrier}|${service.requiresServicePoint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        created += 1;
        await db.insert(shippingMethods).values({
          name: defaultOfferName(service),
          carrier: service.carrier,
          price: String(demoPriceFor(service.carrier)),
          requiresServicePoint: service.requiresServicePoint,
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
      await db
        .update(shippingMethods)
        .set({ minWeight: null, maxWeight: service.maxWeight !== null ? String(service.maxWeight) : null })
        .where(eq(shippingMethods.id, offer.id));
    }

    const parts = [
      legacy.length > 0 ? `${legacy.length} tranche(s) de poids regroupee(s)` : null,
      created > 0 ? `${created} offre(s) creee(s)` : null,
      `${offers.length - unlinked.length} offre(s) reliee(s) a Sendcloud`,
      unlinked.length > 0 ? `Aucune option Sendcloud pour : ${unlinked.join(", ")}` : null,
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
      if (!order) return parcelFailure("Commande introuvable.");

      if (!creds.configured) {
        return parcelFailure(
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
      if (!carrier) return parcelFailure("Aucun transporteur sur cette commande.");

      // Poids reel : somme des poids figes sur les lignes + emballage.
      // On ne retombe sur le poids par defaut que si l'entree l'impose.
      const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const computedGrams = await parcelWeightGrams(lines);
      const weightKg = input.weight ?? gramsToKg(computedGrams);

      // Options valables pour CE colis : destination, point relais et poids.
      const { source, error, services } = await listShippingOptions({
        toPostalCode: order.postalCode,
        toCity: order.city,
        servicePointId: order.servicePointId,
        weightKg,
      });
      if (source !== "sendcloud") {
        return parcelFailure(`Impossible de lire les options Sendcloud${error ? ` : ${error}` : ""}.`);
      }

      // Le mode suit la commande : un point relais choisi = option point relais.
      const servicePoint = Boolean(order.servicePointId);
      const service = pickSendcloudService(services, {
        carrier,
        servicePoint,
        hints: [...(offer ? offerServiceHints(offer) : []), order.shippingMethodName],
      });
      if (!service) {
        return parcelFailure(
          `Aucune option ${carrierLabel(carrier)} ${
            servicePoint ? "en point relais" : "a domicile"
          } n'est disponible sur votre compte Sendcloud pour ce colis (${weightKg.toFixed(2)} kg${
            servicePoint ? ", ce point relais" : ""
          }). Verifiez les transporteurs actives dans Sendcloud, puis reessayez.`,
        );
      }

      const sender = await resolveSenderAddressId();
      if (!sender.id) {
        return parcelFailure(
          `Aucune adresse d'expedition trouvee sur votre compte Sendcloud${
            sender.error ? ` (${sender.error})` : ""
          }. Ajoutez-en une dans Sendcloud ou renseignez son ID dans Parametres.`,
        );
      }

      const result = await announceShipment({
        name: [order.firstName, order.lastName].filter(Boolean).join(" ") || order.email,
        address: order.address || "",
        city: order.city || "",
        postalCode: order.postalCode || "",
        country: order.country || "France",
        email: order.email,
        telephone: order.phone || "",
        orderNumber: order.orderNumber,
        weight: weightKg,
        shippingOptionCode: service.code,
        servicePointId: order.servicePointId,
        senderAddressId: sender.id,
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
        return { ...result, message: `${result.message} · ${service.name} · ${weightKg.toFixed(2)} kg` };
      }

      return result;
    }),

  /** PDF de l'etiquette d'une commande : les liens Sendcloud exigent les cles API. */
  labelPdf: adminQuery
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order?.labelUrl) {
        return { ok: false as const, message: "Aucune etiquette pour cette commande.", base64: null, filename: null };
      }
      const pdf = await fetchLabelPdf(order.labelUrl);
      if (!pdf.ok) return { ok: false as const, message: pdf.error, base64: null, filename: null };
      return { ok: true as const, message: null, base64: pdf.base64, filename: `etiquette-${order.orderNumber}.pdf` };
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
