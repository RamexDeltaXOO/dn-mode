import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/|robots\.txt$|sitemap\.xml$).*$/] }),
    react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Bibliotheques qui changent rarement : un fichier a part, garde en
        // cache par le navigateur d'un deploiement a l'autre.
        manualChunks(id) {
          if (
            /node_modules\/(react|react-dom|scheduler|react-router|@tanstack|@trpc|superjson|copy-anything|is-what)\//.test(
              id,
            )
          ) {
            return "vendor";
          }
        },
      },
    },
  },
});
