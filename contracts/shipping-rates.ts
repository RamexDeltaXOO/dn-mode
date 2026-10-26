/**
 * Tarif de livraison au poids et rattachement aux options Sendcloud.
 *
 * Une methode de livraison du CRM est une offre telle que le client la voit
 * ("Mondial Relay Point Relais"), avec une grille de prix selon le poids du
 * colis. Elle est reliee a une option d'expedition Sendcloud, qui ne sert
 * qu'a creer l'etiquette.
 *
 * Module pur, partage entre le serveur et le CRM.
 */

// ── Grille de prix d'une offre ──────────────────────────────

/** Une tranche de la grille : `price` s'applique jusqu'a `upToKg` inclus. */
export type RateTier = { upToKg: number; price: number };

/** Contenu de la colonne `shipping_methods.config`. */
export type ShippingMethodConfig = {
  /** Grille triee par poids croissant. Vide : prix unique de l'offre. */
  rates: RateTier[];
  /** Service Sendcloud impose ("Colissimo Home"). Null : choix automatique. */
  sendcloudService: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Garde les tranches valides, triees, une seule par poids. */
export function normalizeRates(raw: unknown): RateTier[] {
  if (!Array.isArray(raw)) return [];
  const byWeight = new Map<number, number>();
  for (const entry of raw) {
    const tier = asObject(entry);
    const upToKg = toNumber(tier.upToKg);
    const price = toNumber(tier.price);
    if (upToKg === null || upToKg <= 0 || price === null || price < 0) continue;
    byWeight.set(round(upToKg, 3), round(price, 2));
  }
  return [...byWeight.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([upToKg, price]) => ({ upToKg, price }));
}

/** Lit la config stockee en base, en ignorant toute valeur mal formee. */
export function readMethodConfig(raw: unknown): ShippingMethodConfig {
  const config = asObject(raw);
  const service = typeof config.sendcloudService === "string" ? config.sendcloudService.trim() : "";
  return { rates: normalizeRates(config.rates), sendcloudService: service || null };
}

/** Applique une modification a la config existante sans perdre ses autres cles. */
export function writeMethodConfig(
  current: unknown,
  patch: { rates?: RateTier[]; sendcloudService?: string | null },
): Record<string, unknown> {
  const config = { ...asObject(current) };
  if (patch.rates !== undefined) config.rates = normalizeRates(patch.rates);
  if (patch.sendcloudService !== undefined) {
    const name = patch.sendcloudService?.trim();
    if (name) config.sendcloudService = name;
    else delete config.sendcloudService;
  }
  return config;
}

/**
 * Prix d'une offre pour un poids de colis. Sans grille, ou tant que le poids
 * n'est pas connu, c'est le prix unique de l'offre. Au-dela de la derniere
 * tranche, le prix de la derniere tranche s'applique : un colis lourd n'est
 * jamais bloque.
 */
export function priceForWeight(
  method: { price: unknown; config?: unknown },
  weightKg: number | null,
  fallback: number,
): number {
  const { rates } = readMethodConfig(method.config);
  if (rates.length > 0 && weightKg !== null) {
    return (rates.find((r) => weightKg <= r.upToKg) ?? rates[rates.length - 1]).price;
  }
  const base = toNumber(method.price);
  return base !== null && base >= 0 ? base : fallback;
}

// ── Options d'expedition Sendcloud ──────────────────────────

/**
 * Une option d'expedition Sendcloud (API v3) : un produit transporteur et ses
 * fonctionnalites ("Mondial Relay Point Relais"). Contrairement aux methodes
 * de l'API v2, une option couvre toutes les tranches de poids : Sendcloud
 * applique lui-meme le tarif du poids declare.
 */
export type SendcloudService = {
  /** Code a transmettre a l'annonce du colis ("mondial_relay:standard"). */
  code: string;
  name: string;
  /** Nom du produit, sans les options ("Colissimo Home"). */
  productName: string | null;
  /** Code transporteur interne (colissimo, chronopost, mondial_relay). */
  carrier: string;
  requiresServicePoint: boolean;
  /** Poids maximal accepte (kg), null s'il n'est pas communique. */
  maxWeight: number | null;
  /** Options qui ecartent l'option du choix automatique. */
  signature: boolean;
  locker: boolean;
  labelless: boolean;
  returns: boolean;
  ageCheck: boolean;
  insured: boolean;
};

const WEIGHT_RANGE =
  /[\s([-]*\d+(?:[.,]\d+)?\s*(?:k?g)?\s*-\s*\d+(?:[.,]\d+)?\s*k?g[\s)\]]*$/i;

/**
 * "Colissimo Home 0.5-0.75kg" -> "Colissimo Home". Sert a reconnaitre les
 * tranches importees par l'ancienne synchronisation (API v2) et a reutiliser
 * leur nom comme indice.
 */
export function serviceNameOf(methodName: string): string {
  const name = methodName.trim();
  const stripped = name.replace(WEIGHT_RANGE, "").replace(/[\s:,-]+$/, "").trim();
  return stripped || name;
}

/** Vrai pour une tranche importee telle quelle ("... 0.5-1kg"). */
export function hasWeightRange(methodName: string): boolean {
  return serviceNameOf(methodName) !== methodName.trim();
}

function sameName(a: string, b: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Plus le score est bas, plus l'option est standard. Les variantes
 * (consigne, signature, QR code sans etiquette, retour...) ne sont retenues
 * que si on les demande explicitement.
 */
function serviceRank(service: SendcloudService): number {
  const name = service.name.toLowerCase();
  let rank = 0;
  if (service.returns || /retour|return/.test(name)) rank += 10;
  if (service.locker || /locker|consigne/.test(name)) rank += 4;
  if (service.ageCheck) rank += 3;
  if (service.signature || /signature/.test(name)) rank += 2;
  if (service.labelless || /\bqr\b/.test(name)) rank += 1;
  if (service.insured) rank += 1;
  return rank;
}

function compareServices(a: SendcloudService, b: SendcloudService): number {
  return (
    a.carrier.localeCompare(b.carrier) ||
    Number(a.requiresServicePoint) - Number(b.requiresServicePoint) ||
    serviceRank(a) - serviceRank(b) ||
    (b.maxWeight ?? Infinity) - (a.maxWeight ?? Infinity) ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Trie les options : pour un transporteur et un mode donnes, la premiere est
 * celle que le choix automatique retient.
 */
export function sortServices(services: SendcloudService[]): SendcloudService[] {
  return [...services].sort(compareServices);
}

/**
 * Choisit l'option Sendcloud d'une livraison : meme transporteur, meme mode
 * (domicile ou point relais). Les indices (option imposee dans le CRM, nom de
 * l'offre, nom d'une ancienne tranche...) sont essayes dans l'ordre, par code
 * ou par nom ; a defaut, l'option la plus standard l'emporte.
 */
export function pickSendcloudService(
  services: SendcloudService[],
  target: { carrier: string; servicePoint: boolean; hints?: Array<string | null | undefined> },
): SendcloudService | null {
  const candidates = sortServices(
    services.filter((s) => s.carrier === target.carrier && s.requiresServicePoint === target.servicePoint),
  );
  for (const hint of target.hints ?? []) {
    if (!hint) continue;
    const wanted = serviceNameOf(hint);
    const match = candidates.find(
      (s) =>
        sameName(s.code, hint) ||
        sameName(s.name, wanted) ||
        (s.productName !== null && sameName(s.productName, wanted)),
    );
    if (match) return match;
  }
  return candidates[0] ?? null;
}

/** Indices permettant de retrouver l'option Sendcloud d'une offre du CRM. */
export function offerServiceHints(offer: { name: string; config?: unknown }): string[] {
  const { sendcloudService } = readMethodConfig(offer.config);
  return sendcloudService ? [sendcloudService, offer.name] : [offer.name];
}

/**
 * Grille de prix a partir de tarifs Sendcloud releves a plusieurs poids : les
 * poids consecutifs au meme prix sont fusionnes en une seule tranche.
 */
export function ratesFromQuotes(quotes: Array<{ upToKg: number; price: number | null }>): RateTier[] {
  const tiers: RateTier[] = [];
  for (const quote of [...quotes].sort((a, b) => a.upToKg - b.upToKg)) {
    if (quote.price === null || quote.price <= 0) continue;
    const upToKg = round(quote.upToKg, 2);
    const price = round(quote.price, 2);
    const last = tiers[tiers.length - 1];
    if (last && last.price === price) last.upToKg = upToKg;
    else tiers.push({ upToKg, price });
  }
  return tiers;
}
