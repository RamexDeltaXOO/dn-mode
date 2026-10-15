import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "../local-auth-router";

/**
 * Preuve qu'un navigateur a bien cree une commande donnee.
 *
 * Remis avec la commande (stripe.createPaymentIntent) et exige pour la
 * confirmer en mode demo, quand aucun paiement Stripe ne peut servir de
 * preuve. Sans lui, n'importe qui pouvait valider la commande de quelqu'un
 * d'autre en essayant les numeros un par un. Signe avec APP_SECRET : rien a
 * stocker en base.
 */
export function orderConfirmToken(orderId: number): string {
  return createHmac("sha256", signingSecret()).update(`order-confirm:${orderId}`).digest("base64url");
}

export function isValidOrderConfirmToken(orderId: number, token: string | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderConfirmToken(orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
