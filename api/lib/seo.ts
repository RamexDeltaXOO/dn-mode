import type { Context } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { ConfigKeys, HomeImageDefaults } from "@contracts/constants";
import {
  SeoDefaults,
  collectionSeo,
  contactSeo,
  formatPrice,
  homeSeo,
  isPrivatePath,
  pageTitle,
  plainText,
  productSeo,
} from "@contracts/seo";
import { collections, products } from "@db/schema";
import { getDb } from "../queries/connection";
import { getConfigValue } from "./site-config";
import { originFromRequest } from "./request-origin";

/**
 * Referencement de la boutique.
 *
 * Le site est une application React rendue dans le navigateur : sans aide,
 * le HTML recu par Google, Bing, WhatsApp ou Instagram ne contient que
 * `<div id="root"></div>`. Le serveur complete donc ce HTML pour chaque page :
 * titre, description, URL canonique, balises Open Graph (apercus de liens),
 * donnees structurees schema.org (fiche produit avec prix et stock, fil
 * d'Ariane) et un contenu de secours lisible sans JavaScript. Une adresse
 * inconnue repond 404 plutot qu'une page vide en 200.
 *
 * Il sert aussi /robots.txt et /sitemap.xml, generes depuis la base.
 */

export type SeoSettings = {
  siteName: string;
  description: string;
  /** Origine publique sans "/" final : https://dnmode.fr */
  baseUrl: string;
  instagramUrl: string;
  heroImage: string;
};

export async function getSeoSettings(req: Request): Promise<SeoSettings> {
  const [siteName, description, siteUrl, instagramUrl, heroImage] = await Promise.all([
    getConfigValue(ConfigKeys.siteName, { fallback: SeoDefaults.siteName }),
    getConfigValue(ConfigKeys.siteDescription, { fallback: SeoDefaults.description }),
    // Domaine officiel d'abord : une page ouverte via l'adresse technique
    // d'App Hosting doit quand meme designer dnmode.fr comme canonique.
    getConfigValue(ConfigKeys.siteUrl, { envKey: "PUBLIC_APP_URL" }),
    getConfigValue(ConfigKeys.instagramUrl),
    getConfigValue(ConfigKeys.homeHeroImage, { fallback: HomeImageDefaults.hero }),
  ]);
  return {
    siteName,
    description,
    baseUrl: (siteUrl || originFromRequest(req)).replace(/\/+$/, ""),
    instagramUrl,
    heroImage,
  };
}

/** URL absolue a partir d'un chemin du site ou d'une URL deja complete. */
export function absoluteUrl(baseUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type JsonLd = Record<string, unknown>;

export type PageMeta = {
  status: 200 | 404 | 503;
  title: string;
  description: string;
  /** Chemin canonique, sans domaine ni parametres. */
  path: string;
  noindex: boolean;
  type: "website" | "product";
  /** Image d'apercu, chemin ou URL. */
  image?: string;
  imageAlt?: string;
  product?: { price: string; inStock: boolean };
  jsonLd: JsonLd[];
  /** Contenu de secours (HTML) pour les robots qui n'executent pas le JavaScript. */
  fallback: string;
};

type Link = { href: string; label: string };

function fallbackHtml(input: { title: string; text?: string; extra?: string[]; links?: Link[] }): string {
  const parts = [`<h1>${escapeHtml(input.title)}</h1>`];
  if (input.text) parts.push(`<p>${escapeHtml(input.text)}</p>`);
  for (const line of input.extra ?? []) parts.push(`<p>${escapeHtml(line)}</p>`);
  if (input.links && input.links.length > 0) {
    const items = input.links
      .map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
      .join("");
    parts.push(`<ul>${items}</ul>`);
  }
  return parts.join("");
}

function breadcrumb(baseUrl: string, items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(baseUrl, item.path),
    })),
  };
}

