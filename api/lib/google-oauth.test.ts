import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@contracts/constants";
import { decodeState, encodeState } from "./google-oauth";

describe("connexion Google", () => {
  it("n'accepte que des chemins internes apres connexion", () => {
    expect(safeRedirectPath("/collections/robes")).toBe("/collections/robes");
    expect(safeRedirectPath("//pirate.test")).toBe("/");
    expect(safeRedirectPath("/\\pirate.test")).toBe("/");
    expect(safeRedirectPath("https://pirate.test")).toBe("/");
    expect(safeRedirectPath("/ /pirate.test")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });

  it("fait l'aller-retour du code de l'onglet dans le state", () => {
    const state = encodeState("/checkout", "nonce-de-test-1234");
    expect(decodeState(state)).toEqual({ redirectTo: "/checkout", nonce: "nonce-de-test-1234" });
    expect(decodeState("illisible")).toEqual({ redirectTo: "/", nonce: "" });
  });
});
