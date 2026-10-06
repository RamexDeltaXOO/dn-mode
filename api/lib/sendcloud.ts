import { ConfigKeys, CARRIER_LIST } from "@contracts/constants";
import { getConfigValue } from "./site-config";

/**
 * Client Sendcloud (sans dependance externe, base sur fetch).
 *
 * Sendcloud sert de passerelle unique vers Colissimo (La Poste), Chronopost
 * et Mondial Relay. Les cles API se saisissent dans le CRM
 * (Admin > Parametres > Livraison Sendcloud) et sont stockees dans
 * `site_config` ; les variables d'environnement servent de repli.
 *
 * Toutes les fonctions renvoient un resultat "safe" : elles ne lancent jamais
 * d'exception, afin qu'une panne Sendcloud ne casse jamais le tunnel d'achat.
 * Sans cles configurees, on bascule sur un jeu de donnees de demonstration.
 */

const PANEL_API = "https://panel.sendcloud.sc/api/v2";
const SERVICE_POINTS_API = "https://servicepoints.sendcloud.sc/api/v2";
const TIMEOUT_MS = 15_000;

// ── Types exposes ───────────────────────────────────────────
export type SendcloudMethod = {
  id: number;
  name: string;
  carrier: string;
  price: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  countries: string[];
  requiresServicePoint: boolean;
};

export type ServicePoint = {
  id: string;
  name: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  distance: number | null;
  carrier: string;
  openingHours: string[];
};

export type ParcelResult = {
  ok: boolean;
  message: string;
  parcelId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
};

