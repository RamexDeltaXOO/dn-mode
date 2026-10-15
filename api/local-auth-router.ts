import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { SESSION_MAX_AGE_MS } from "@contracts/constants";
import { env } from "./lib/env";
import { TRPCError } from "@trpc/server";
import { hashPassword, needsRehash, verifyAgainstDecoy, verifyPassword } from "./lib/password";
import { clientIp, hitRateLimit, resetRateLimit } from "./lib/rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Champs du compte renvoyes au navigateur : jamais le hash du mot de passe. */
const publicUserFields = {
  id: users.id,
  email: users.email,
  name: users.name,
  avatar: users.avatar,
  role: users.role,
};

// ── Jetons de session (JWT HS256 signes avec APP_SECRET) ────
export type TokenPayload = { sub: number; email: string; role: string; iat: number; exp: number };

const encoder = new TextEncoder();

/** En developpement APP_SECRET peut etre vide ; en production env.ts l'exige. */
export function signingSecret(): string {
  return env.appSecret || "dnmode-dev-secret-do-not-use-in-production";
}

// Le tsconfig serveur n'inclut pas la lib DOM : on laisse TypeScript inferer
// le type de cle plutot que de nommer CryptoKey.
let cachedKey: ReturnType<typeof crypto.subtle.importKey> | null = null;
function getSigningKey() {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      "raw",
      encoder.encode(signingSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return cachedKey;
}

function b64url(input: string | Uint8Array): string {
  return Buffer.from(input as Uint8Array).toString("base64url");
}

export async function generateToken(
  userId: number,
  email: string,
  role: string,
): Promise<string> {
  const now = Date.now();
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: userId, email, role, iat: now, exp: now + SESSION_MAX_AGE_MS }),
  );
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), encoder.encode(data));
  return `${data}.${b64url(new Uint8Array(signature))}`;
}

/**
 * Verifie la signature HMAC du jeton avant d'en lire le contenu.
 * Sans cette verification, n'importe qui pourrait forger un jeton portant
 * l'identifiant d'un autre compte (y compris l'administrateur).
 */
export async function verifyLocalToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const data = `${parts[0]}.${parts[1]}`;
    const signature = Buffer.from(parts[2], "base64url");
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(),
      signature,
      encoder.encode(data),
    );
    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.sub !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(z.object({
      email: z.string().email().max(320),
      password: z.string().min(8, "Le mot de passe doit faire au moins 8 caracteres").max(200),
      name: z.string().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Freine la creation de comptes en masse.
      hitRateLimit(`register:${clientIp(ctx.req)}`, 5, ONE_HOUR);
      const db = getDb();

      // Check if email exists
      const existing = await db.select().from(users).where(eq(users.email, input.email));
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Email deja utilise" });
      }

      const passwordHash = await hashPassword(input.password);
      const unionId = `local_${crypto.randomUUID()}`;

      const result = await db.insert(users).values({
        unionId,
        email: input.email,
        name: input.name || input.email.split("@")[0],
        role: "user",
        provider: "local",
        passwordHash,
      });

      const userId = Number((result as unknown as Array<{ insertId: number }>)[0].insertId);
      const token = await generateToken(userId, input.email, "user");

      return { token, user: { id: userId, email: input.email, name: input.name, role: "user" } };
    }),

  loginPassword: publicQuery
    .input(z.object({
      email: z.string().email().max(320),
      password: z.string().min(1).max(200),
    }))
    .mutation(async ({ input, ctx }) => {
      // Essais de mots de passe en rafale : limites par compte vise et par
      // adresse IP. Le compteur du compte repart a zero apres une connexion.
      const accountKey = `login:${input.email.toLowerCase()}`;
      hitRateLimit(accountKey, 10, FIFTEEN_MINUTES);
      hitRateLimit(`login-ip:${clientIp(ctx.req)}`, 30, FIFTEEN_MINUTES);

      const db = getDb();

      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      if (!user) {
        await verifyAgainstDecoy(input.password);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
      }

      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
      }
      resetRateLimit(accountKey);

      // Ancien hash SHA-256 : converti en scrypt maintenant que le mot de
      // passe en clair est connu. Transparent pour le client.
      if (needsRehash(user.passwordHash)) {
        try {
          await db
            .update(users)
            .set({ passwordHash: await hashPassword(input.password) })
            .where(eq(users.id, user.id));
        } catch (error) {
          console.error("[auth] password rehash failed", error);
        }
      }

      const token = await generateToken(user.id, user.email || "", user.role);
      return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("x-local-auth-token");
    if (!authHeader) return null;

    const payload = await verifyLocalToken(authHeader);
    if (!payload) return null;

    const db = getDb();
    const [user] = await db.select(publicUserFields).from(users).where(eq(users.id, payload.sub));
    return user ?? null;
  }),
});
