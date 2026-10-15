/**
 * Compresse les fichiers du site apres `vite build` : une version Brotli
 * (.br) et une version gzip (.gz) a cote de chaque fichier texte.
 * Le serveur (api/lib/vite.ts) envoie directement la version adaptee au
 * navigateur, sans compresser a chaque requete.
 */
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../dist/public");
const COMPRESSIBLE = /\.(js|mjs|css|svg|json|txt|xml|ico)$/;
// En dessous, l'en-tete de compression coute plus qu'il ne rapporte.
const MIN_BYTES = 1024;

let count = 0;
let before = 0;
let after = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      walk(file);
      continue;
    }
    if (!COMPRESSIBLE.test(name)) continue;
    const data = readFileSync(file);
    if (data.length < MIN_BYTES) continue;

    const br = brotliCompressSync(data, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      },
    });
    writeFileSync(`${file}.br`, br);
    writeFileSync(`${file}.gz`, gzipSync(data, { level: 9 }));
    count += 1;
    before += data.length;
    after += br.length;
  }
}

walk(root);
console.log(
  `precompress: ${count} fichiers, ${Math.round(before / 1024)} Ko -> ${Math.round(after / 1024)} Ko en Brotli`,
);
