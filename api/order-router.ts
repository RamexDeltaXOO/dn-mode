import { z } from "zod";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { affectedRows, bulkIdsInput } from "./lib/bulk";
import { orders, orderItems, products, carts, cartItems, payments } from "@db/schema";
import type { Order } from "@db/schema";
import { ConfigKeys, EmailTemplateKeys, carrierLabel } from "@contracts/constants";
import { getConfigValue } from "./lib/site-config";
import { getShippingSettings, quoteShipping } from "./lib/shipping";
import { buildOrderItemsHtml, escapeHtml } from "./lib/email-templates";
import { getSupportEmail, sendTemplateEmail } from "./lib/mailer";
import { originFromRequest } from "./lib/request-origin";
import { contentWeightGrams, getWeightSettings } from "./lib/weight";
import { orderItemsInput, shortText } from "./lib/order-input";

export type OrderEmailItem = {
  productName: string;
  quantity: number;
  totalPrice: string | number;
  unitPrice?: string | number;
  color?: string | null;
  size?: string | null;
};

/** Numero de commande unique et non devinable (insensible aux suppressions). */
function generateOrderNumber(): string {
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DNM-${day}-${suffix}`;
}

/**
 * URL publique de la boutique, pour les liens des emails : le domaine
 * officiel (CRM, sinon PUBLIC_APP_URL). L'origine de la requete n'est reprise
 * que si elle designe ce meme domaine (avec ou sans www) ou un poste local :
 * elle vient d'en-tetes que le client peut forger, et un email de commande ne
 * doit jamais renvoyer vers un autre site.
 */
export async function resolveShopUrl(req?: Request): Promise<string> {
  const configured = (
    await getConfigValue(ConfigKeys.siteUrl, {
      envKey: "PUBLIC_APP_URL",
      fallback: "https://dn-mode.com",
    })
  ).replace(/\/+$/, "");
  if (!req) return configured;

  const origin = originFromRequest(req);
  try {
    const host = new URL(origin).hostname;
    const official = new URL(configured).hostname.replace(/^www\./, "");
    if (host.replace(/^www\./, "") === official || host === "localhost" || host === "127.0.0.1") {
      return origin;
    }
  } catch {
    // Origine ou configuration illisible : domaine officiel.
  }
  return configured;
}

/** Construit le jeu de variables attendu par les gabarits de commande. */
export async function buildOrderEmailVariables(input: {
  order: Order;
  items: OrderEmailItem[];
  req?: Request;
}): Promise<Record<string, string>> {
  const { order, items } = input;
  const shopUrl = await resolveShopUrl(input.req);
  const supportEmail = await getSupportEmail();
  const settings = await getShippingSettings();
  const shopName = await getConfigValue(ConfigKeys.siteName, { fallback: "DN MODE" });

  const shippingCost = Number.parseFloat(String(order.shippingCost ?? "0"));
  const addressLines = [
    [order.firstName, order.lastName].filter(Boolean).join(" "),
    order.address,
    [order.postalCode, order.city].filter(Boolean).join(" "),
    order.country,
  ].filter((line) => line && String(line).trim() !== "");

  const servicePointBlock = order.servicePointId
    ? `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#666666;">Point relais : <strong style="color:#222222;">${escapeHtml(order.servicePointName ?? "")}</strong><br />${escapeHtml(order.servicePointAddress ?? "")}</p>`
    : "";

  return {
    shopName,
    shopUrl,
    logoUrl: `${shopUrl}/logo-dnmode.png`,
    supportEmail,
    supportUrl: `${shopUrl}/contact`,
    orderNumber: order.orderNumber,
    orderDate: new Date(order.createdAt ?? new Date()).toLocaleDateString("fr-FR"),
    firstName: order.firstName ?? "",
    lastName: order.lastName ?? "",
    email: order.email,
    itemsHtml: buildOrderItemsHtml(items),
    subtotal: Number.parseFloat(String(order.subtotal ?? "0")).toFixed(2),
    shippingCost: shippingCost === 0 ? "Offerte" : `€${shippingCost.toFixed(2)}`,
    discount: Number.parseFloat(String(order.discount ?? "0")).toFixed(2),
    total: Number.parseFloat(String(order.total ?? "0")).toFixed(2),
    shippingAddress: addressLines.map((l) => escapeHtml(String(l))).join("<br />"),
    carrierName: order.shippingMethodName
      ? order.shippingMethodName
      : order.shippingCarrier
        ? carrierLabel(order.shippingCarrier)
        : "Livraison standard",
    servicePointBlock,
    orderUrl: `${shopUrl}/checkout`,
    trackingNumber: order.trackingNumber ?? "",
    trackingUrl: order.trackingUrl ?? `${shopUrl}/contact`,
    estimatedDays: "2 a 5 jours ouvres",
    freeShippingThreshold: String(settings.threshold),
  };
}

/** Envoi non bloquant : un email en echec ne doit jamais casser une commande. */
async function safeSendOrderEmail(
  templateKey: string,
  order: Order,
  items: OrderEmailItem[],
  req?: Request,
): Promise<void> {
  try {
    const variables = await buildOrderEmailVariables({ order, items, req });
    const result = await sendTemplateEmail({ to: order.email, templateKey, variables });
    if (!result.success) {
      console.error(`[email] ${templateKey} non envoye pour ${order.orderNumber}:`, result.error);
    }
  } catch (error) {
    console.error(`[email] ${templateKey} a echoue pour ${order.orderNumber}:`, error);
  }
}

