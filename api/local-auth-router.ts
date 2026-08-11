import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
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

function generateToken(userId: number, email: string, role: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: userId, email, role, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const signature = btoa(`${header}.${payload}.dnmode-secret-key-2026`);
  return `${header}.${payload}.${signature}`;
}

export function verifyLocalToken(token: string): { sub: number; email: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
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
        passwordHash,
      });

      const userId = Number((result as any)[0].insertId);
      const token = generateToken(userId, input.email, "user");

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

      const token = generateToken(user.id, user.email || "", user.role);
      return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("x-local-auth-token");
    if (!authHeader) return null;

    const payload = verifyLocalToken(authHeader);
    if (!payload) return null;

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    if (!user) return null;

    return user;
  }),
});
