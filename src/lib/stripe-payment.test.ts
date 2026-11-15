import { describe, expect, it } from "vitest";
import { canSubmitStripePayment, paymentErrorMessage, type StripePaymentUiState } from "./stripe-payment";

const ready: StripePaymentUiState = {
  stripeLoaded: true,
  elementsLoaded: true,
  paymentElementReady: true,
  acceptedCgv: true,
  processing: false,
  loadingError: false,
};

describe("paiement Stripe au checkout", () => {
  it("refuse le paiement tant que PaymentElement n'a pas emis onReady", () => {
    expect(canSubmitStripePayment({ ...ready, paymentElementReady: false })).toBe(false);
  });

  it("refuse le paiement avant le chargement du SDK et du contexte Stripe", () => {
    expect(canSubmitStripePayment({ ...ready, stripeLoaded: false })).toBe(false);
    expect(canSubmitStripePayment({ ...ready, elementsLoaded: false })).toBe(false);
  });

  it("bloque les doubles clics, les erreurs de chargement et l'absence de consentement", () => {
    expect(canSubmitStripePayment({ ...ready, processing: true })).toBe(false);
    expect(canSubmitStripePayment({ ...ready, loadingError: true })).toBe(false);
    expect(canSubmitStripePayment({ ...ready, acceptedCgv: false })).toBe(false);
  });

  it("permet le paiement apres chargement complet et acceptation", () => {
    expect(canSubmitStripePayment(ready)).toBe(true);
  });

  it("affiche une explication pour l'erreur Stripe de l'Element non monte", () => {
    expect(paymentErrorMessage(
      "We could not retrieve data from the specified Element. Please make sure the Element you are attempting to use is mounted and the ready event has been emitted.",
    )).toMatch(/formulaire de paiement/i);
  });

  it("conserve les autres erreurs de paiement", () => {
    expect(paymentErrorMessage("Your card has been declined.")).toBe("Your card has been declined.");
  });
});
