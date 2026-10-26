import { describe, expect, it } from "vitest";
import {
  groupSendcloudServices,
  hasWeightRange,
  offerServiceHints,
  pickBracket,
  pickSendcloudService,
  priceForWeight,
  ratesFromService,
  readMethodConfig,
  serviceMaxWeight,
  serviceNameOf,
  writeMethodConfig,
} from "@contracts/shipping-rates";
import { mapShippingMethod } from "./sendcloud";

// Extrait d'un compte Sendcloud reel : une methode par tranche de poids.
let nextId = 100;
function bracket(name: string, carrier: string, min: number, max: number, servicePoint = false, price: number | null = null) {
  return {
    id: nextId++,
    name: `${name} ${min}-${max}kg`,
    carrier,
    minWeight: min === 0 ? 0.001 : min + 0.001,
    maxWeight: max + 0.001,
    price,
    requiresServicePoint: servicePoint,
  };
}

const methods = [
  bracket("Colissimo Home", "colissimo", 0, 0.25),
  bracket("Colissimo Home", "colissimo", 0.25, 0.5),
  bracket("Colissimo Home", "colissimo", 0.5, 0.75),
  bracket("Colissimo Home", "colissimo", 0.75, 1),
  bracket("Colissimo Home", "colissimo", 1, 2),
  bracket("Colissimo Home Signature", "colissimo", 0.5, 0.75),
  bracket("Colissimo Service Point", "colissimo", 0.5, 0.75, true),
  bracket("Mondial Relay Home Domestic", "mondial_relay", 0.5, 1),
  bracket("Mondial Relay Locker Delivery", "mondial_relay", 0.5, 1, true),
  bracket("Mondial Relay Locker Delivery QR", "mondial_relay", 0.5, 1, true),
  bracket("Mondial Relay Point Relais QR", "mondial_relay", 0.5, 1, true),
  bracket("Mondial Relay Point Relais", "mondial_relay", 0, 0.5, true, 4.2),
  bracket("Mondial Relay Point Relais", "mondial_relay", 0.5, 1, true, 4.2),
  bracket("Mondial Relay Point Relais", "mondial_relay", 1, 2, true, 5.6),
];
const services = groupSendcloudServices(methods);
const byName = (name: string) => services.find((s) => s.name === name)!;

describe("noms de services Sendcloud", () => {
  it("retire la tranche de poids du nom", () => {
    expect(serviceNameOf("Colissimo Home 0.5-0.75kg")).toBe("Colissimo Home");
    expect(serviceNameOf("Mondial Relay Point Relais QR 0.5-1kg")).toBe("Mondial Relay Point Relais QR");
    expect(serviceNameOf("Chronopost 13 0-2kg")).toBe("Chronopost 13");
    expect(serviceNameOf("Colissimo Home 0,25 kg - 0,5 kg")).toBe("Colissimo Home");
    expect(serviceNameOf("Mondial Relay Point Relais")).toBe("Mondial Relay Point Relais");
  });

  it("reconnait les tranches importees par l'ancienne synchronisation", () => {
    expect(hasWeightRange("Colissimo Home 29-30kg")).toBe(true);
    expect(hasWeightRange("Collisimo")).toBe(false);
    expect(hasWeightRange("Chronopost Express")).toBe(false);
  });
});

