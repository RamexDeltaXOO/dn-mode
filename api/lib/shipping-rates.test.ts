import { describe, expect, it } from "vitest";
import {
  hasWeightRange,
  offerServiceHints,
  pickSendcloudService,
  priceForWeight,
  ratesFromQuotes,
  readMethodConfig,
  serviceNameOf,
  sortServices,
  writeMethodConfig,
} from "@contracts/shipping-rates";
import {
  type RawShippingOption,
  buildShipmentBody,
  mapShippingOption,
  readShipmentResult,
  sendcloudErrorMessage,
  shippingOptionsBody,
} from "./sendcloud";

// Options telles que l'API v3 les renvoie (POST /shipping-options).
function option(
  code: string,
  name: string,
  carrier: string,
  lastMile: string,
  extra: Record<string, unknown> = {},
): RawShippingOption {
  return {
    code,
    name,
    carrier: { code: carrier, name: carrier },
    product: { code: code.split("/")[0], name: name.replace(/ \+.*$/, "") },
    functionalities: { last_mile: lastMile, signature: false, labelless: false, returns: false, ...extra },
    weight: { min: { value: "0.001", unit: "kg" }, max: { value: "30.001", unit: "kg" } },
    requirements: { is_service_point_required: lastMile !== "home_delivery" },
  };
}

const raw: RawShippingOption[] = [
  option("colissimo:home", "Colissimo Home", "colissimo", "home_delivery"),
  option("colissimo:home/signature", "Colissimo Home + Signature", "colissimo", "home_delivery", { signature: true }),
  option("colissimo:service_point", "Colissimo Service Point", "colissimo", "service_point"),
  option("mondial_relay:home", "Mondial Relay Home Domestic", "mondial_relay", "home_delivery"),
  option("mondial_relay:locker", "Mondial Relay Locker Delivery", "mondial_relay", "locker"),
  option("mondial_relay:standard/qr", "Mondial Relay Point Relais QR", "mondial_relay", "service_point", { labelless: true }),
  option("mondial_relay:standard", "Mondial Relay Point Relais", "mondial_relay", "service_point"),
  option("mondial_relay:return", "Mondial Relay Retour", "mondial_relay", "service_point", { returns: true }),
];
const services = raw.map(mapShippingOption).filter((s) => s !== null);

const pick = (carrier: string, servicePoint: boolean, hints?: Array<string | null>) =>
  pickSendcloudService(services, { carrier, servicePoint, hints })?.code;

describe("options Sendcloud (API v3)", () => {
  it("lit le mode de livraison et le poids maximal", () => {
    const relais = services.find((s) => s.code === "mondial_relay:standard")!;
    expect(relais.carrier).toBe("mondial_relay");
    expect(relais.requiresServicePoint).toBe(true);
    expect(relais.maxWeight).toBeCloseTo(30.001);
    expect(services.find((s) => s.code === "colissimo:home")!.requiresServicePoint).toBe(false);
    expect(mapShippingOption({ name: "sans code" })).toBeNull();
  });

  it("choisit l'option standard du transporteur et du mode", () => {
    expect(pick("colissimo", false)).toBe("colissimo:home");
    expect(pick("colissimo", true)).toBe("colissimo:service_point");
    expect(pick("mondial_relay", false)).toBe("mondial_relay:home");
    expect(pick("mondial_relay", true)).toBe("mondial_relay:standard");
    expect(pick("chronopost", false)).toBeUndefined();
  });

  it("respecte l'option imposee dans le CRM, par code ou par nom", () => {
    const offer = { name: "Point relais", config: { sendcloudService: "mondial_relay:standard/qr" } };
    expect(pick("mondial_relay", true, offerServiceHints(offer))).toBe("mondial_relay:standard/qr");
    expect(pick("mondial_relay", true, ["Mondial Relay Locker Delivery"])).toBe("mondial_relay:locker");
  });

  it("reconnait le nom d'une ancienne tranche de poids (API v2)", () => {
    expect(pick("mondial_relay", true, ["Mondial Relay Point Relais QR 0.5-1kg"])).toBe("mondial_relay:standard/qr");
    expect(pick("colissimo", false, ["Colissimo Home 0.5-0.75kg"])).toBe("colissimo:home");
  });

  it("n'utilise jamais un indice d'un autre mode", () => {
    expect(pick("colissimo", true, ["Colissimo Home + Signature"])).toBe("colissimo:service_point");
  });

  it("place l'option automatique en tete de chaque mode", () => {
    const relais = sortServices(services).filter((s) => s.carrier === "mondial_relay" && s.requiresServicePoint);
    expect(relais.map((s) => s.code)).toEqual([
      "mondial_relay:standard",
      "mondial_relay:standard/qr",
      "mondial_relay:locker",
      "mondial_relay:return",
    ]);
  });

  it("construit une grille a partir des tarifs releves", () => {
    expect(
      ratesFromQuotes([
        { upToKg: 1, price: 4.2 },
        { upToKg: 0.5, price: 4.2 },
        { upToKg: 2, price: 5.6 },
        { upToKg: 5, price: null },
      ]),
    ).toEqual([
      { upToKg: 1, price: 4.2 },
      { upToKg: 2, price: 5.6 },
    ]);
    expect(ratesFromQuotes([{ upToKg: 1, price: 0 }])).toEqual([]);
  });
});

