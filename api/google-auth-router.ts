import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  buildAuthUrl,
  buildRedirectUri,
  encodeState,
  getGoogleCredentials,
} from "./lib/google-oauth";

/** Origine de la requete courante (fonctionne en dev comme en production). */
function originFrom(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export const googleAuthRouter = createRouter({
  getConfig: publicQuery.query(async ({ ctx }) => {
    const creds = await getGoogleCredentials();
    const origin = originFrom(ctx.req.url);
    return {
      enabled: creds.enabled,
      clientId: creds.enabled ? creds.clientId : null,
      redirectUri: buildRedirectUri(origin),
    };
  }),

  getAuthUrl: publicQuery
    .input(z.object({ redirectTo: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const creds = await getGoogleCredentials();
      if (!creds.enabled) return { url: null };

      const origin = originFrom(ctx.req.url);
      return {
        url: buildAuthUrl({
          clientId: creds.clientId,
          redirectUri: buildRedirectUri(origin),
          state: encodeState(input.redirectTo ?? "/"),
        }),
      };
    }),
});
