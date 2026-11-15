import { describe, expect, it } from "vitest";
import { buildServicePointSearchParams } from "./sendcloud";

describe("recherche de points relais", () => {
  it("recherche autour de l'adresse libre sans limiter au seul code postal", () => {
    const params = buildServicePointSearchParams({
      carrier: "mondial_relay",
      address: "12 rue de la Paix, 75002 Paris, France",
      postalCode: "75002",
      city: "Paris",
      radius: 10000,
    });
    expect(params.get("country")).toBe("FR");
    expect(params.get("carrier")).toBe("mondial_relay");
    expect(params.get("address")).toBe("12 rue de la Paix, 75002 Paris, France");
    expect(params.get("postal_code")).toBeNull();
    expect(params.get("city")).toBeNull();
    expect(params.get("radius")).toBe("10000");
  });

  it("la position GPS prevaut sur l'adresse, sans filtre postal", () => {
    const params = buildServicePointSearchParams({
      carrier: "colissimo",
      address: "8 avenue de l'Opera, Paris",
      latitude: 48.866,
      longitude: 2.333,
      radius: 5000,
    });
    expect(params.get("latitude")).toBe("48.866");
    expect(params.get("longitude")).toBe("2.333");
    expect(params.has("address")).toBe(false);
    expect(params.has("postal_code")).toBe(false);
  });

  it("conserve le mode postal pour les anciens consommateurs de l'API", () => {
    const params = buildServicePointSearchParams({
      carrier: "chronopost", postalCode: "93000", city: "Bobigny",
    });
    expect(params.get("postal_code")).toBe("93000");
    expect(params.get("city")).toBe("Bobigny");
    expect(params.get("radius")).toBe("10000");
  });
});
