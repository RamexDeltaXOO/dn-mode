export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

/** Duree de validite d'un jeton de session (7 jours). */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const Paths = {
  login: "/login",
  googleAuthStart: "/api/auth/google",
  googleAuthCallback: "/api/auth/google/callback",
  authCallback: "/auth/callback",
  upload: "/api/upload",
} as const;

// ── Livraison ───────────────────────────────────────────────
// Seuil de livraison offerte : 100€ en France metropolitaine.
// Les valeurs peuvent etre surchargees depuis le CRM (site_config).
export const Shipping = {
  freeThreshold: 100,
  defaultCost: 5.9,
  zone: "France metropolitaine",
  bannerText: "Livraison offerte a partir de 100€ en France metropolitaine",
} as const;

export function freeShippingBanner(threshold: number = Shipping.freeThreshold): string {
  return `Livraison offerte a partir de ${threshold}€ en ${Shipping.zone}`;
}

// ── Cles de configuration (table site_config, editables via le CRM) ──
export const ConfigKeys = {
  siteName: "site_name",
  siteUrl: "site_url",
  siteDescription: "site_description",
  contactEmail: "contact_email",
  supportEmail: "support_email",
  instagramUrl: "instagram_url",
  currency: "currency",

  shippingThreshold: "shipping_threshold",
  shippingCost: "shipping_cost",

  stripePublishableKey: "stripe_publishable_key",
  stripeSecretKey: "stripe_secret_key",

  sendcloudPublicKey: "sendcloud_public_key",
  sendcloudSecretKey: "sendcloud_secret_key",
  sendcloudSenderAddressId: "sendcloud_sender_address_id",
  sendcloudDefaultWeight: "sendcloud_default_weight",
  sendcloudPackagingWeight: "sendcloud_packaging_weight",

  googleClientId: "gmail_client_id",
  googleClientSecret: "gmail_client_secret",

  storageEndpoint: "storage_endpoint",
  storageRegion: "storage_region",
  storageBucket: "storage_bucket",
  storageAccessKey: "storage_access_key",
  storageSecretKey: "storage_secret_key",
  storagePublicUrl: "storage_public_url",

  resendApiKey: "resend_api_key",
  fromEmail: "from_email",

  homeHeroImage: "home_hero_image",
  homeLookImage: "home_look_image",
} as const;

// ── Visuels de la page d'accueil ────────────────────────────
// Images livrees avec le site, affichees tant qu'aucune autre n'est
// choisie dans le CRM (Admin > Parametres > Page d'accueil).
export const HomeImageDefaults = {
  hero: "/hero-bg.jpg",
  look: "/look-moment.jpg",
} as const;

// ── Transporteurs supportes via Sendcloud ───────────────────
export const Carriers = {
  colissimo: "colissimo",
  chronopost: "chronopost",
  mondialRelay: "mondial_relay",
} as const;

export type CarrierCode = (typeof Carriers)[keyof typeof Carriers];

export const CARRIER_LIST: Array<{
  code: CarrierCode;
  label: string;
  sendcloudCarrier: string;
  servicePoint: boolean;
}> = [
  { code: "colissimo", label: "Colissimo (La Poste)", sendcloudCarrier: "colissimo", servicePoint: false },
  { code: "chronopost", label: "Chronopost", sendcloudCarrier: "chronopost", servicePoint: false },
  { code: "mondial_relay", label: "Mondial Relay", sendcloudCarrier: "mondial_relay", servicePoint: true },
];

export function carrierLabel(code: string): string {
  return CARRIER_LIST.find((c) => c.code === code)?.label ?? code;
}

export function carrierNeedsServicePoint(code: string): boolean {
  return CARRIER_LIST.find((c) => c.code === code)?.servicePoint ?? false;
}

// ── Poids ───────────────────────────────────────────────────
/** Poids unitaire retenu quand un produit n'en declare pas (grammes). */
export const DEFAULT_PRODUCT_WEIGHT_G = 500;

/** Poids de l'emballage ajoute au colis (grammes). */
export const DEFAULT_PACKAGING_WEIGHT_G = 100;

// ── Upload d'images produits ────────────────────────────────
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export const UPLOAD_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

// ── Cles des templates d'emails ─────────────────────────────
export const EmailTemplateKeys = {
  orderConfirmation: "order_confirmation",
  orderShipped: "order_shipped",
  orderDelivered: "order_delivered",
  orderCancelled: "order_cancelled",
  savAcknowledgement: "sav_acknowledgement",
  savReply: "sav_reply",
  welcome: "welcome",
} as const;

// ── Stock par variante ──────────────────────────────────────
// Stock saisi par combinaison couleur x taille, indexe par "couleur|taille".
// Un produit sans couleur (ou sans taille) utilise une chaine vide de ce cote.
export type VariantStock = Record<string, number>;

export function variantKey(color?: string | null, size?: string | null): string {
  return `${color ?? ""}|${size ?? ""}`;
}

/** Toutes les combinaisons attendues pour ces couleurs et tailles. */
export function variantKeys(colors: string[], sizes: string[]): string[] {
  const cs = colors.length > 0 ? colors : [""];
  const ss = sizes.length > 0 ? sizes : [""];
  return cs.flatMap((c) => ss.map((s) => variantKey(c, s)));
}

/**
 * Stock disponible pour une variante. Sans stock par variante saisi, on se
 * rabat sur le stock global du produit.
 */
export function stockFor(
  product: { inventoryQuantity?: number | null; variantStock?: VariantStock | null },
  color?: string | null,
  size?: string | null,
): number {
  const vs = product.variantStock;
  if (vs && Object.keys(vs).length > 0) return vs[variantKey(color, size)] ?? 0;
  return product.inventoryQuantity ?? 0;
}
