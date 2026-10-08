import type { Context } from "hono";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { ConfigKeys } from "@contracts/constants";
import { payments } from "@db/schema";
import { getDb } from "../queries/connection";
import { getStripe, markOrderPaid } from "../stripe-router";
import { getConfigValue } from "./site-config";

/**
 * Webhook Stripe : Stripe previent directement le serveur quand un paiement
 * aboutit, meme si le client a ferme son navigateur pendant une redirection
 * (PayPal, Klarna...). La signature est verifiee avec le secret whsec_...
 * fourni par Stripe a la creation du webhook.
 *
 * Evenements utiles : payment_intent.succeeded et payment_intent.payment_failed.
 */
export function createStripeWebhookHandler() {
  return async (c: Context) => {
    const secret = await getConfigValue(ConfigKeys.stripeWebhookSecret, { envKey: "STRIPE_WEBHOOK_SECRET" });
    const stripe = await getStripe();
    if (!secret || !stripe) return c.json({ error: "Webhook Stripe non configure" }, 503);

    const signature = c.req.header("stripe-signature");
    if (!signature) return c.json({ error: "Signature manquante" }, 400);

    // Corps brut indispensable : la signature porte sur les octets exacts.
    const rawBody = await c.req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      console.error("[stripe-webhook] Signature invalide :", err instanceof Error ? err.message : err);
      return c.json({ error: "Signature invalide" }, 400);
    }

    if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
      return c.json({ received: true });
    }

    const db = getDb();
    const intentId = event.data.object.id;
    const succeeded = event.type === "payment_intent.succeeded";
    const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, intentId));
    // Paiement inconnu (autre boutique sur le meme compte Stripe...) : on ignore.
    if (!payment?.orderId) return c.json({ received: true });

    try {
      if (succeeded) {
        await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));
        await markOrderPaid(payment.orderId, c.req.raw);
      } else {
        await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
      }
    } catch (err) {
      // 500 : Stripe renverra l'evenement plus tard. markOrderPaid ne compte
      // qu'une fois, le renvoi est donc sans risque.
      console.error(`[stripe-webhook] ${event.type} (commande ${payment.orderId}) :`, err);
      return c.json({ error: "Erreur interne" }, 500);
    }

    return c.json({ received: true });
  };
}
