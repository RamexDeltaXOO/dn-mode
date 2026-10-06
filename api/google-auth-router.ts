import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  buildAuthUrl,
  buildRedirectUri,
  encodeState,
  getGoogleCredentials,
} from "./lib/google-oauth";
import { originFromRequest } from "./lib/request-origin";

export const googleAuthRouter = createRouter({
  getConfig: publicQuery.query(async ({ ctx }) => {
    const creds = await getGoogleCredentials();
    const origin = originFromRequest(ctx.req);
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

      // L'URI envoyee ici doit etre identique, au caractere pres, a celle que
      // le callback reconstruira, d'ou la source commune originFromRequest.
      return {
        url: buildAuthUrl({
          clientId: creds.clientId,
          redirectUri: buildRedirectUri(originFromRequest(ctx.req)),
          state: encodeState(input.redirectTo ?? "/"),
        }),
      };
    }),
});
