/**
 * Titres et descriptions des pages, partages entre le serveur (balises
 * injectees dans le HTML initial, lu par Google et les apercus de liens) et
 * le navigateur (mise a jour lors de la navigation dans la boutique).
 */

export const SeoDefaults = {
  siteName: "DN MODE",
  description:
    "DN MODE, boutique de mode féminine en ligne : robes, ensembles, jupes, hijabs et burkinis. Paiement sécurisé, livraison en France métropolitaine.",
  locale: "fr_FR",
  currency: "EUR",
  logo: "/logo-dnmode.png",
} as const;

/** Longueur au-dela de laquelle Google tronque une description. */
const DESCRIPTION_MAX = 160;

/** Texte sur une ligne, coupe proprement entre deux mots. */
export function plainText(text: string | null | undefined, max = DESCRIPTION_MAX): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** "Robe AMINA | DN MODE", ou le nom du site seul pour l'accueil. */
export function pageTitle(title: string | null | undefined, siteName: string): string {
  const t = (title ?? "").trim();
  return t ? `${t} | ${siteName}` : siteName;
}

/** Prix au format "49,90 €". */
export function formatPrice(price: string | number): string {
  const value = Number.parseFloat(String(price));
  return `${(Number.isFinite(value) ? value : 0).toFixed(2).replace(".", ",")} €`;
}

export type PageSeo = { title: string; description: string };

/** Accueil : le nom du site suivi de ce qu'il vend, pour les recherches generiques. */
export function homeSeo(site: { siteName: string; siteDescription: string }): PageSeo {
  return {
    title: `${site.siteName} | Boutique de mode féminine en ligne`,
    description: plainText(site.siteDescription),
  };
}

export function productSeo(
  product: {
    name: string;
    price: string | number;
    description?: string | null;
    shortDescription?: string | null;
  },
  siteName: string,
): PageSeo {
  const text = plainText(product.shortDescription) || plainText(product.description);
  return {
    title: pageTitle(product.name, siteName),
    description:
      text ||
      plainText(
        `${product.name} à ${formatPrice(product.price)} chez ${siteName}. Paiement sécurisé, expédition sous 2 à 3 jours ouvrés.`,
      ),
  };
}

/** `collection` vaut null pour la page "Tous les articles". */
export function collectionSeo(
  collection: { name: string; description?: string | null } | null,
  siteName: string,
): PageSeo {
  if (!collection) {
    return {
      title: pageTitle("Tous les articles", siteName),
      description: plainText(
        `Tous les articles ${siteName} : robes, ensembles, jupes, hijabs et plus. Paiement sécurisé, livraison en France métropolitaine.`,
      ),
    };
  }
  return {
    title: pageTitle(collection.name, siteName),
    description:
      plainText(collection.description) ||
      plainText(
        `Découvrez la collection ${collection.name} de ${siteName}. Paiement sécurisé, livraison en France métropolitaine.`,
      ),
  };
}

export function contactSeo(siteName: string): PageSeo {
  return {
    title: pageTitle("Contact", siteName),
    description: plainText(
      `Une question sur une commande ou un article ? Écrivez à ${siteName}, nous vous répondons dans les plus brefs délais.`,
    ),
  };
}

/** Pages a ne jamais faire apparaitre dans les resultats de recherche. */
export function isPrivatePath(pathname: string): boolean {
  return /^\/(admin|checkout|login|auth)(\/|$)/.test(pathname);
}