describe("annonce d'un colis (API v3)", () => {
  const input = {
    name: "Walid Bouakka",
    address: "142 Avenue Jean Jaures",
    city: "Bobigny",
    postalCode: "93000",
    country: "France",
    email: "client@example.com",
    telephone: "0612345678",
    orderNumber: "DNM-20261026-8ZM2Y",
    weight: 0.6,
    shippingOptionCode: "mondial_relay:standard",
    servicePointId: "12345",
    senderAddressId: 42,
  };

  it("envoie l'adresse, le point relais, l'option et le poids", () => {
    expect(buildShipmentBody(input)).toEqual({
      from_address: { sender_address_id: 42 },
      to_address: {
        name: "Walid Bouakka",
        address_line_1: "Avenue Jean Jaures",
        house_number: "142",
        postal_code: "93000",
        city: "Bobigny",
        country_code: "FR",
        email: "client@example.com",
        phone_number: "0612345678",
      },
      ship_with: { type: "shipping_option_code", properties: { shipping_option_code: "mondial_relay:standard" } },
      order_number: "DNM-20261026-8ZM2Y",
      parcels: [{ weight: { value: "0.600", unit: "kg" } }],
      to_service_point: { id: "12345" },
    });
    const home = buildShipmentBody({ ...input, servicePointId: null, telephone: "" });
    expect(home.to_service_point).toBeUndefined();
    expect((home.to_address as Record<string, string>).phone_number).toBeUndefined();
  });

  it("filtre les options par destination, point relais et poids", () => {
    expect(shippingOptionsBody({ toPostalCode: "93000", toCity: "Bobigny", servicePointId: "12345", weightKg: 0.6 })).toEqual({
      from_address: { country_code: "FR" },
      to_address: { country_code: "FR", postal_code: "93000", city: "Bobigny" },
      to_service_point: { id: "12345" },
      parcels: [{ weight: { value: "0.600", unit: "kg" } }],
    });
  });

  it("lit l'etiquette et le suivi d'une annonce reussie", () => {
    const result = readShipmentResult({
      errors: [],
      parcels: [
        {
          id: 383707309,
          status: { code: "READY_TO_SEND", message: "Ready to send" },
          tracking_number: "3SYZXG8498635",
          tracking_url: "https://tracking.example/3SYZXG8498635",
          documents: [{ type: "label", link: "https://panel.sendcloud.sc/api/v3/parcels/383707309/documents/label" }],
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      message: "Etiquette creee (Ready to send)",
      parcelId: "383707309",
      trackingNumber: "3SYZXG8498635",
      trackingUrl: "https://tracking.example/3SYZXG8498635",
      labelUrl: "https://panel.sendcloud.sc/api/v3/parcels/383707309/documents/label",
    });
  });

  it("ne marque pas expediee une annonce refusee par le transporteur", () => {
    const result = readShipmentResult({
      errors: [{ status: "500", code: "parcel_announcement_error", detail: "An error occurred while connecting to the carrier." }],
      parcels: [{ id: 1, status: { code: "ANNOUNCEMENT_FAILED", message: "Announcement Failed" } }],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("An error occurred while connecting to the carrier.");
  });

  it("rend lisibles les erreurs v2 et v3", () => {
    expect(sendcloudErrorMessage({ error: { message: "Creating parcels via API v2 is not available" } }, 400)).toBe(
      "Creating parcels via API v2 is not available",
    );
    expect(
      sendcloudErrorMessage(
        { errors: [{ detail: "This field is required.", source: { pointer: "/to_address/name" } }] },
        400,
      ),
    ).toBe("to_address/name : This field is required.");
    expect(sendcloudErrorMessage(null, 502)).toBe("Erreur Sendcloud (502)");
  });
});

describe("noms des anciennes tranches Sendcloud", () => {
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
      { other: true, sendcloudService: "colissimo:home" },
      { rates: [{ upToKg: 1, price: 5 }, { upToKg: -1, price: 2 }], sendcloudService: null },
    );
    expect(written).toEqual({ other: true, rates: [{ upToKg: 1, price: 5 }] });
    expect(readMethodConfig(written)).toEqual({ rates: [{ upToKg: 1, price: 5 }], sendcloudService: null });
    expect(readMethodConfig("n'importe quoi")).toEqual({ rates: [], sendcloudService: null });
  });
});
