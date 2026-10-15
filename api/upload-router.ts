import { createRouter, adminQuery } from "./middleware";
import { UPLOAD_ALLOWED_TYPES, UPLOAD_MAX_BYTES } from "@contracts/constants";
import { getStorageConfig } from "./lib/storage";

/**
 * L'envoi du fichier lui-meme passe par la route Hono POST /api/upload
 * (tRPC ne transporte pas de binaire). Ce routeur ne sert qu'a renseigner
 * l'interface d'administration sur le stockage utilise : la base de donnees
 * par defaut, un service S3 quand ses identifiants sont renseignes.
 */
export const uploadRouter = createRouter({
  status: adminQuery.query(async () => {
    const config = await getStorageConfig();
    return {
      provider: config.configured ? ("s3" as const) : ("database" as const),
      bucket: config.configured ? config.bucket : null,
      maxBytes: UPLOAD_MAX_BYTES,
      allowedTypes: [...UPLOAD_ALLOWED_TYPES],
    };
  }),
});
