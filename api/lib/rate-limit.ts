import { TRPCError } from "@trpc/server";

/**
 * Limiteur de debit en memoire (fenetre fixe), par instance du serveur.
 *
 * Il freine les tentatives de mot de passe en rafale et le spam des
 * formulaires publics. Avec plusieurs instances Cloud Run, chacune compte de
 * son cote : la limite reelle est un peu plus haute, ce qui reste suffisant
 * pour casser une attaque automatisee.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function consume(key: string, windowMs: number): Bucket {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket;
}

/** Compte un passage et dit s'il depasse la limite, sans lever d'erreur. */
export function overRateLimit(key: string, limit: number, windowMs: number): boolean {
  return consume(key, windowMs).count > limit;
}

/** Compte un passage ; leve TOO_MANY_REQUESTS au-dela de `limit` sur la fenetre. */
export function hitRateLimit(key: string, limit: number, windowMs: number): void {
  const bucket = consume(key, windowMs);
  if (bucket.count > limit) {
    const minutes = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Trop de tentatives. Reessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    });
  }
}

/** Remet un compteur a zero (connexion reussie, par exemple). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Adresse du client, telle que transmise par le proxy de Google. Le premier
 * element de X-Forwarded-For peut etre falsifie par le client : il sert a
 * repartir les compteurs, pas a authentifier qui que ce soit.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
}