/** Un lien Instagram reellement renseigne, pas la page d'accueil d'Instagram. */
function profileUrls(settings: SeoSettings): string[] {
  const url = settings.instagramUrl.trim();
  return /^https?:\/\/(www\.)?instagram\.com\/[^/?#]+/i.test(url) ? [url] : [];
}

function privatePage(path: string, settings: SeoSettings): PageMeta {
  const section = path.startsWith("/admin")
    ? "Administration"
    : path.startsWith("/checkout")
      ? "Commande"
      : "Connexion";
  return {
    status: 200,
    title: pageTitle(section, settings.siteName),
    description: settings.description,
    path,
    noindex: true,
    type: "website",
    jsonLd: [],
    fallback: "",
  };
}

function notFoundPage(path: string, settings: SeoSettings): PageMeta {
  return {
    status: 404,
    title: pageTitle("Page introuvable", settings.siteName),
    description: settings.description,
    path,
    noindex: true,
    type: "website",
    jsonLd: [],
    fallback: fallbackHtml({
      title: "Page introuvable",
      links: [{ href: "/", label: "Retour à l'accueil" }],
    }),
  };
}

/** Base indisponible : Google doit repasser plus tard, pas oublier la page. */
function unavailablePage(path: string, settings: SeoSettings): PageMeta {
  return { ...notFoundPage(path, settings), status: 503, title: settings.siteName, fallback: "" };
}

async function homePage(settings: SeoSettings): Promise<PageMeta> {
  const db = getDb();
  const list = await db
    .select({ name: collections.name, slug: collections.slug })
    .from(collections)
    .orderBy(asc(collections.sortOrder));
  const organizationId = `${settings.baseUrl}/#organization`;
  const sameAs = profileUrls(settings);
  return {
    status: 200,
    ...homeSeo({ siteName: settings.siteName, siteDescription: settings.description }),
    path: "/",
    noindex: false,
    type: "website",
    image: settings.heroImage,
    imageAlt: settings.siteName,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": organizationId,
        name: settings.siteName,
        url: `${settings.baseUrl}/`,
        logo: absoluteUrl(settings.baseUrl, SeoDefaults.logo),
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: settings.siteName,
        url: `${settings.baseUrl}/`,
        inLanguage: "fr-FR",
        publisher: { "@id": organizationId },
      },
    ],
    fallback: fallbackHtml({
      title: settings.siteName,
      text: settings.description,
      links: [
        { href: "/collections/all", label: "Tous les articles" },
        ...list.map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
        { href: "/contact", label: "Contact" },
      ],
    }),
  };
}

async function collectionPage(slug: string, settings: SeoSettings): Promise<PageMeta> {
  const db = getDb();
  const isAll = slug === "all";
  const [collection] = isAll
    ? [null]
    : await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
  if (collection === undefined) return notFoundPage(`/collections/${slug}`, settings);

  const filter = collection
    ? and(eq(products.isActive, true), eq(products.collectionId, collection.id))
    : eq(products.isActive, true);
  const items = await db
    .select({ name: products.name, slug: products.slug, images: products.images })
    .from(products)
    .where(filter)
    .limit(100);

  const seo = collectionSeo(collection, settings.siteName);
  const path = `/collections/${collection?.slug ?? "all"}`;
  const name = collection?.name ?? "Tous les articles";
  return {
    status: 200,
    ...seo,
    path,
    noindex: false,
    type: "website",
    image: collection?.image || items[0]?.images?.[0] || settings.heroImage,
    imageAlt: name,
    jsonLd: [breadcrumb(settings.baseUrl, [{ name: "Accueil", path: "/" }, { name, path }])],
    fallback: fallbackHtml({
      title: name,
      text: seo.description,
      links: items.map((p) => ({ href: `/products/${p.slug}`, label: p.name })),
    }),
  };
}

