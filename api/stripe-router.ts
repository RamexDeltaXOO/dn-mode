import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { payments, orders, orderItems, products, siteConfig } from "@db/schema";
import { eq } from "drizzle-orm";

// Get Stripe key from DB config or env
async function getStripeKey(): Promise<string> {
  try {
    const db = getDb();
    const [config] = await db.select().from(siteConfig).where(eq(siteConfig.key, "stripe_secret_key"));
    if (config?.value) return config.value;
  } catch { /* ignore */ }
  return process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
}

// Lazy load stripe
let stripeInstance: any = null;
async function getStripe() {
  if (!stripeInstance) {
    const key = await getStripeKey();
    if (key === "sk_test_dummy") return null;
    const Stripe = require("stripe");
    stripeInstance = Stripe(key);
  }
  return stripeInstance;
}

export const stripeRouter = createRouter({
  getConfig: publicQuery.query(async () => {
    try {
      const db = getDb();
      const [pk] = await db.select().from(siteConfig).where(eq(siteConfig.key, "stripe_publishable_key"));
      return {
        publishableKey: pk?.value || "pk_test_dummy",
        hasSecretKey: !!(await getStripeKey() && (await getStripeKey()) !== "sk_test_dummy"),
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
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Calculate totals
      let subtotal = 0;
      const orderItemsData: any[] = [];

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
        });
      }

      const shippingCost = subtotal >= 120 ? 0 : 5.9;
      const total = subtotal + shippingCost;
      const totalCents = Math.round(total * 100);

      // Create order
      const orderResult = await db.insert(orders).values({
        orderNumber: `DNM-${Date.now()}`,
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
      });

      const orderId = Number((orderResult as any)[0].insertId);

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
            clientSecret: paymentIntent.client_secret,
            orderId,
            orderNumber: `DNM-${Date.now()}`,
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
        orderNumber: `DNM-${Date.now()}`,
        total,
      };
    }),

  confirmPayment: publicQuery
    .input(z.object({
      orderId: z.number(),
      paymentIntentId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      await db
        .update(orders)
        .set({ status: "processing" })
        .where(eq(orders.id, input.orderId));

      if (input.paymentIntentId) {
        await db
          .update(payments)
          .set({ status: "succeeded" })
          .where(eq(payments.stripePaymentIntentId, input.paymentIntentId));
      }

      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId));
      return { order };
    }),
});
