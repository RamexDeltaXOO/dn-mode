import { asc, eq } from "drizzle-orm";
import { slugify } from "@contracts/constants";
import { products } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Slugs produits : toujours en minuscules, sans accents ni caracteres
 * speciaux. Le CRM les normalise a l'enregistrement ; au demarrage du
 * serveur (donc a chaque deploiement), ceux saisis avant sont corriges.
 */

/** Slug provisoire pose pendant une correction (jamais un slug valide). */
const TEMP_PREFIX = "__tmp__";

/** Slug d'un produit : celui saisi, normalise, sinon celui de son nom. */
export function productSlug(slug: string | null | undefined, name: string, id?: number): string {
  const fromSlug = slug && !slug.startsWith(TEMP_PREFIX) ? slugify(slug) : "";
  return fromSlug || slugify(name) || (id !== undefined ? `produit-${id}` : "produit");
}

export type SlugFix = { id: number; from: string; to: string };

/**
 * Corrections a apporter : chaque slug invalide devient sa version
 * normalisee, avec un suffixe -2, -3... s'il est deja pris. Les slugs deja
 * valides ne bougent jamais.
 */
export function planSlugFixes(rows: Array<{ id: number; slug: string; name: string }>): SlugFix[] {
  const isValid = (row: { id: number; slug: string; name: string }) =>
    row.slug === productSlug(row.slug, row.name, row.id);
  const taken = new Set(rows.filter(isValid).map((row) => row.slug));

  const fixes: SlugFix[] = [];
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    if (isValid(row)) continue;
    const base = productSlug(row.slug, row.name, row.id);
    let candidate = base;
    for (let n = 2; taken.has(candidate); n += 1) candidate = `${base}-${n}`;
    taken.add(candidate);
    fixes.push({ id: row.id, from: row.slug, to: candidate });
  }
  return fixes;
}

/** Corrige en base les slugs invalides. Sans correction a faire : une seule lecture. */
export async function normalizeProductSlugs(): Promise<SlugFix[]> {
  const db = getDb();
  const rows = await db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .orderBy(asc(products.id));
  const fixes = planSlugFixes(rows);
  if (fixes.length === 0) return fixes;

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

/**
 * Produit d'un slug d'URL. Un ancien slug ("Robe-Été") retrouve le produit
 * par sa version normalisee : les liens deja partages restent valides.
 */
export async function findProductBySlug(slug: string) {
  const db = getDb();
  const [exact] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (exact) return exact;
  const normalized = slugify(slug);
  if (!normalized || normalized === slug) return undefined;
  const [match] = await db.select().from(products).where(eq(products.slug, normalized)).limit(1);
  return match;
}
