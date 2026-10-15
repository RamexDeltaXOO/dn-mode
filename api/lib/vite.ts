import type { Context, Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { renderAppHtml } from "./seo";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  // Lu une fois : il ne change qu'a chaque deploiement.
  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
  const renderPage = (c: Context) => renderAppHtml(c, indexHtml);

  // L'accueil passe par le rendu SEO plutot que par le index.html brut que
  // servirait serveStatic.
  app.get("/", renderPage);
  app.get("/index.html", (c) => c.redirect("/", 301));

  app.use(
    "*",
    serveStatic({
      root: "./dist/public",
      // Versions .br / .gz produites au build par scripts/precompress.mjs.
      precompressed: true,
      onFound: (filePath, c) => {
        // Les fichiers de /assets portent un hash dans leur nom : un an de
        // cache sans risque. Les autres (logo, visuels) changent rarement.
        c.header(
          "Cache-Control",
          filePath.includes("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=86400",
        );
      },
    }),
  );

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    return renderPage(c);
  });
}
