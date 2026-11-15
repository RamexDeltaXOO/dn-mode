import { describe, it, expect } from "vitest";
import { isSendcloudBillingError, parcelFailure, readShipmentResult, sendcloudErrorMessage } from "./sendcloud";

describe("refus de paiement Sendcloud", () => {
  const refusal = "User has no valid payment method. Please add a valid payment method in your billing settings.";

  it("reconnait le refus dans une reponse HTTP", () => {
    expect(isSendcloudBillingError(refusal)).toBe(true);
    const message = sendcloudErrorMessage({ error: { message: refusal } }, 422);
    const result = parcelFailure(message);
    expect(result.ok).toBe(false);
    expect(result.billingIssue).toBe(true);
    expect(result.message).toContain("Facturation");
    expect(result.parcelId).toBeNull();
  });

  it("reconnait le refus dans les erreurs v3 imbriquees", () => {
    const result = readShipmentResult({
      errors: [{ detail: refusal }],
      parcels: [{ status: { code: "ANNOUNCEMENT_FAILED" } }],
    });
    expect(result.billingIssue).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("reconnait le refus dans le statut d'un colis sans errors[]", () => {
    const result = readShipmentResult({
      parcels: [{ status: { code: "ANNOUNCEMENT_FAILED", message: refusal } }],
    });
    expect(result.billingIssue).toBe(true);
  });

  it("laisse les autres erreurs disponibles pour le diagnostic", () => {
    const result = parcelFailure("Colis trop lourd pour cette option");
    expect(result.billingIssue).toBe(false);
    expect(result.message).toBe("Colis trop lourd pour cette option");
  });
});
