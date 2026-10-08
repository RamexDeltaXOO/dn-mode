import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payments, orders, orderItems, products, siteConfig } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { ConfigKeys, EmailTemplateKeys } from "@contracts/constants";
import { quoteShipping } from "./lib/shipping";
import { contentWeightGrams, getWeightSettings } from "./lib/weight";
import { buildOrderEmailVariables } from "./order-router";
import { sendTemplateEmail } from "./lib/mailer";
import { decrementStockForOrder } from "./lib/stock";

// Get Stripe key from DB config or env
async function getStripeKey(): Promise<string> {
  try {
    const db = getDb();
    const [config] = await db.select().from(siteConfig).where(eq(siteConfig.key, ConfigKeys.stripeSecretKey));
    if (config?.value) return config.value;
  } catch { /* ignore */ }
  return process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
}

// Lazy load stripe
let stripeInstance: import("stripe").Stripe | null = null;
export async function getStripe() {
  if (!stripeInstance) {
    const key = await getStripeKey();
    if (key === "sk_test_dummy") return null;
    const { default: Stripe } = await import("stripe");
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

/**
 * Passe une commande payee de pending a processing, en une seule requete
 * conditionnelle : si la page de paiement et le webhook Stripe arrivent en
 * meme temps, un seul gagne. Lui seul retire le stock et envoie l'email de
 * confirmation. Renvoie la commande a jour.
 */
export async function markOrderPaid(orderId: number, req?: Request) {
  const db = getDb();
  const updateResult = await db
    .update(orders)
    .set({ status: "processing" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
  const justConfirmed =
    Number((updateResult as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) > 0;

  if (justConfirmed) {
    await decrementStockForOrder(orderId);
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

  if (order && justConfirmed) {
    try {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const variables = await buildOrderEmailVariables({ order, items, req });
      const result = await sendTemplateEmail({
        to: order.email,
        templateKey: EmailTemplateKeys.orderConfirmation,
        variables,
      });
      if (!result.success) {
        console.error("[email] confirmation non envoyee:", result.error);
      }
    } catch (error) {
      console.error("[email] confirmation a echoue:", error);
    }
  }

  return order;
}

/** Numero de commande unique (meme schema que order-router). */
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

export const stripeRouter = createRouter({
  getConfig: publicQuery.query(async () => {
    try {
      const db = getDb();
      const [pk] = await db.select().from(siteConfig).where(eq(siteConfig.key, ConfigKeys.stripePublishableKey));
      const secretKey = await getStripeKey();
      return {
        publishableKey: pk?.value || "pk_test_dummy",
        hasSecretKey: secretKey !== "" && secretKey !== "sk_test_dummy",
      };
    } catch {
      return { publishableKey: "pk_test_dummy", hasSecretKey: false };
    }
  }),

  createPaymentIntent: publicQuery
    .input(
      z.object({
        amount: z.number().min(1),
        email: z.string().email(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number(),
            color: z.string().optional(),
            size: z.string().optional(),
          })
        ),
        shipping: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
          phone: z.string().optional(),
        }).optional(),
        shippingMethodId: z.number().optional(),
        servicePoint: z.object({
          id: z.string(),
          name: z.string(),
          address: z.string(),
        }).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Calculate totals
      let subtotal = 0;
      const orderItemsData: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitPrice: string;
        totalPrice: string;
        color: string | null;
        size: string | null;
        weightGrams: number | null;
      }> = [];

      for (const item of input.items) {
        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId));
        if (!product) continue;
        const price = parseFloat(String(product.price));
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        orderItemsData.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: String(product.price),
          totalPrice: itemTotal.toFixed(2),
          color: item.color || null,
          size: item.size || null,
          weightGrams: product.weightGrams ?? null,
        });
      }

      // Poids reel du panier, emballage compris.
      const weightSettings = await getWeightSettings();
      const weightGrams =
        contentWeightGrams(orderItemsData, weightSettings.fallbackGrams) +
        weightSettings.packagingGrams;

      // Livraison offerte au-dela du seuil configure (100€ par defaut).
      const quote = await quoteShipping({
        subtotal,
        methodId: input.shippingMethodId ?? null,
        weightGrams,
      });
      const shippingCost = quote.cost;
      const total = subtotal + shippingCost;
      const totalCents = Math.round(total * 100);

      // Un seul numero de commande : celui stocke est celui renvoye au client.
      const orderNumber = generateOrderNumber();

      const orderResult = await db.insert(orders).values({
        orderNumber,
        email: input.email,
        firstName: input.shipping?.firstName || null,
        lastName: input.shipping?.lastName || null,
        address: input.shipping?.address || null,
        city: input.shipping?.city || null,
        postalCode: input.shipping?.postalCode || null,
        country: input.shipping?.country || "France",
        phone: input.shipping?.phone || null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        total: total.toFixed(2),
        shippingMethodId: quote.methodId,
        shippingCarrier: quote.carrier,
        shippingMethodName: quote.methodName,
        servicePointId: input.servicePoint?.id || null,
        servicePointName: input.servicePoint?.name || null,
        servicePointAddress: input.servicePoint?.address || null,
      });

      const orderId = Number((orderResult as unknown as Array<{ insertId: number }>)[0].insertId);

      for (const item of orderItemsData) {
        await db.insert(orderItems).values({ ...item, orderId });
      }

      // Create Stripe Payment Intent
      const stripe = await getStripe();
      if (stripe) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalCents,
            currency: "eur",
            automatic_payment_methods: { enabled: true },
            metadata: {
              orderId: String(orderId),
              orderNumber,
              email: input.email,
            },
          });

          await db.insert(payments).values({
            orderId,
            stripePaymentIntentId: paymentIntent.id,
            amount: total.toFixed(2),
            currency: "eur",
            status: "pending",
          });

          return {
            // Toujours renseigne sur un PaymentIntent tout juste cree.
            clientSecret: paymentIntent.client_secret as string,
            orderId,
            orderNumber,
            total,
          };
        } catch {
          // Stripe failed, fall through to demo mode
        }
      }

      // Demo mode
      return {
        clientSecret: "pi_demo_secret",
        orderId,
        orderNumber,
        total,
      };
    }),

  confirmPayment: publicQuery
    .input(z.object({
      // Absent au retour d'un moyen de paiement qui redirige (PayPal,
      // Klarna...) : la commande est alors retrouvee via le paiement.
      orderId: z.number().optional(),
      paymentIntentId: z.string().optional(),
    }).refine((v) => v.orderId !== undefined || !!v.paymentIntentId, {
      message: "orderId ou paymentIntentId requis",
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      let orderId = input.orderId;
      if (orderId === undefined) {
        const [byIntent] = await db
          .select()
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, input.paymentIntentId!));
        orderId = byIntent?.orderId ?? undefined;
      }
      if (orderId === undefined) throw new TRPCError({ code: "NOT_FOUND", message: "Commande introuvable" });

      const [existing] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Commande introuvable" });

      // Cette route est publique : quand Stripe est configure, on verifie
      // aupres de Stripe que le paiement de CETTE commande a bien abouti avant
      // de la valider et de retirer le stock.
      const stripe = await getStripe();
      if (stripe) {
        const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId));
        if (!payment?.stripePaymentIntentId || payment.stripePaymentIntentId !== input.paymentIntentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Paiement introuvable pour cette commande" });
        }
        const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        if (intent?.status !== "succeeded") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le paiement n'a pas abouti" });
        }
        await db
          .update(payments)
          .set({ status: "succeeded" })
          .where(eq(payments.stripePaymentIntentId, payment.stripePaymentIntentId));
      }

      const order = await markOrderPaid(orderId, ctx.req);
      return { order };
    }),
});