export const orderRouter = createRouter({
  // Saisie d'une commande sans paiement : reservee au CRM. La boutique passe
  // par stripe.createPaymentIntent ; publique, cette route permettait a
  // n'importe qui de creer des commandes et d'envoyer des emails de
  // confirmation a n'importe quelle adresse.
  create: adminQuery
    .input(z.object({
      email: z.string().email().max(320),
      firstName: shortText(100).optional(),
      lastName: shortText(100).optional(),
      address: shortText(500).optional(),
      city: shortText(100).optional(),
      postalCode: shortText(20).optional(),
      country: shortText(100).optional(),
      phone: shortText(30).optional(),
      shippingMethodId: z.number().int().optional(),
      servicePointId: shortText(100).optional(),
      servicePointName: shortText(255).optional(),
      servicePointAddress: shortText(500).optional(),
      items: orderItemsInput,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Calculate totals
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of input.items) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        if (!product || product.isActive === false) continue;
        const price = parseFloat(product.price as string);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        orderItemsData.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal.toFixed(2),
          color: item.color || null,
          size: item.size || null,
          weightGrams: product.weightGrams ?? null,
        });
      }

      // Poids reel du panier : sert a choisir la bonne tranche tarifaire.
      const weightSettings = await getWeightSettings();
      const weightGrams =
        contentWeightGrams(orderItemsData, weightSettings.fallbackGrams) +
        weightSettings.packagingGrams;

      // Frais de port : livraison offerte au-dela du seuil configure (100€).
      const quote = await quoteShipping({
        subtotal,
        methodId: input.shippingMethodId ?? null,
        weightGrams,
      });
      const shippingCost = quote.cost;
      const discount = 0;
      const total = subtotal + shippingCost - discount;

      const orderNumber = generateOrderNumber();

      // Create order
      const result = await db.insert(orders).values({
        orderNumber,
        userId: ctx.user?.id || null,
        email: input.email,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        address: input.address || null,
        city: input.city || null,
        postalCode: input.postalCode || null,
        country: input.country || "France",
        phone: input.phone || null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        shippingMethodId: quote.methodId,
        shippingCarrier: quote.carrier,
        shippingMethodName: quote.methodName,
        servicePointId: input.servicePointId || null,
        servicePointName: input.servicePointName || null,
        servicePointAddress: input.servicePointAddress || null,
      });

      const orderId = Number(result[0].insertId);

      // Create order items
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({ ...item, orderId });
      }

      // Clear cart if user is logged in
      if (ctx.user?.id) {
        const [cart] = await db.select().from(carts).where(eq(carts.userId, ctx.user.id));
        if (cart) {
          await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        }
      }

      // Email de confirmation de commande
      const [created] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (created) {
        await safeSendOrderEmail(
          EmailTemplateKeys.orderConfirmation,
          created,
          orderItemsData,
          ctx.req,
        );
      }

      return { orderId, orderNumber, total: total.toFixed(2) };
    }),

  getMyOrders: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myOrders = await db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt));
    return myOrders;
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.id));
      if (!order) return null;

      // Check authorization
      if (ctx.user?.role !== "admin" && order.userId !== ctx.user?.id) {
        return null;
      }

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return { ...order, items };
    }),

  list: adminQuery
    .input(z.object({
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const offset = (page - 1) * limit;

      let query;
      if (input?.status) {
        query = db.select().from(orders).where(eq(orders.status, input.status as NonNullable<Order["status"]>)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
      } else {
        query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
      }

      const orderList = await query;

      let countQuery;
      if (input?.status) {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, input.status as NonNullable<Order["status"]>));
      } else {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(orders);
      }
      const [{ count }] = await countQuery;

      return { orders: orderList, total: count };
    }),

  /**
   * Supprime definitivement une commande, ses lignes et ses paiements.
   * Aucun email n'est envoye : c'est une operation de menage cote CRM, pas
   * une annulation client (pour cela, passer le statut a "cancelled").
   */
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.id));
      if (!order) {
        return { success: false, error: "Commande introuvable" };
      }

      // Pas de cles etrangeres en base : on nettoie explicitement les
      // lignes liees pour ne pas laisser d'orphelins.
      await db.delete(orderItems).where(eq(orderItems.orderId, input.id));
      await db.delete(payments).where(eq(payments.orderId, input.id));
      await db.delete(orders).where(eq(orders.id, input.id));

      return { success: true, orderNumber: order.orderNumber };
    }),

  deleteMany: adminQuery
    .input(bulkIdsInput)
    .mutation(async ({ input }) => {
      const db = getDb();
      // Memes regles que la suppression unitaire : articles et paiements
      // partent avec la commande.
      await db.delete(orderItems).where(inArray(orderItems.orderId, input.ids));
      await db.delete(payments).where(inArray(payments.orderId, input.ids));
      const result = await db.delete(orders).where(inArray(orders.id, input.ids));
      return { deleted: affectedRows(result) };
    }),

  updateStatus: adminQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      const [updated] = await db.select().from(orders).where(eq(orders.id, input.id));

      // Notification client selon le nouveau statut
      const templateByStatus: Partial<Record<typeof input.status, string>> = {
        shipped: EmailTemplateKeys.orderShipped,
        delivered: EmailTemplateKeys.orderDelivered,
        cancelled: EmailTemplateKeys.orderCancelled,
      };
      const templateKey = templateByStatus[input.status];
      if (updated && templateKey) {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, updated.id));
        await safeSendOrderEmail(templateKey, updated, items, ctx.req);
      }

      return updated;
    }),
});
