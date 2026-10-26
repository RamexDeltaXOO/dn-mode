import { ConfigKeys, CARRIER_LIST } from "@contracts/constants";
import type { SendcloudService } from "@contracts/shipping-rates";
import { getConfigValue } from "./site-config";

/**
 * Client Sendcloud (sans dependance externe, base sur fetch).
 *
 * Sendcloud sert de passerelle unique vers Colissimo (La Poste), Chronopost
 * et Mondial Relay. Les options d'expedition et la creation des colis passent
 * par l'API v3 : la creation de colis en v2 est fermee aux comptes ouverts
 * depuis avril 2026. Les points relais et le suivi restent en v2. Les cles API se saisissent dans le CRM
 * (Admin > Parametres > Livraison Sendcloud) et sont stockees dans
 * `site_config` ; les variables d'environnement servent de repli.
 *
 * Toutes les fonctions renvoient un resultat "safe" : elles ne lancent jamais
 * d'exception, afin qu'une panne Sendcloud ne casse jamais le tunnel d'achat.
 * Sans cles configurees, on bascule sur un jeu de donnees de demonstration.
 */

const PANEL_API = "https://panel.sendcloud.sc/api/v2";
const V3_API = "https://panel.sendcloud.sc/api/v3";
const SERVICE_POINTS_API = "https://servicepoints.sendcloud.sc/api/v2";
const TIMEOUT_MS = 15_000;

// ── Types exposes ───────────────────────────────────────────
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
      return { ok: false, error: sendcloudErrorMessage(parsed, response.status), status: response.status };
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

// ── Erreurs ─────────────────────────────────────────────────
/** Message lisible d'une erreur Sendcloud : `error.message` en v2, `errors[]` en v3. */
export function sendcloudErrorMessage(parsed: unknown, status: number): string {
  const body = parsed as { error?: { message?: unknown }; errors?: unknown } | null;
  if (typeof body?.error?.message === "string" && body.error.message) return body.error.message;
  const details = (Array.isArray(body?.errors) ? body.errors : []).map(formatV3Error).filter(Boolean);
  return details.length > 0 ? details.join(" ; ") : `Erreur Sendcloud (${status})`;
}

