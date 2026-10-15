import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hachage des mots de passe : scrypt, sel aleatoire propre a chaque compte.
 *
 * Format stocke : "scrypt$N$r$p$<sel base64>$<hash base64>". Les parametres
 * voyagent avec le hash, on peut donc les durcir plus tard sans casser les
 * comptes existants.
 *
 * Les comptes crees avant ce changement ont un SHA-256 a sel commun, cassable
 * en quelques heures en cas de fuite de la base. Ils restent acceptes, puis
 * sont convertis a la premiere connexion reussie (voir needsRehash) : aucune
 * reinitialisation n'est demandee aux clients.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
// 128 * N * R = 32 Mo : au-dessus de la limite par defaut de Node.
const MAX_MEMORY = 64 * 1024 * 1024;

// Chaque calcul occupe 32 Mo : au-dela de 4 en parallele, les suivants
// attendent leur tour. Un afflux de tentatives de connexion ralentit les
// reponses au lieu de saturer la memoire du serveur.
const MAX_CONCURRENT = 4;
let running = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve));
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    queue.shift()?.();
  }
}

function scryptAsync(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return withSlot(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
      }),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEMORY });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Ancien format : SHA-256 hexadecimal avec un sel identique pour tous. */
function legacyHash(password: string): string {
  return createHash("sha256").update(`${password}dnmode-salt-2026-v2`).digest("hex");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash ?? "", "base64");
    if (expected.length === 0) return false;
    try {
      const key = await scryptAsync(password, Buffer.from(salt ?? "", "base64"), expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: MAX_MEMORY,
      });
      return safeEqual(key, expected);
    } catch {
      return false;
    }
  }

  if (/^[0-9a-f]{64}$/.test(stored)) {
    return safeEqual(Buffer.from(legacyHash(password), "hex"), Buffer.from(stored, "hex"));
  }
  return false;
}

/** Vrai pour un hash a reecrire au format actuel apres une connexion reussie. */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored?.startsWith("scrypt$")) return true;
  const [, n, r, p] = stored.split("$");
  return Number(n) !== N || Number(r) !== R || Number(p) !== P;
}

// Hash calcule une fois, compare quand l'email est inconnu : la reponse prend
// alors le meme temps, sans reveler si un compte existe.
let decoy: Promise<string> | null = null;
export async function verifyAgainstDecoy(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoy);
}
