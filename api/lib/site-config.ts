import { eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { siteConfig } from "@db/schema";

/**
 * Helpers de lecture/ecriture de la table `site_config`.
 *
 * Toutes les cles d'API (Stripe, Sendcloud, Google OAuth, Resend...) sont
 * stockees en base et editables depuis le CRM admin. Les variables
 * d'environnement servent uniquement de valeur de repli.
 */

const CACHE_TTL_MS = 15_000;

let cache: { values: Record<string, string>; expiresAt: number } | null = null;

function readCache(): Record<string, string> | null {
  if (!cache || cache.expiresAt < Date.now()) return null;
  return cache.values;
}

/** Invalide le cache local (a appeler apres chaque ecriture de config). */
export function invalidateConfigCache(): void {
  cache = null;
}

/** Charge toute la table de configuration (avec un petit cache memoire). */
export async function getAllConfig(): Promise<Record<string, string>> {
  const cached = readCache();
  if (cached) return cached;

  const values: Record<string, string> = {};
  try {
    const db = getDb();
    const rows = await db.select().from(siteConfig);
    for (const row of rows) {
      if (row.value !== null && row.value !== undefined) values[row.key] = row.value;
    }
  } catch {
    // Base indisponible : on retombe sur les variables d'environnement.
  }

  cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
  return values;
}

/**
 * Retourne la valeur d'une cle de config, avec repli sur une variable
 * d'environnement puis sur une valeur par defaut.
 */
export async function getConfigValue(
  key: string,
  opts: { envKey?: string; fallback?: string } = {},
): Promise<string> {
  const all = await getAllConfig();
  const fromDb = all[key];
  if (fromDb && fromDb.trim() !== "") return fromDb.trim();

  if (opts.envKey) {
    const fromEnv = process.env[opts.envKey];
    if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
  }

  return opts.fallback ?? "";
}

/** Lit plusieurs cles d'un coup (sans repli env). */
export async function getConfigValues(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (keys.length === 0) return out;
  try {
    const db = getDb();
    const rows = await db.select().from(siteConfig).where(inArray(siteConfig.key, keys));
    for (const row of rows) {
      if (row.value) out[row.key] = row.value;
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Ecrit (upsert) une cle de configuration. */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(siteConfig).where(eq(siteConfig.key, key));
  if (existing.length > 0) {
    await db.update(siteConfig).set({ value }).where(eq(siteConfig.key, key));
  } else {
    await db.insert(siteConfig).values({ key, value });
  }
  invalidateConfigCache();
}

/** Lit un nombre depuis la config (repli sur `fallback` si invalide). */
export async function getConfigNumber(
  key: string,
  fallback: number,
  opts: { envKey?: string } = {},
): Promise<number> {
  const raw = await getConfigValue(key, { envKey: opts.envKey });
  const parsed = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