async function productPage(slug: string, settings: SeoSettings): Promise<PageMeta> {
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  // Un produit desactive dans le CRM sort des resultats de recherche.
  if (!product || product.isActive === false) return notFoundPage(`/products/${slug}`, settings);

  const [collection] = product.collectionId
    ? await db
        .select({ name: collections.name, slug: collections.slug })
        .from(collections)
        .where(eq(collections.id, product.collectionId))
        .limit(1)
    : [];

  const seo = productSeo(product, settings.siteName);
  const path = `/products/${product.slug}`;
  const url = absoluteUrl(settings.baseUrl, path);
  const images = (product.images ?? []).filter(Boolean).map((i) => absoluteUrl(settings.baseUrl, i));
  const price = Number.parseFloat(String(product.price)).toFixed(2);
  const inStock = (product.inventoryQuantity ?? 0) > 0;
  const parent = collection
    ? { name: collection.name, path: `/collections/${collection.slug}` }
    : { name: "Tous les articles", path: "/collections/all" };

  return {
    status: 200,
    ...seo,
    path,
    noindex: false,
    type: "product",
    image: images[0] ?? settings.heroImage,
    imageAlt: product.name,
    product: { price, inStock },
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: plainText(product.description, 5000) || seo.description,
        url,
        ...(images.length > 0 ? { image: images } : {}),
        ...(product.sku ? { sku: product.sku } : {}),
        brand: { "@type": "Brand", name: settings.siteName },
        offers: {
          "@type": "Offer",
          url,
          price,
          priceCurrency: SeoDefaults.currency,
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: settings.siteName },
        },
      },
      breadcrumb(settings.baseUrl, [
        { name: "Accueil", path: "/" },
        parent,
        { name: product.name, path },
      ]),
    ],
    fallback: fallbackHtml({
      title: product.name,
      text: formatPrice(product.price),
      extra: [plainText(product.description, 5000)].filter(Boolean),
      links: [{ href: parent.path, label: parent.name }],
    }),
  };
}

/** Balises de la page demandee. Ne leve jamais : au pire, des balises generiques. */
export async function resolvePageMeta(pathname: string, settings: SeoSettings): Promise<PageMeta> {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (isPrivatePath(path)) return privatePage(path, settings);

  try {
    if (path === "/") return await homePage(settings);
    if (path === "/contact") {
      return {
        status: 200,
        ...contactSeo(settings.siteName),
        path,
        noindex: false,
        type: "website",
        image: settings.heroImage,
        imageAlt: settings.siteName,
        jsonLd: [],
        fallback: fallbackHtml({ title: "Contact", text: contactSeo(settings.siteName).description }),
      };
    }

    const match = /^\/(collections|products)\/([^/]+)$/.exec(path);
    if (match) {
      let slug: string;
      try {
        slug = decodeURIComponent(match[2]);
      } catch {
        return notFoundPage(path, settings);
      }
      return match[1] === "collections"
        ? await collectionPage(slug, settings)
        : await productPage(slug, settings);
    }
  } catch (error) {
    console.error("[seo] page metadata failed", error);
    return unavailablePage(path, settings);
  }

  return notFoundPage(path, settings);
}

/** Balises <head> de la page, remplacant le bloc par defaut de index.html. */
export function renderHeadTags(page: PageMeta, settings: SeoSettings): string {
  const meta = (attr: "name" | "property", key: string, content: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    meta("name", "description", page.description),
  ];

  if (page.noindex || page.status !== 200) {
    tags.push(meta("name", "robots", "noindex, nofollow"));
  } else {
    tags.push(`<link rel="canonical" href="${escapeHtml(absoluteUrl(settings.baseUrl, page.path))}" />`);
  }

  tags.push(
    meta("property", "og:site_name", settings.siteName),
    meta("property", "og:locale", SeoDefaults.locale),
    meta("property", "og:type", page.type),
    meta("property", "og:title", page.title),
    meta("property", "og:description", page.description),
    meta("property", "og:url", absoluteUrl(settings.baseUrl, page.path)),
    meta("name", "twitter:card", page.image ? "summary_large_image" : "summary"),
  );
  if (page.image) {
    tags.push(meta("property", "og:image", absoluteUrl(settings.baseUrl, page.image)));
    if (page.imageAlt) tags.push(meta("property", "og:image:alt", page.imageAlt));
  }
  if (page.product) {
    tags.push(
      meta("property", "product:price:amount", page.product.price),
      meta("property", "product:price:currency", SeoDefaults.currency),
      meta("property", "product:availability", page.product.inStock ? "in stock" : "out of stock"),
    );
  }
  for (const data of page.jsonLd) {
    // "<" echappe : un nom de produit ne peut pas fermer la balise script.
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    tags.push(
      `<script type="application/ld+json" data-seo-path="${escapeHtml(page.path)}">${json}</script>`,
    );
  }
  return tags.join("\n    ");
}

