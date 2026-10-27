import { asc, eq } from "drizzle-orm";
import { ConfigKeys, slugify } from "@contracts/constants";
import { collections, products } from "@db/schema";
import { getDb } from "../queries/connection";
import { getConfigValues, setConfigValue } from "./site-config";

/**
 * Slugs des produits et des collections : toujours en minuscules, sans
 * accents ni caracteres speciaux. Le CRM les normalise a l'enregistrement ;
 * au demarrage du serveur (donc a chaque deploiement), ceux saisis avant
 * sont corriges.
 */

/** Slug provisoire pose pendant une correction (jamais un slug valide). */
const TEMP_PREFIX = "__tmp__";

/** "/collections/all" designe tous les articles : aucune collection ne peut le prendre. */
export const RESERVED_COLLECTION_SLUGS = ["all"];

/** Slug saisi, normalise, sinon celui du nom, sinon "<repli>-<id>". */
function entitySlug(slug: string | null | undefined, name: string, fallback: string, id?: number): string {
  const fromSlug = slug && !slug.startsWith(TEMP_PREFIX) ? slugify(slug) : "";
  return fromSlug || slugify(name) || (id !== undefined ? `${fallback}-${id}` : fallback);
}

export function productSlug(slug: string | null | undefined, name: string, id?: number): string {
  return entitySlug(slug, name, "produit", id);
}

export function collectionSlug(slug: string | null | undefined, name: string, id?: number): string {
  return entitySlug(slug, name, "collection", id);
}

export type SlugRow = { id: number; slug: string; name: string };
export type SlugFix = { id: number; from: string; to: string };

/**
 * Corrections a apporter : chaque slug invalide devient sa version
 * normalisee, avec un suffixe -2, -3... s'il est deja pris ou reserve. Les
 * slugs deja valides ne bougent jamais.
 */
export function planSlugFixes(
  rows: SlugRow[],
  toSlug: (row: SlugRow) => string = (row) => productSlug(row.slug, row.name, row.id),
  reserved: string[] = [],
): SlugFix[] {
  const blocked = new Set(reserved);
  const isValid = (row: SlugRow) => row.slug === toSlug(row) && !blocked.has(row.slug);
  const taken = new Set([...reserved, ...rows.filter(isValid).map((row) => row.slug)]);

  const fixes: SlugFix[] = [];
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    if (isValid(row)) continue;
    const base = toSlug(row);
    let candidate = base;
    for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}-${n}`;
    taken.add(candidate);
    fixes.push({ id: row.id, from: row.slug, to: candidate });
  }
  return fixes;
}

/** Corrige en base les slugs produits invalides. Rien a corriger : une seule lecture. */
export async function normalizeProductSlugs(): Promise<SlugFix[]> {
  const db = getDb();
  const rows = await db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .orderBy(asc(products.id));
  const fixes = planSlugFixes(rows);
  // En deux temps : MySQL compare souvent les textes sans tenir compte des
  // accents ni de la casse ("Robe-Été" = "robe-ete"), si bien qu'un slug
  // corrige pourrait heurter l'index unique d'un autre pas encore corrige.
  for (const fix of fixes) {
    await db.update(products).set({ slug: `${TEMP_PREFIX}${fix.id}` }).where(eq(products.id, fix.id));
  }
  for (const fix of fixes) {
    await db.update(products).set({ slug: fix.to }).where(eq(products.id, fix.id));
  }
  return fixes;
}

/** Reglages du site qui designent une collection par son slug. */
const COLLECTION_CONFIG_KEYS = [
  ConfigKeys.homeHeroCollection,
  ConfigKeys.homeProductsCollection,
  ConfigKeys.homeLookCollection,
];

/**
 * Corrige en base les slugs de collections invalides, ainsi que les liens de
 * la page d'accueil (Parametres > Textes du site) qui les designaient.
 */
export async function normalizeCollectionSlugs(): Promise<SlugFix[]> {
  const db = getDb();
  const rows = await db
    .select({ id: collections.id, slug: collections.slug, name: collections.name })
    .from(collections)
    .orderBy(asc(collections.id));
  const fixes = planSlugFixes(
    rows,
    (row) => collectionSlug(row.slug, row.name, row.id),
    RESERVED_COLLECTION_SLUGS,
  );
  if (fixes.length === 0) return fixes;

  for (const fix of fixes) {
    await db.update(collections).set({ slug: `${TEMP_PREFIX}${fix.id}` }).where(eq(collections.id, fix.id));
  }
  for (const fix of fixes) {
    await db.update(collections).set({ slug: fix.to }).where(eq(collections.id, fix.id));
  }

  // Compare en JavaScript, a l'octet pres : la collation MySQL confondrait
  // "Robe-Été" et "robe-ete".
  const settings = await getConfigValues(COLLECTION_CONFIG_KEYS);
  for (const key of COLLECTION_CONFIG_KEYS) {
    const fix = fixes.find((f) => f.from === (settings[key] ?? "").trim());
    if (fix) await setConfigValue(key, fix.to);
  }
  return fixes;
}

/** Ligne dont le slug d'URL est exact, sinon dont le slug vaut sa version normalisee. */
async function findBySlug<T>(slug: string, lookup: (value: string) => Promise<T | undefined>) {
  const exact = await lookup(slug);
  if (exact) return exact;
  const normalized = slugify(slug);
  return normalized && normalized !== slug ? lookup(normalized) : undefined;
}

/**
 * Produit d'un slug d'URL. Un ancien slug ("Robe-Été") retrouve le produit
 * par sa version normalisee : les liens deja partages restent valides.
 */
export async function findProductBySlug(slug: string) {
  const db = getDb();
  return findBySlug(slug, async (value) => {
    const [row] = await db.select().from(products).where(eq(products.slug, value)).limit(1);
    return row;
  });
}

/** Collection d'un slug d'URL, anciens slugs compris. */
export async function findCollectionBySlug(slug: string) {
  const db = getDb();
  return findBySlug(slug, async (value) => {
    const [row] = await db.select().from(collections).where(eq(collections.slug, value)).limit(1);
    return row;
  });
}