/** "to_address/name : This field is required." */
function formatV3Error(raw: unknown): string {
  const error = raw as { detail?: unknown; title?: unknown; source?: { pointer?: unknown } } | null;
  const detail = String(error?.detail ?? error?.title ?? "").trim();
  if (!detail) return "";
  const pointer = typeof error?.source?.pointer === "string" ? error.source.pointer.replace(/^\//, "") : "";
  return pointer ? `${pointer} : ${detail}` : detail;
}

export function parcelFailure(message: string): ParcelResult {
  return { ok: false, message, parcelId: null, trackingNumber: null, trackingUrl: null, labelUrl: null };
}

// ── Utilitaires ─────────────────────────────────────────────
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
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
function demoService(
  code: string,
  name: string,
  carrier: string,
  requiresServicePoint: boolean,
): SendcloudService {
  return {
    code,
    name,
    productName: name,
    carrier,
    requiresServicePoint,
    maxWeight: 30,
    signature: false,
    locker: false,
    labelless: false,
    returns: false,
    ageCheck: false,
    insured: false,
  };
}

export const DEMO_SERVICES: SendcloudService[] = [
  demoService("colissimo:home", "Colissimo Domicile", "colissimo", false),
  demoService("chronopost:express", "Chronopost Express", "chronopost", false),
  demoService("mondial_relay:service_point", "Mondial Relay Point Relais", "mondial_relay", true),
];

const DEMO_PRICES: Record<string, number> = { colissimo: 5.9, chronopost: 9.9, mondial_relay: 4.5 };

/** Tarif de repli par transporteur, pour une offre creee sans prix. */
export function demoPriceFor(carrier: string): number {
  return DEMO_PRICES[normalizeCarrier(carrier)] ?? 5.9;
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

// ── Options d'expedition (API v3) ───────────────────────────
type RawWeight = { value?: unknown; unit?: unknown } | null | undefined;

function weightInKg(raw: RawWeight): number | null {
  const value = toNumber(raw?.value);
  if (value === null) return null;
  const unit = String(raw?.unit ?? "kg").toLowerCase();
  if (unit === "g") return value / 1000;
  if (unit === "lb" || unit === "lbs") return value * 0.45359237;
  if (unit === "oz") return value * 0.028349523;
  return value;
}

export type RawShippingOption = {
  code?: unknown;
  name?: unknown;
  carrier?: { code?: unknown; name?: unknown } | null;
  product?: { code?: unknown; name?: unknown } | null;
  functionalities?: Record<string, unknown> | null;
  weight?: { min?: RawWeight; max?: RawWeight } | null;
  requirements?: { is_service_point_required?: unknown } | null;
  quotes?: Array<{ price?: { total?: { value?: unknown } | null } | null } | null> | null;
};

const SERVICE_POINT_LAST_MILES = new Set(["service_point", "locker", "locker_or_service_point"]);

export function mapShippingOption(raw: RawShippingOption): SendcloudService | null {
  const code = typeof raw?.code === "string" ? raw.code.trim() : "";
  if (!code) return null;
  const functionalities = raw.functionalities ?? {};
  const lastMile = String(functionalities.last_mile ?? "").toLowerCase();
  const ageCheck = functionalities.age_check;
  return {
    code,
    name: String(raw.name ?? raw.product?.name ?? code),
    productName: raw.product?.name ? String(raw.product.name) : null,
    carrier: normalizeCarrier(raw.carrier?.code ?? code.split(":")[0]),
    requiresServicePoint:
      raw.requirements?.is_service_point_required === true || SERVICE_POINT_LAST_MILES.has(lastMile),
    maxWeight: weightInKg(raw.weight?.max),
    signature: functionalities.signature === true,
    locker: lastMile === "locker",
    labelless: functionalities.labelless === true,
    returns: functionalities.returns === true,
    ageCheck: ageCheck !== null && ageCheck !== undefined && ageCheck !== false,
    insured: (toNumber(functionalities.insurance) ?? 0) > 0,
  };
}

/** Cout Sendcloud du premier devis d'une option, s'il est communique. */
function quotePrice(raw: RawShippingOption): number | null {
  const quote = Array.isArray(raw.quotes) ? raw.quotes[0] : null;
  return positive(quote?.price?.total?.value);
}

export type ShippingOptionsQuery = {
  toPostalCode?: string | null;
  toCity?: string | null;
  /** Point relais choisi : seules les options qui le desservent sont renvoyees. */
  servicePointId?: string | null;
  /** Poids du colis : seules les options qui l'acceptent sont renvoyees. */
  weightKg?: number | null;
  /** Restreint a une option precise (devis). */
  code?: string;
  calculateQuotes?: boolean;
};

/** Corps de la recherche d'options : depuis et vers la France metropolitaine. */
export function shippingOptionsBody(query: ShippingOptionsQuery): Record<string, unknown> {
  const toAddress: Record<string, string> = { country_code: "FR" };
  if (query.toPostalCode) toAddress.postal_code = query.toPostalCode;
  if (query.toCity) toAddress.city = query.toCity;
  const body: Record<string, unknown> = {
    from_address: { country_code: "FR" },
    to_address: toAddress,
  };
  if (query.servicePointId) body.to_service_point = { id: String(query.servicePointId) };
  if (query.weightKg && query.weightKg > 0) {
    body.parcels = [{ weight: { value: query.weightKg.toFixed(3), unit: "kg" } }];
  }
  if (query.code) body.shipping_option_code = query.code;
  if (query.calculateQuotes) body.calculate_quotes = true;
  return body;
}

/** Options d'expedition du compte pour les transporteurs supportes. */
export async function listShippingOptions(query: ShippingOptionsQuery = {}): Promise<{
  source: "sendcloud" | "demo";
  services: SendcloudService[];
  error?: string;
}> {
  const creds = await getSendcloudCredentials();
  if (!creds.configured) return { source: "demo", services: DEMO_SERVICES };

  const result = await sendcloudRequest<{ data?: RawShippingOption[] | null }>("/shipping-options", {
    method: "POST",
    body: shippingOptionsBody(query),
    base: V3_API,
    creds,
  });
  if (!result.ok) return { source: "demo", services: DEMO_SERVICES, error: result.error };

  const supported = new Set(CARRIER_LIST.map((c) => c.code as string));
  const raw = Array.isArray(result.data?.data) ? result.data.data : [];
  const services = raw
    .map(mapShippingOption)
    .filter((s): s is SendcloudService => s !== null && supported.has(s.carrier));
  return { source: "sendcloud", services };
}

/** Cout Sendcloud d'une option pour un poids donne, null s'il n'est pas communique. */
export async function quoteShippingOption(code: string, weightKg: number): Promise<number | null> {
  const result = await sendcloudRequest<{ data?: RawShippingOption[] | null }>("/shipping-options", {
    method: "POST",
    body: shippingOptionsBody({ code, weightKg, calculateQuotes: true }),
    base: V3_API,
  });
  if (!result.ok) return null;
  const options = Array.isArray(result.data?.data) ? result.data.data : [];
  const option = options.find((o) => o?.code === code);
  return option ? quotePrice(option) : null;
}

// ── Expediteur ──────────────────────────────────────────────
export type RawSenderAddress = {
  id?: unknown;
  name?: unknown;
  company_name?: unknown;
  address_line_1?: unknown;
  address_line_2?: unknown;
  house_number?: unknown;
  postal_code?: unknown;
  city?: unknown;
  country_code?: unknown;
  email?: unknown;
  phone_number?: unknown;
};

/** Expediteur d'une annonce : l'adresse complete, ou sa reference Sendcloud. */
export type Sender = { fromAddress: Record<string, unknown>; brandId: number | null };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Adresse d'expedition au nom de la boutique seule. Une adresse Sendcloud
 * porte un contact ("Nawel Benhaj") et une entreprise ("DN MODE"), et les
 * deux s'impriment sur l'etiquette : on l'envoie complete, avec l'entreprise
 * comme nom. Null sans nom d'entreprise ou s'il manque un champ obligatoire.
 */
export function senderAsCompany(address: RawSenderAddress): Record<string, unknown> | null {
  const fields = {
    name: text(address.company_name),
    address_line_1: text(address.address_line_1),
    postal_code: text(address.postal_code),
    city: text(address.city),
    country_code: text(address.country_code).toUpperCase(),
  };
  if (Object.values(fields).some((value) => value === "")) return null;
  const optional: Record<string, string> = {
    house_number: text(address.house_number),
    address_line_2: text(address.address_line_2),
    email: text(address.email),
    phone_number: text(address.phone_number),
  };
  return {
    ...fields,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== "")),
  };
}

