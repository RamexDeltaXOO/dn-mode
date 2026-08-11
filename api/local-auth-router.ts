import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { SESSION_MAX_AGE_MS } from "@contracts/constants";
import { env } from "./lib/env";
import { TRPCError } from "@trpc/server";

// Password hashing using Web Crypto API (SHA-256 with salt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "dnmode-salt-2026-v2");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ── Jetons de session (JWT HS256 signes avec APP_SECRET) ────
export type TokenPayload = { sub: number; email: string; role: string; iat: number; exp: number };

const encoder = new TextEncoder();

/** En developpement APP_SECRET peut etre vide ; en production env.ts l'exige. */
function signingSecret(): string {
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
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
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
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
      }

      // Verify password
      const isValid = await verifyPassword(input.password, user.passwordHash || "");
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" });
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
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    if (!user) return null;

    return user;
  }),
});
