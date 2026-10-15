import { secureHeaders } from "hono/secure-headers";

/**
 * En-tetes de securite HTTP envoyes avec chaque reponse.
 *
 * La Content-Security-Policy limite ce que le navigateur accepte de charger
 * et d'executer sur le site : si un texte saisi quelque part parvenait a
 * glisser un script dans une page, il ne s'executerait pas et ne pourrait
 * rien envoyer ailleurs. Domaines Stripe repris de leur documentation
 * (https://docs.stripe.com/security/guide#content-security-policy), Link
 * compris, pour le paiement par carte, 3D Secure et les moyens de paiement
 * a redirection.
 *
 * En developpement, le HTML est servi par Vite (scripts en ligne pour le
 * rechargement a chaud) : ces en-tetes ne s'y appliquent pas.
 */

const STRIPE_SCRIPTS = ["https://js.stripe.com", "https://*.js.stripe.com", "https://maps.googleapis.com"];
const STRIPE_FRAMES = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
  "https://link.com",
  "https://*.link.com",
];
const STRIPE_CONNECT = [
  "https://api.stripe.com",
  "https://*.stripe.com",
  "https://maps.googleapis.com",
  "https://link.com",
  "https://*.link.com",
];

export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...STRIPE_SCRIPTS],
    connectSrc: ["'self'", ...STRIPE_CONNECT],
    frameSrc: ["'self'", ...STRIPE_FRAMES],
    // Photos produits : stockage en base, service S3 ou URL collee a la main.
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    // Attributs style de React, animations et styles injectes par Stripe.
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    // Personne ne peut afficher le site dans un cadre (clickjacking).
    frameAncestors: ["'none'"],
  },
  // Pas d'includeSubDomains : un sous-domaine sans HTTPS deviendrait injoignable.
  strictTransportSecurity: "max-age=31536000",
  referrerPolicy: "strict-origin-when-cross-origin",
  xFrameOptions: "DENY",
  // Fenetres de paiement (Link, portefeuilles) ouvertes depuis Stripe.
  crossOriginOpenerPolicy: "same-origin-allow-popups",
  // Photos et logo lisibles depuis les emails et les apercus de liens.
  crossOriginResourcePolicy: "cross-origin",
  // Pas de `payment` ici : Apple Pay et Google Pay en ont besoin dans les
  // cadres Stripe.
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
});
