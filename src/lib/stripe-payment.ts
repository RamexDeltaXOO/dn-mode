/**
 * Le SDK Stripe peut etre charge alors que son Payment Element ne l'est pas.
 * Interdire la confirmation jusqu'a l'evenement onReady du composant.
 */
export type StripePaymentUiState = {
  stripeLoaded: boolean;
  elementsLoaded: boolean;
  paymentElementReady: boolean;
  acceptedCgv: boolean;
  processing: boolean;
  loadingError: boolean;
};

export function canSubmitStripePayment(state: StripePaymentUiState): boolean {
  return (
    state.stripeLoaded &&
    state.elementsLoaded &&
    state.paymentElementReady &&
    state.acceptedCgv &&
    !state.processing &&
    !state.loadingError
  );
}

/** Detecte l'erreur de Stripe quand le Payment Element n'est plus monte. */
export function isStripePaymentElementNotReady(message: string | null | undefined): boolean {
  return /we could not retrieve data from the specified element|element.*(mounted|ready event)|elements should have a mounted payment element/i.test(message || "");
}

/** Traduire le message technique de Stripe en action compréhensible. */
export function paymentErrorMessage(message: string | null | undefined): string {
  const raw = (message || "").trim();
  if (isStripePaymentElementNotReady(raw)) {
    return "Le formulaire de paiement n'est pas pret ou a ete interrompu. Veuillez reessayer de charger les moyens de paiement avant de payer.";
  }
  return raw || "Le paiement n'a pas pu etre confirme. Veuillez reessayer.";
}