const SEO_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;

/** Insere les balises de la page et son contenu de secours dans index.html. */
export function injectPageMeta(html: string, page: PageMeta, settings: SeoSettings): string {
  const head = renderHeadTags(page, settings);
  let out = SEO_BLOCK.test(html)
    ? html.replace(SEO_BLOCK, () => head)
    : html.replace(/<title>[\s\S]*?<\/title>/, "").replace("</head>", () => `    ${head}\n  </head>`);
  if (page.fallback) {
    out = out.replace(
      '<div id="root"></div>',
      () => `<div id="root"></div>\n    <noscript>${page.fallback}</noscript>`,
    );
  }
  return out;
}

/** Page HTML de l'application, completee pour la route demandee. */
export async function renderAppHtml(c: Context, html: string): Promise<Response> {
  const settings = await getSeoSettings(c.req.raw);
  const page = await resolvePageMeta(new URL(c.req.url).pathname, settings);
  return c.html(injectPageMeta(html, page, settings), page.status);
}

// ── robots.txt ──────────────────────────────────────────────

export function createRobotsHandler() {
  return async (c: Context) => {
    const { baseUrl } = await getSeoSettings(c.req.raw);
    // /api/ reste ouvert : Google doit pouvoir appeler l'API pour afficher
    // les produits, et les photos sont servies par /api/images/.
    const body = [
      "User-agent: *",
      "Disallow: /admin",
      "Disallow: /checkout",
      "Disallow: /auth/",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
      "",
    ].join("\n");
    return c.body(body, 200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
  };
}

// ── sitemap.xml ─────────────────────────────────────────────

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SitemapEntry = { path: string; lastmod?: Date | null; images?: string[] };

export function buildSitemap(baseUrl: string, entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lines = [`    <loc>${xmlEscape(absoluteUrl(baseUrl, entry.path))}</loc>`];
    if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>`);
    for (const image of entry.images ?? []) {
      lines.push(`    <image:image><image:loc>${xmlEscape(absoluteUrl(baseUrl, image))}</image:loc></image:image>`);
    }
    return `  <url>\n${lines.join("\n")}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function createSitemapHandler() {
  return async (c: Context) => {
    const { baseUrl } = await getSeoSettings(c.req.raw);
    try {
      const db = getDb();
      const [collectionList, productList] = await Promise.all([
        db.select({ slug: collections.slug }).from(collections).orderBy(asc(collections.sortOrder)),
        db
          .select({ slug: products.slug, images: products.images, updatedAt: products.updatedAt })
          .from(products)
          .where(eq(products.isActive, true)),
      ]);
      const entries: SitemapEntry[] = [
        { path: "/" },
        { path: "/collections/all" },
        ...collectionList.map((col) => ({ path: `/collections/${encodeURIComponent(col.slug)}` })),
        ...productList.map((p) => ({
          path: `/products/${encodeURIComponent(p.slug)}`,
          lastmod: p.updatedAt,
          images: (p.images ?? []).filter(Boolean),
        })),
        { path: "/contact" },
      ];
      return c.body(buildSitemap(baseUrl, entries), 200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
    } catch (error) {
      console.error("[seo] sitemap failed", error);
      return c.body("Sitemap indisponible", 503, { "Retry-After": "300" });
    }
  };
}