/**
 * Marque Sendcloud (logo des emails de suivi). Envoyee avec une adresse
 * complete, l'annonce n'applique plus celle de l'adresse d'expedition : on la
 * retrouve par son nom, ou on prend la seule marque du compte.
 */
async function findBrandId(name: string, creds: SendcloudCredentials): Promise<number | null> {
  const result = await sendcloudRequest<{ data?: Array<{ id?: unknown; name?: unknown }> }>("/brands", {
    base: V3_API,
    creds,
  });
  if (!result.ok) return null;
  const brands = Array.isArray(result.data?.data) ? result.data.data : [];
  const match =
    brands.find((b) => text(b?.name).toLowerCase() === name.toLowerCase()) ??
    (brands.length === 1 ? brands[0] : undefined);
  return toNumber(match?.id);
}

/**
 * Expediteur de l'etiquette : l'adresse saisie dans le CRM (par son ID),
 * sinon la premiere adresse francaise du compte Sendcloud. L'API v3 l'exige,
 * la v2 prenait d'office l'adresse par defaut du compte.
 */
export async function resolveSender(): Promise<{ sender: Sender | null; error?: string }> {
  const creds = await getSendcloudCredentials();
  const parsed = Number.parseInt(creds.senderAddressId, 10);
  const configured = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const byId = (id: number): Sender => ({ fromAddress: { sender_address_id: id }, brandId: null });

  const result = await sendcloudRequest<{ data?: RawSenderAddress[] }>("/addresses/sender-addresses", {
    base: V3_API,
    creds,
  });
  if (!result.ok) {
    // Liste illisible : l'ID saisi suffit encore a creer l'etiquette.
    return configured ? { sender: byId(configured) } : { sender: null, error: result.error };
  }

  const addresses = Array.isArray(result.data?.data) ? result.data.data : [];
  const chosen = configured
    ? addresses.find((a) => toNumber(a?.id) === configured)
    : (addresses.find((a) => text(a?.country_code).toUpperCase() === "FR") ?? addresses[0]);
  const id = configured ?? toNumber(chosen?.id);
  if (!id) return { sender: null };

  const company = chosen ? senderAsCompany(chosen) : null;
  if (!company) return { sender: byId(id) };
  return { sender: { fromAddress: company, brandId: await findBrandId(String(company.name), creds) } };
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

export type ShipmentInput = {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  telephone?: string;
  orderNumber: string;
  /** Poids du colis (kg). */
  weight: number;
  /** Code de l'option Sendcloud ("mondial_relay:standard"). */
  shippingOptionCode: string;
  servicePointId?: string | null;
  sender: Sender;
};

/** La boutique livre la France : le pays est stocke en toutes lettres ("France"). */
function countryCode(country: string): string {
  const value = (country || "").trim();
  if (!value || /^fr/i.test(value)) return "FR";
  return value.length === 2 ? value.toUpperCase() : value;
}

/** Corps de l'annonce d'un colis (API v3, POST /shipments/announce). */
export function buildShipmentBody(input: ShipmentInput): Record<string, unknown> {
  const { street, houseNumber } = splitStreet(input.address);
  const toAddress: Record<string, string> = {
    name: input.name || "Client",
    address_line_1: street,
    house_number: houseNumber,
    postal_code: input.postalCode,
    city: input.city,
    country_code: countryCode(input.country),
    email: input.email,
  };
  if (input.telephone) toAddress.phone_number = input.telephone;

  const body: Record<string, unknown> = {
    from_address: input.sender.fromAddress,
    to_address: toAddress,
    ship_with: {
      type: "shipping_option_code",
      properties: { shipping_option_code: input.shippingOptionCode },
    },
    order_number: input.orderNumber,
    parcels: [{ weight: { value: input.weight.toFixed(3), unit: "kg" } }],
  };
  if (input.servicePointId) body.to_service_point = { id: String(input.servicePointId) };
  if (input.sender.brandId) body.brand_id = input.sender.brandId;
  return body;
}

type RawShipment = {
  errors?: unknown;
  parcels?: Array<{
    id?: unknown;
    status?: { code?: unknown; message?: unknown } | null;
    tracking_number?: unknown;
    tracking_url?: unknown;
    documents?: Array<{ type?: unknown; document_type?: unknown; link?: unknown } | null> | null;
  } | null> | null;
};

/**
 * Lit la reponse d'une annonce. Un HTTP 201 ne suffit pas : si le
 * transporteur refuse le colis, la reponse porte le statut
 * ANNOUNCEMENT_FAILED et le detail dans `errors`.
 */
export function readShipmentResult(raw: RawShipment | null | undefined): ParcelResult {
  const parcel = Array.isArray(raw?.parcels) ? raw.parcels[0] : null;
  const errors = (Array.isArray(raw?.errors) ? raw.errors : []).map(formatV3Error).filter(Boolean);
  const status = String(parcel?.status?.code ?? "").toUpperCase();
  const failed =
    !parcel || status === "ANNOUNCEMENT_FAILED" || (errors.length > 0 && !parcel.tracking_number);
  if (failed) {
    return parcelFailure(
      errors.length > 0
        ? `Sendcloud a refuse le colis : ${errors.join(" ; ")}`
        : "Sendcloud n'a pas pu annoncer le colis au transporteur.",
    );
  }

  const parcelId = parcel.id !== undefined && parcel.id !== null ? String(parcel.id) : null;
  const documents = Array.isArray(parcel.documents) ? parcel.documents : [];
  const label = documents.find((d) => d?.document_type === "label" || d?.type === "label");
  const statusMessage = parcel.status?.message ? String(parcel.status.message) : null;
  return {
    ok: true,
    message: statusMessage ? `Etiquette creee (${statusMessage})` : "Etiquette creee",
    parcelId,
    trackingNumber: parcel.tracking_number ? String(parcel.tracking_number) : null,
    trackingUrl: parcel.tracking_url ? String(parcel.tracking_url) : null,
    labelUrl: label?.link
      ? String(label.link)
      : parcelId
        ? `${V3_API}/parcels/${parcelId}/documents/label`
        : null,
  };
}

/** Cree le colis et son etiquette (annonce synchrone, API v3). */
export async function announceShipment(input: ShipmentInput): Promise<ParcelResult> {
  const creds = await getSendcloudCredentials();
  if (!creds.configured) {
    return parcelFailure(
      "Sendcloud n'est pas configure. Renseignez vos cles API dans Parametres > Livraison Sendcloud.",
    );
  }
  const result = await sendcloudRequest<{ data?: RawShipment }>("/shipments/announce", {
    method: "POST",
    body: buildShipmentBody(input),
    base: V3_API,
    creds,
  });
  if (!result.ok) return parcelFailure(result.error);
  return readShipmentResult(result.data?.data);
}

/**
 * Telecharge le PDF d'une etiquette. Les liens Sendcloud exigent les cles
 * API : le CRM passe donc par le serveur, et seuls les liens de l'API
 * Sendcloud sont suivis, pour ne jamais envoyer les cles ailleurs.
 */
export async function fetchLabelPdf(
  url: string,
): Promise<{ ok: true; base64: string } | { ok: false; error: string }> {
  if (!url.startsWith("https://panel.sendcloud.sc/api/")) {
    return { ok: false, error: "Lien d'etiquette inattendu." };
  }
  const creds = await getSendcloudCredentials();
  if (!creds.configured) return { ok: false, error: "Sendcloud n'est pas configure." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Authorization: authHeader(creds), Accept: "application/pdf" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      return { ok: false, error: sendcloudErrorMessage(parsed, response.status) };
    }
    return { ok: true, base64: Buffer.from(await response.arrayBuffer()).toString("base64") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur reseau" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Suivi d'un colis (API v2, toujours ouverte, y compris pour les colis crees en v3). */
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
