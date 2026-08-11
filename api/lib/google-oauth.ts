import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { ConfigKeys, Paths } from "@contracts/constants";
import type { User } from "@db/schema";
import { users } from "@db/schema";
import { getConfigValue } from "./site-config";
import { getDb } from "../queries/connection";
import { generateToken } from "../local-auth-router";

/**
 * Connexion via Gmail (Google OAuth 2.0).
 *
 * Le Client ID / Client Secret se saisissent dans le CRM
 * (Admin > Parametres > Connexion Gmail) et sont stockes dans `site_config` ;
 * les variables d'environnement GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * servent de repli.
 *
 * URI de redirection a declarer dans la console Google Cloud :
 *   https://<domaine>/api/auth/google/callback
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleCredentials = {
  clientId: string;
  clientSecret: string;
  enabled: boolean;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  const clientId = await getConfigValue(ConfigKeys.googleClientId, {
    envKey: "GOOGLE_CLIENT_ID",
  });
  const clientSecret = await getConfigValue(ConfigKeys.googleClientSecret, {
    envKey: "GOOGLE_CLIENT_SECRET",
  });
  return { clientId, clientSecret, enabled: clientId !== "" && clientSecret !== "" };
}

export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}${Paths.googleAuthCallback}`;
}

export function buildAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state: input.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ── State (protege contre les redirections ouvertes) ────────
export function encodeState(redirectTo: string): string {
  return Buffer.from(JSON.stringify({ redirectTo: sanitizeRedirect(redirectTo) })).toString(
    "base64url",
  );
}

export function decodeState(state: string): string {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      redirectTo?: unknown;
    };
    return sanitizeRedirect(String(parsed.redirectTo ?? "/"));
  } catch {
    return "/";
  }
}

/** N'autorise que les chemins internes ("/quelque-chose"), jamais une URL absolue. */
export function sanitizeRedirect(value: string): string {
  if (!value || typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

// ── Echange du code + profil ────────────────────────────────
export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string } | null> {
  const creds = await getGoogleCredentials();
  if (!creds.enabled) return null;

  try {
    const body = new URLSearchParams({
      code: input.code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error("[google-oauth] token exchange failed", response.status);
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) return null;
    return { accessToken: data.access_token };
  } catch (error) {
    console.error("[google-oauth] token exchange error", error);
    return null;
  }
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!data.sub || !data.email) return null;

    return {
      sub: data.sub,
      email: data.email,
      emailVerified: data.email_verified !== false,
      name: data.name ?? null,
      picture: data.picture ?? null,
    };
  } catch (error) {
    console.error("[google-oauth] profile fetch error", error);
    return null;
  }
}

// ── Utilisateur ─────────────────────────────────────────────
/**
 * Retrouve ou cree le compte associe au profil Google.
 * Si un compte local existe deja avec le meme email, on le relie au compte
 * Google plutot que de creer un doublon.
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<User | null> {
  try {
    const db = getDb();

    const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, profile.sub));
    if (byGoogleId) {
      await db
        .update(users)
        .set({
          name: byGoogleId.name ?? profile.name,
          avatar: profile.picture ?? byGoogleId.avatar,
          lastSignInAt: new Date(),
        })
        .where(eq(users.id, byGoogleId.id));
      return { ...byGoogleId, avatar: profile.picture ?? byGoogleId.avatar };
    }

    const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email));
    if (byEmail) {
      await db
        .update(users)
        .set({
          googleId: profile.sub,
          provider: "google",
          avatar: byEmail.avatar ?? profile.picture,
          name: byEmail.name ?? profile.name,
          lastSignInAt: new Date(),
        })
        .where(eq(users.id, byEmail.id));
      return { ...byEmail, googleId: profile.sub, provider: "google" };
    }

    const result = await db.insert(users).values({
      unionId: `google_${profile.sub}`,
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      avatar: profile.picture,
      googleId: profile.sub,
      provider: "google",
      role: "user",
    });

    const insertedId = Number((result as unknown as Array<{ insertId: number }>)[0].insertId);
    const [created] = await db.select().from(users).where(eq(users.id, insertedId));
    return created ?? null;
  } catch (error) {
    console.error("[google-oauth] user upsert error", error);
    return null;
  }
}

// ── Callback Hono ───────────────────────────────────────────
export function createGoogleCallbackHandler() {
  return async (c: Context) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      return c.redirect(`${Paths.login}?error=google_denied`, 302);
    }
    if (!code) {
      return c.redirect(`${Paths.login}?error=google_missing_code`, 302);
    }

    try {
      const origin = new URL(c.req.url).origin;
      const redirectUri = buildRedirectUri(origin);
      const redirectTo = state ? decodeState(state) : "/";

      const token = await exchangeCode({ code, redirectUri });
      if (!token) return c.redirect(`${Paths.login}?error=google_token`, 302);

      const profile = await fetchGoogleProfile(token.accessToken);
      if (!profile) return c.redirect(`${Paths.login}?error=google_profile`, 302);
      if (!profile.emailVerified) {
        return c.redirect(`${Paths.login}?error=google_unverified`, 302);
      }

      const user = await findOrCreateGoogleUser(profile);
      if (!user) return c.redirect(`${Paths.login}?error=google_account`, 302);

      const sessionToken = generateToken(user.id, user.email ?? profile.email, user.role);

      // Le jeton passe par le FRAGMENT d'URL : il n'est ni journalise par les
      // proxies ni envoye au serveur lors de la redirection finale.
      return c.redirect(
        `${Paths.authCallback}#token=${encodeURIComponent(sessionToken)}&redirect=${encodeURIComponent(redirectTo)}`,
        302,
      );
    } catch (err) {
      console.error("[google-oauth] callback failed", err);
      return c.redirect(`${Paths.login}?error=google_failed`, 302);
    }
  };
}
