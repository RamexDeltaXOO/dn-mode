import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, shippingMethods } from "@db/schema";
import { carrierLabel } from "@contracts/constants";
import {
  createParcel,
  demoPriceFor,
  filterFrenchCarrierMethods,
  getAccount,
  getParcel,
  getSendcloudCredentials,
  listShippingMethods,
  searchServicePoints,
} from "./lib/sendcloud";

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
        message: "Cles API manquantes — mode demo actif.",
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

  /** Importe les methodes Sendcloud dans la table `shipping_methods`. */
  syncMethods: adminQuery.mutation(async () => {
    const db = getDb();
    const { source, methods, error } = await listShippingMethods();
    const eligible = filterFrenchCarrierMethods(methods);

    let imported = 0;
    let updated = 0;
    let sortOrder = 0;

    for (const method of eligible) {
      sortOrder += 1;
      const values = {
        name: method.name,
        carrier: method.carrier,
        price: String(method.price ?? demoPriceFor(method.carrier)),
        requiresServicePoint: method.requiresServicePoint,
        minWeight: method.minWeight !== null ? String(method.minWeight) : null,
        maxWeight: method.maxWeight !== null ? String(method.maxWeight) : null,
        countries: method.countries.length > 0 ? method.countries : ["FR"],
        sendcloudMethodId: method.id,
      };

      const [existing] = await db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.sendcloudMethodId, method.id));

      if (existing) {
        await db.update(shippingMethods).set(values).where(eq(shippingMethods.id, existing.id));
        updated += 1;
      } else {
        await db.insert(shippingMethods).values({ ...values, sortOrder, isActive: true });
        imported += 1;
      }
    }

    const message =
      source === "demo"
        ? `Mode demo : ${imported + updated} methode(s) de demonstration importee(s).${
            error ? ` (${error})` : ""
          }`
        : `${imported} methode(s) importee(s), ${updated} mise(s) a jour.`;

    return { imported, updated, source, message };
  }),

  /** Recherche de points relais — appele depuis le tunnel de commande. */
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
      if (!order) {
        return {
          ok: false,
          message: "Commande introuvable.",
          parcelId: null,
          trackingNumber: null,
          trackingUrl: null,
          labelUrl: null,
        };
      }

      if (!creds.configured) {
        return {
          ok: false,
          message:
            "Sendcloud n'est pas configure — renseignez vos cles API dans Parametres.",
          parcelId: null,
          trackingNumber: null,
          trackingUrl: null,
          labelUrl: null,
        };
      }

      // Methode d'expedition : celle passee en entree, sinon celle de la
      // commande, sinon la premiere methode active du transporteur.
      let methodRowId = input.shippingMethodId ?? order.shippingMethodId ?? null;
      if (!methodRowId && order.shippingCarrier) {
        const [fallback] = await db
          .select()
          .from(shippingMethods)
          .where(
            and(
              eq(shippingMethods.carrier, order.shippingCarrier),
              eq(shippingMethods.isActive, true),
            ),
          );
        methodRowId = fallback?.id ?? null;
      }

      let sendcloudMethodId: number | null = null;
      if (methodRowId) {
        const [method] = await db
          .select()
          .from(shippingMethods)
          .where(eq(shippingMethods.id, methodRowId));
        sendcloudMethodId = method?.sendcloudMethodId ?? null;
      }

      if (!sendcloudMethodId) {
        return {
          ok: false,
          message:
            "Aucune methode Sendcloud associee a cette commande. Synchronisez les methodes dans Livraison, puis reessayez.",
          parcelId: null,
          trackingNumber: null,
          trackingUrl: null,
          labelUrl: null,
        };
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
        weight: input.weight ?? creds.defaultWeight,
        shippingMethodId: sendcloudMethodId,
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
      }

      return result;
    }),

  tracking: publicQuery
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId));
      if (!order) return null;

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