describe("regroupement des methodes Sendcloud", () => {
  it("fait un service par produit, toutes tranches confondues", () => {
    expect(services.map((s) => s.name).sort()).toEqual([
      "Colissimo Home",
      "Colissimo Home Signature",
      "Colissimo Service Point",
      "Mondial Relay Home Domestic",
      "Mondial Relay Locker Delivery",
      "Mondial Relay Locker Delivery QR",
      "Mondial Relay Point Relais",
      "Mondial Relay Point Relais QR",
    ]);
    expect(byName("Colissimo Home").brackets).toHaveLength(5);
    expect(serviceMaxWeight(byName("Colissimo Home"))).toBeCloseTo(2.001);
  });

  it("choisit le service standard du transporteur et du mode", () => {
    const pick = (carrier: string, servicePoint: boolean) =>
      pickSendcloudService(services, { carrier, servicePoint })?.name;
    expect(pick("colissimo", false)).toBe("Colissimo Home");
    expect(pick("colissimo", true)).toBe("Colissimo Service Point");
    expect(pick("mondial_relay", false)).toBe("Mondial Relay Home Domestic");
    expect(pick("mondial_relay", true)).toBe("Mondial Relay Point Relais");
    expect(pick("chronopost", false)).toBeUndefined();
  });

  it("respecte le service impose, puis le nom de l'offre", () => {
    const qr = { name: "Point relais", config: { sendcloudService: "Mondial Relay Point Relais QR" } };
    expect(
      pickSendcloudService(services, {
        carrier: "mondial_relay",
        servicePoint: true,
        hints: offerServiceHints(services, qr),
      })?.name,
    ).toBe("Mondial Relay Point Relais QR");

    // Commande passee avec une ancienne tranche, supprimee depuis.
    expect(
      pickSendcloudService(services, {
        carrier: "mondial_relay",
        servicePoint: true,
        hints: ["Mondial Relay Locker Delivery 0.5-1kg"],
      })?.name,
    ).toBe("Mondial Relay Locker Delivery");

    // Un indice d'un autre mode n'est jamais retenu.
    expect(
      pickSendcloudService(services, {
        carrier: "colissimo",
        servicePoint: true,
        hints: ["Colissimo Home Signature"],
      })?.name,
    ).toBe("Colissimo Service Point");
  });

  it("retrouve le service d'une ligne liee a une tranche precise", () => {
    const legacy = byName("Mondial Relay Locker Delivery QR").brackets[0];
    expect(offerServiceHints(services, { name: "Relais", sendcloudMethodId: legacy.id })).toEqual([
      "Mondial Relay Locker Delivery QR",
      "Relais",
    ]);
  });

  it("prend la tranche qui couvre le poids du colis", () => {
    const home = byName("Colissimo Home");
    expect(pickBracket(home, 0.6)?.name).toBe("Colissimo Home 0.5-0.75kg");
    expect(pickBracket(home, 0.75)?.name).toBe("Colissimo Home 0.5-0.75kg");
    expect(pickBracket(home, 1.4)?.name).toBe("Colissimo Home 1-2kg");
    expect(pickBracket(home, 0)?.name).toBe("Colissimo Home 0-0.25kg");
    expect(pickBracket(home, 5)).toBeNull();
  });

  it("deduit une grille des tarifs Sendcloud, sans tranche en double", () => {
    expect(ratesFromService(byName("Mondial Relay Point Relais"))).toEqual([
      { upToKg: 1, price: 4.2 },
      { upToKg: 2, price: 5.6 },
    ]);
    // Pas de prix communique : pas de grille, jamais un tarif a 0.
    expect(ratesFromService(byName("Colissimo Home"))).toEqual([]);
  });
});

describe("prix selon le poids", () => {
  const offer = {
    price: "4.50",
    config: { rates: [{ upToKg: 2, price: 6.9 }, { upToKg: 0.5, price: 4.5 }, { upToKg: 1, price: 5.5 }] },
  };

  it("applique la tranche du poids du colis", () => {
    expect(priceForWeight(offer, 0.3, 5.9)).toBe(4.5);
    expect(priceForWeight(offer, 0.5, 5.9)).toBe(4.5);
    expect(priceForWeight(offer, 0.6, 5.9)).toBe(5.5);
    expect(priceForWeight(offer, 1.8, 5.9)).toBe(6.9);
  });

  it("garde le prix de la derniere tranche au-dela", () => {
    expect(priceForWeight(offer, 12, 5.9)).toBe(6.9);
  });

  it("utilise le prix unique sans grille ou sans poids", () => {
    expect(priceForWeight({ price: "5.90", config: null }, 3, 4)).toBe(5.9);
    expect(priceForWeight(offer, null, 5.9)).toBe(4.5);
    expect(priceForWeight({ price: "abc" }, 1, 5.9)).toBe(5.9);
  });

  it("lit et ecrit la config sans perdre les autres cles", () => {
    const written = writeMethodConfig(
      { other: true, sendcloudService: "Colissimo Home" },
      { rates: [{ upToKg: 1, price: 5 }, { upToKg: -1, price: 2 }], sendcloudService: null },
    );
    expect(written).toEqual({ other: true, rates: [{ upToKg: 1, price: 5 }] });
    expect(readMethodConfig(written)).toEqual({ rates: [{ upToKg: 1, price: 5 }], sendcloudService: null });
    expect(readMethodConfig("n'importe quoi")).toEqual({ rates: [], sendcloudService: null });
  });
});

describe("lecture des methodes Sendcloud", () => {
  it("prend le prix France quand le prix racine vaut 0", () => {
    const method = mapShippingMethod({
      id: 1,
      name: "Mondial Relay Point Relais 0.5-1kg",
      carrier: "mondial_relay",
      min_weight: "0.501",
      max_weight: "1.001",
      price: 0,
      service_point_input: "required",
      countries: [{ iso_2: "BE", price: 6.1 }, { iso_2: "FR", price: 4.2 }],
    });
    expect(method?.price).toBe(4.2);
    expect(method?.requiresServicePoint).toBe(true);
  });

  it("ne transforme jamais un tarif absent en livraison gratuite", () => {
    const method = mapShippingMethod({
      id: 2,
      name: "Colissimo Home 0.5-0.75kg",
      carrier: "colissimo",
      price: 0,
      countries: [{ iso_2: "FR", price: 0 }],
    });
    expect(method?.price).toBeNull();
  });
});