export type SendcloudCredentials = {
  publicKey: string;
  secretKey: string;
  senderAddressId: string;
  defaultWeight: number;
  configured: boolean;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

// ── Credentials ─────────────────────────────────────────────
export async function getSendcloudCredentials(): Promise<SendcloudCredentials> {
  const publicKey = await getConfigValue(ConfigKeys.sendcloudPublicKey, {
    envKey: "SENDCLOUD_PUBLIC_KEY",
  });
  const secretKey = await getConfigValue(ConfigKeys.sendcloudSecretKey, {
    envKey: "SENDCLOUD_SECRET_KEY",
  });
  const senderAddressId = await getConfigValue(ConfigKeys.sendcloudSenderAddressId, {
    envKey: "SENDCLOUD_SENDER_ADDRESS_ID",
  });
  const rawWeight = await getConfigValue(ConfigKeys.sendcloudDefaultWeight, {
    envKey: "SENDCLOUD_DEFAULT_WEIGHT",
    fallback: "1",
  });
  const parsedWeight = Number.parseFloat(rawWeight.replace(",", "."));

  return {
    publicKey,
    secretKey,
    senderAddressId,
    defaultWeight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
    configured: publicKey !== "" && secretKey !== "",
  };
}

export async function isSendcloudConfigured(): Promise<boolean> {
  const { configured } = await getSendcloudCredentials();
  return configured;
}

function authHeader(creds: SendcloudCredentials): string {
  return "Basic " + Buffer.from(`${creds.publicKey}:${creds.secretKey}`).toString("base64");
}

// ── Requete generique ───────────────────────────────────────
async function sendcloudRequest<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    base?: string;
    creds?: SendcloudCredentials;
  } = {},
): Promise<ApiResult<T>> {
  const creds = opts.creds ?? (await getSendcloudCredentials());
  if (!creds.configured) {
    return { ok: false, error: "Sendcloud n'est pas configure", status: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${opts.base ?? PANEL_API}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: authHeader(creds),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const errorObj = (parsed as { error?: { message?: string } } | null)?.error;
      return {
        ok: false,
        error: errorObj?.message || `Erreur Sendcloud (${response.status})`,
        status: response.status,
      };
    }

    return { ok: true, data: parsed as T };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Delai depasse en contactant Sendcloud"
        : error instanceof Error
          ? error.message
          : "Erreur reseau";
    return { ok: false, error: message, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Utilitaires ─────────────────────────────────────────────
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Normalise un nom de transporteur Sendcloud vers un code interne connu. */
export function normalizeCarrier(raw: unknown): string {
  const value = String(raw ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (value.includes("mondial")) return "mondial_relay";
  if (value.includes("chrono")) return "chronopost";
  if (value.includes("colissimo") || value.includes("laposte") || value.includes("la_poste")) {
    return "colissimo";
  }
  return value;
}

/**
 * Sendcloud attend le numero de voie separe de la rue.
 * En France le numero precede la rue ("12 rue de la Paix"), mais on gere aussi
 * le format anglo-saxon ("Baker Street 221B").
 */
export function splitStreet(address: string): { street: string; houseNumber: string } {
  const value = (address || "").trim();
  if (!value) return { street: "Adresse non renseignee", houseNumber: "1" };

  const leading = value.match(/^(\d+\s*[a-zA-Z]?)\s+(.*)$/);
  if (leading && leading[2].trim()) {
    return { street: leading[2].trim(), houseNumber: leading[1].replace(/\s+/g, "") };
  }

  const trailing = value.match(/^(.*?)\s+(\d+\s*[a-zA-Z]?)$/);
  if (trailing && trailing[1].trim()) {
    return { street: trailing[1].trim(), houseNumber: trailing[2].replace(/\s+/g, "") };
  }

  return { street: value, houseNumber: "1" };
}

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function parseOpeningHours(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = raw as Record<string, unknown>;
  const lines: string[] = [];
  for (let day = 0; day < 7; day++) {
    const slots = entries[String(day)];
    if (!Array.isArray(slots) || slots.length === 0) continue;
    lines.push(`${WEEKDAYS[day]}: ${slots.map((s) => String(s)).join(", ")}`);
  }
  return lines;
}

// ── Jeu de donnees de demonstration ─────────────────────────
export const DEMO_METHODS: SendcloudMethod[] = [
  {
    id: 9001,
    name: "Colissimo Domicile",
    carrier: "colissimo",
    price: 5.9,
    minWeight: 0,
    maxWeight: 30,
    countries: ["FR"],
    requiresServicePoint: false,
  },
  {
    id: 9002,
    name: "Chronopost Express",
    carrier: "chronopost",
    price: 9.9,
    minWeight: 0,
    maxWeight: 30,
    countries: ["FR"],
    requiresServicePoint: false,
  },
  {
    id: 9003,
    name: "Mondial Relay Point Relais",
    carrier: "mondial_relay",
    price: 4.5,
    minWeight: 0,
    maxWeight: 20,
    countries: ["FR"],
    requiresServicePoint: true,
  },
];

/** Tarif de repli par transporteur (utilise quand Sendcloud ne renvoie pas de prix). */
export function demoPriceFor(carrier: string): number {
  return DEMO_METHODS.find((m) => m.carrier === normalizeCarrier(carrier))?.price ?? 5.9;
}

const DEMO_POINT_NAMES = [
  "Tabac Le Central",
  "Presse du Marche",
  "Superette Bio",
  "Librairie Papeterie",
];

const DEMO_POINT_STREETS = [
  { street: "Rue de la Republique", houseNumber: "12" },
  { street: "Avenue des Tilleuls", houseNumber: "4" },
  { street: "Place du Marche", houseNumber: "8" },
  { street: "Boulevard Voltaire", houseNumber: "27" },
];

function demoServicePoints(carrier: string, postalCode: string, city: string): ServicePoint[] {
  return DEMO_POINT_NAMES.map((name, index) => ({
    id: `demo-${postalCode || "00000"}-${index + 1}`,
    name,
    street: DEMO_POINT_STREETS[index].street,
    houseNumber: DEMO_POINT_STREETS[index].houseNumber,
    postalCode: postalCode || "75001",
    city: city || "Paris",
    country: "FR",
    distance: (index + 1) * 320,
    carrier: normalizeCarrier(carrier) || "mondial_relay",
    openingHours: [
      "Lundi: 09:00 - 19:00",
      "Mardi: 09:00 - 19:00",
      "Mercredi: 09:00 - 19:00",
      "Jeudi: 09:00 - 19:00",
      "Vendredi: 09:00 - 19:00",
      "Samedi: 09:00 - 13:00",
    ],
  }));
}

// ── Compte ──────────────────────────────────────────────────
export async function getAccount(): Promise<{
  ok: boolean;
  username?: string;
  email?: string;
  error?: string;
}> {
  const result = await sendcloudRequest<{ user?: { username?: string; email?: string } }>("/user");
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    username: result.data?.user?.username,
    email: result.data?.user?.email,
  };
}

// ── Methodes d'expedition ───────────────────────────────────
type RawShippingMethod = {
  id?: unknown;
  name?: unknown;
  carrier?: unknown;
  min_weight?: unknown;
  max_weight?: unknown;
  price?: unknown;
  service_point_input?: unknown;
  countries?: Array<{ iso_2?: unknown; price?: unknown }>;
};

function mapShippingMethod(raw: RawShippingMethod): SendcloudMethod | null {
  const id = toNumber(raw?.id);
  if (id === null) return null;

  const countryEntries = Array.isArray(raw.countries) ? raw.countries : [];
  const countries = countryEntries
    .map((c) => String(c?.iso_2 ?? "").toUpperCase())
    .filter((code) => code !== "");

  // Le prix peut etre absent au niveau racine : on prend celui de la France.
  const frEntry = countryEntries.find((c) => String(c?.iso_2 ?? "").toUpperCase() === "FR");
  const price = toNumber(raw.price) ?? toNumber(frEntry?.price);

  return {
    id,
    name: String(raw.name ?? `Methode ${id}`),
    carrier: normalizeCarrier(raw.carrier),
    price,
    minWeight: toNumber(raw.min_weight),
    maxWeight: toNumber(raw.max_weight),
    countries,
    requiresServicePoint: String(raw.service_point_input ?? "none").toLowerCase() === "required",
  };
}

export async function listShippingMethods(): Promise<{
  source: "sendcloud" | "demo";
  methods: SendcloudMethod[];
  error?: string;
}> {
  const creds = await getSendcloudCredentials();
  if (!creds.configured) return { source: "demo", methods: DEMO_METHODS };

  const result = await sendcloudRequest<{ shipping_methods?: RawShippingMethod[] }>(
    "/shipping_methods",
    { creds },
  );
  if (!result.ok) return { source: "demo", methods: DEMO_METHODS, error: result.error };

  const raw = Array.isArray(result.data?.shipping_methods) ? result.data.shipping_methods : [];
  const methods = raw
    .map(mapShippingMethod)
    .filter((m): m is SendcloudMethod => m !== null);

  return { source: "sendcloud", methods };
}

/** Ne garde que les methodes des 3 transporteurs supportes, livrables en France. */
export function filterFrenchCarrierMethods(methods: SendcloudMethod[]): SendcloudMethod[] {
  const supported = new Set(CARRIER_LIST.map((c) => c.code as string));
  return methods.filter(
    (m) =>
      supported.has(m.carrier) && (m.countries.length === 0 || m.countries.includes("FR")),
  );
}

// ── Points relais ───────────────────────────────────────────
type RawServicePoint = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  street?: unknown;
  house_number?: unknown;
  postal_code?: unknown;
  city?: unknown;
  country?: unknown;
  distance?: unknown;
  carrier?: unknown;
  formatted_opening_times?: unknown;
};

export async function searchServicePoints(input: {
  carrier: string;
  postalCode: string;
  city?: string;
  country?: string;
  radius?: number;
}): Promise<{ source: "sendcloud" | "demo"; points: ServicePoint[]; error?: string }> {
  const country = (input.country || "FR").toUpperCase();
  const creds = await getSendcloudCredentials();
  if (!creds.configured) {
    return { source: "demo", points: demoServicePoints(input.carrier, input.postalCode, input.city ?? "") };
  }

  const params = new URLSearchParams({
    country,
    postal_code: input.postalCode,
    carrier: normalizeCarrier(input.carrier),
    radius: String(input.radius ?? 5000),
  });
  if (input.city) params.set("city", input.city);

  const result = await sendcloudRequest<RawServicePoint[]>(
    `/service-points?${params.toString()}`,
    { base: SERVICE_POINTS_API, creds },
  );

  if (!result.ok) {
    return {
      source: "demo",
      points: demoServicePoints(input.carrier, input.postalCode, input.city ?? ""),
      error: result.error,
    };
  }

  const raw = Array.isArray(result.data) ? result.data : [];
  const points: ServicePoint[] = raw.map((p) => ({
    id: String(p?.id ?? p?.code ?? ""),
    name: String(p?.name ?? "Point relais"),
    street: String(p?.street ?? ""),
    houseNumber: String(p?.house_number ?? ""),
    postalCode: String(p?.postal_code ?? input.postalCode),
    city: String(p?.city ?? input.city ?? ""),
    country: String(p?.country ?? country),
    distance: toNumber(p?.distance),
    carrier: normalizeCarrier(p?.carrier ?? input.carrier),
    openingHours: parseOpeningHours(p?.formatted_opening_times),
  }));

  return { source: "sendcloud", points: points.filter((p) => p.id !== "") };
}

// ── Colis / etiquettes ──────────────────────────────────────
type RawParcel = {
  id?: unknown;
  tracking_number?: unknown;
  tracking_url?: unknown;
  status?: { id?: unknown; message?: unknown };
  label?: { normal_printer?: unknown; label_printer?: unknown };
};

function mapParcel(raw: RawParcel | null | undefined): Omit<ParcelResult, "ok" | "message"> & {
  status: string | null;
} {
  const labelUrls = Array.isArray(raw?.label?.normal_printer)
    ? (raw?.label?.normal_printer as unknown[])
    : [];
  const labelUrl =
    (labelUrls.length > 0 ? String(labelUrls[0]) : null) ??
    (raw?.label?.label_printer ? String(raw.label.label_printer) : null);

  return {
    parcelId: raw?.id !== undefined && raw?.id !== null ? String(raw.id) : null,
    trackingNumber: raw?.tracking_number ? String(raw.tracking_number) : null,
    trackingUrl: raw?.tracking_url ? String(raw.tracking_url) : null,
    labelUrl,
    status: raw?.status?.message ? String(raw.status.message) : null,
  };
}

export async function createParcel(input: {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  telephone?: string;
  orderNumber: string;
  weight: number;
  shippingMethodId: number;
  servicePointId?: string | null;
}): Promise<ParcelResult> {
  const creds = await getSendcloudCredentials();
  if (!creds.configured) {
    return {
      ok: false,
      message:
        "Sendcloud n'est pas configure. Renseignez vos cles API dans Parametres > Livraison Sendcloud.",
      parcelId: null,
      trackingNumber: null,
      trackingUrl: null,
      labelUrl: null,
    };
  }

  const { street, houseNumber } = splitStreet(input.address);
  const senderAddressId = Number.parseInt(creds.senderAddressId, 10);

  const parcelBody: Record<string, unknown> = {
    name: input.name || "Client",
    address: street,
    house_number: houseNumber,
    city: input.city || "",
    postal_code: input.postalCode || "",
    country: (input.country || "FR").slice(0, 2).toUpperCase() === "FR" ? "FR" : input.country,
    telephone: input.telephone || "",
    email: input.email,
    order_number: input.orderNumber,
    weight: input.weight.toFixed(3),
    request_label: true,
    shipment: { id: input.shippingMethodId },
  };
  if (Number.isFinite(senderAddressId) && senderAddressId > 0) {
    parcelBody.sender_address = senderAddressId;
  }
  if (input.servicePointId) {
    const numericPoint = Number.parseInt(input.servicePointId, 10);
    parcelBody.to_service_point = Number.isFinite(numericPoint) ? numericPoint : input.servicePointId;
  }

  const result = await sendcloudRequest<{ parcel?: RawParcel }>("/parcels", {
    method: "POST",
    body: { parcel: parcelBody },
    creds,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error,
      parcelId: null,
      trackingNumber: null,
      trackingUrl: null,
      labelUrl: null,
    };
  }

  const parcel = mapParcel(result.data?.parcel);
  return {
    ok: true,
    message: parcel.status ? `Etiquette creee (${parcel.status})` : "Etiquette creee",
    parcelId: parcel.parcelId,
    trackingNumber: parcel.trackingNumber,
    trackingUrl: parcel.trackingUrl,
    labelUrl: parcel.labelUrl,
  };
}

export async function getParcel(parcelId: string): Promise<{
  ok: boolean;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  status: string | null;
  error?: string;
}> {
  const result = await sendcloudRequest<{ parcel?: RawParcel }>(`/parcels/${parcelId}`);
  if (!result.ok) {
    return {
      ok: false,
      trackingNumber: null,
      trackingUrl: null,
      labelUrl: null,
      status: null,
      error: result.error,
    };
  }
  const parcel = mapParcel(result.data?.parcel);
  return { ok: true, ...parcel };
}
