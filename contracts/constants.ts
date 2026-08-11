export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
  googleAuthStart: "/api/auth/google",
  googleAuthCallback: "/api/auth/google/callback",
  authCallback: "/auth/callback",
} as const;

// ── Livraison ───────────────────────────────────────────────
// Seuil de livraison offerte : 100€ en France metropolitaine.
// Les valeurs peuvent etre surchargees depuis le CRM (site_config).
export const Shipping = {
  freeThreshold: 100,
  defaultCost: 5.9,
  zone: "France metropolitaine",
  bannerText: "Livraison offerte a partir de 100€ — En France metropolitaine",
} as const;

export function freeShippingBanner(threshold: number = Shipping.freeThreshold): string {
  return `Livraison offerte a partir de ${threshold}€ — En ${Shipping.zone}`;
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

  googleClientId: "gmail_client_id",
  googleClientSecret: "gmail_client_secret",

  resendApiKey: "resend_api_key",
  fromEmail: "from_email",
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
