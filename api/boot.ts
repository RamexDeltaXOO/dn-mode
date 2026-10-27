import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { securityHeaders } from "./lib/security-headers";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createGoogleCallbackHandler } from "./lib/google-oauth";
import { createImageHandler, createUploadHandler } from "./lib/storage";
import { ensureSchema } from "./lib/ensure-schema";
import { normalizeProductSlugs } from "./lib/product-slugs";
import { createStripeWebhookHandler } from "./lib/stripe-webhook";
import { createRobotsHandler, createSitemapHandler } from "./lib/seo";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

// Au-dessus de la plus grosse requete legitime (photo de 8 Mo) : une requete
// geante n'occupe pas la memoire du serveur pour rien.
app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));
app.use(securityHeaders);
// Pages HTML, reponses de l'API et sitemap compresses a la volee. Les
// fichiers statiques arrivent deja compresses (precompressed) et les images
// ne sont pas concernees.
app.use(compress());
// Connexion via Gmail (Google OAuth 2.0)
app.get(Paths.googleAuthCallback, createGoogleCallbackHandler());
// Upload des images produits (multipart, hors tRPC)
app.post(Paths.upload, createUploadHandler());
// Images gardees en base quand aucun stockage S3 n'est configure
app.get(`${Paths.images}/:id`, createImageHandler());
// Referencement : generes depuis la base a chaque demande
app.get("/robots.txt", createRobotsHandler());
app.get("/sitemap.xml", createSitemapHandler());
// Notifications de paiement envoyees par Stripe (signature verifiee)
app.post(Paths.stripeWebhook, createStripeWebhookHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ path, error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path ?? "?"} :`, error.cause ?? error);
      }
    },
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // Sans attendre : une base lente ne doit pas retarder le demarrage.
  // A chaque demarrage (donc a chaque deploiement), les slugs produits
  // invalides (majuscules, accents...) sont corriges en base.
  ensureSchema()
    .catch((err) => console.error("[schema]", err))
    .then(() => normalizeProductSlugs())
    .then((fixes) => {
      for (const fix of fixes) console.log(`[slugs] produit ${fix.id} : "${fix.from}" -> "${fix.to}"`);
    })
    .catch((err) => console.error("[slugs]", err));

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
