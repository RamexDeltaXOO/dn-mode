/**
 * Tarif de livraison au poids et rattachement aux services Sendcloud.
 *
 * Une methode de livraison du CRM est une offre telle que le client la voit
 * ("Mondial Relay Point Relais"), avec une grille de prix selon le poids du
 * colis. Sendcloud, lui, decoupe chaque service en une methode par tranche de
 * poids ("Mondial Relay Point Relais 0.5-1kg") : ces tranches ne servent qu'a
 * creer l'etiquette, elles ne sont jamais proposees au client.
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

// ── Services Sendcloud ──────────────────────────────────────

/** Une methode Sendcloud, c'est-a-dire une tranche de poids d'un service (kg). */
export type SendcloudBracket = {
  id: number;
  name: string;
  minWeight: number | null;
  maxWeight: number | null;
  price: number | null;
};

/** Toutes les tranches de poids d'un meme produit Sendcloud. */
export type SendcloudService = {
  name: string;
  carrier: string;
  requiresServicePoint: boolean;
  /** Triees par poids maximal croissant. */
  brackets: SendcloudBracket[];
};

const WEIGHT_RANGE =
  /[\s([-]*\d+(?:[.,]\d+)?\s*(?:k?g)?\s*-\s*\d+(?:[.,]\d+)?\s*k?g[\s)\]]*$/i;

/** "Colissimo Home 0.5-0.75kg" -> "Colissimo Home". */
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
 * Plus le score est bas, plus le service est standard. Les variantes
 * (consigne, signature, QR code, retour) ne sont retenues que si on les
 * demande explicitement.
 */
function serviceRank(name: string): number {
  const value = name.toLowerCase();
  let rank = 0;
  if (/retour|return/.test(value)) rank += 10;
  if (/locker|consigne/.test(value)) rank += 4;
  if (/signature/.test(value)) rank += 2;
  if (/\bqr\b/.test(value)) rank += 1;
  return rank;
}

/** Poids maximal accepte par le service (kg), null s'il n'est pas borne. */
export function serviceMaxWeight(service: SendcloudService): number | null {
  if (service.brackets.length === 0 || service.brackets.some((b) => b.maxWeight === null)) {
    return null;
  }
  return Math.max(...service.brackets.map((b) => b.maxWeight as number));
}

function compareServices(a: SendcloudService, b: SendcloudService): number {
  return (
    a.carrier.localeCompare(b.carrier) ||
    Number(a.requiresServicePoint) - Number(b.requiresServicePoint) ||
    serviceRank(a.name) - serviceRank(b.name) ||
    (serviceMaxWeight(b) ?? Infinity) - (serviceMaxWeight(a) ?? Infinity) ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Regroupe les methodes Sendcloud (une par tranche de poids) en services.
 * Le resultat est trie : pour un transporteur et un mode donnes, le premier
 * service est celui que le choix automatique retient.
 */
export function groupSendcloudServices(
  methods: Array<SendcloudBracket & { carrier: string; requiresServicePoint: boolean }>,
): SendcloudService[] {
  const byKey = new Map<string, SendcloudService>();
  for (const method of methods) {
    const name = serviceNameOf(method.name);
    const key = `${method.carrier}|${method.requiresServicePoint}|${name.toLowerCase()}`;
    let service = byKey.get(key);
    if (!service) {
      service = {
        name,
        carrier: method.carrier,
        requiresServicePoint: method.requiresServicePoint,
        brackets: [],
      };
      byKey.set(key, service);
    }
    service.brackets.push({
      id: method.id,
      name: method.name,
      minWeight: method.minWeight,
      maxWeight: method.maxWeight,
      price: method.price,
    });
  }
  const services = [...byKey.values()];
  for (const service of services) {
    service.brackets.sort((a, b) => (a.maxWeight ?? Infinity) - (b.maxWeight ?? Infinity));
  }
  return services.sort(compareServices);
}

/**
 * Choisit le service Sendcloud d'une livraison : meme transporteur, meme mode
 * (domicile ou point relais). Les indices (service impose, nom de l'offre...)
 * sont essayes dans l'ordre ; a defaut, le service le plus standard l'emporte.
 */
export function pickSendcloudService(
  services: SendcloudService[],
  target: { carrier: string; servicePoint: boolean; hints?: Array<string | null | undefined> },
): SendcloudService | null {
  const candidates = services
    .filter((s) => s.carrier === target.carrier && s.requiresServicePoint === target.servicePoint)
    .sort(compareServices);
  for (const hint of target.hints ?? []) {
    if (!hint) continue;
    const wanted = serviceNameOf(hint);
    const match = candidates.find((s) => sameName(s.name, wanted));
    if (match) return match;
  }
  return candidates[0] ?? null;
}

/** Indices permettant de retrouver le service Sendcloud d'une offre du CRM. */
export function offerServiceHints(
  services: SendcloudService[],
  offer: { name: string; sendcloudMethodId?: number | null; config?: unknown },
): string[] {
  const hints: string[] = [];
  const { sendcloudService } = readMethodConfig(offer.config);
  if (sendcloudService) hints.push(sendcloudService);
  // Ligne creee par l'ancienne synchronisation, reliee a une tranche precise.
  if (offer.sendcloudMethodId) {
    const legacy = services.find((s) => s.brackets.some((b) => b.id === offer.sendcloudMethodId));
    if (legacy) hints.push(legacy.name);
  }
  hints.push(offer.name);
  return hints;
}

/**
 * Tranche Sendcloud a utiliser pour un colis : la premiere qui couvre son
 * poids. Un colis plus leger que la premiere tranche prend celle-ci ; plus
 * lourd que la derniere, aucune ne convient.
 */
export function pickBracket(service: SendcloudService, weightKg: number): SendcloudBracket | null {
  const fits = service.brackets.find(
    (b) =>
      (b.minWeight === null || weightKg >= b.minWeight) &&
      (b.maxWeight === null || weightKg <= b.maxWeight),
  );
  return fits ?? service.brackets.find((b) => b.maxWeight === null || weightKg <= b.maxWeight) ?? null;
}

/**
 * Grille de prix deduite des tarifs Sendcloud du service, les tranches
 * consecutives au meme prix etant fusionnees. Vide quand Sendcloud ne
 * communique pas de prix (contrat transporteur propre, par exemple).
 */
export function ratesFromService(service: SendcloudService): RateTier[] {
  const tiers: RateTier[] = [];
  for (const bracket of service.brackets) {
    if (bracket.price === null || bracket.price <= 0 || bracket.maxWeight === null) return [];
    const upToKg = round(bracket.maxWeight, 2);
    const price = round(bracket.price, 2);
    const last = tiers[tiers.length - 1];
    if (last && last.price === price) last.upToKg = upToKg;
    else tiers.push({ upToKg, price });
  }
  return tiers;
}
