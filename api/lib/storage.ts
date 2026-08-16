import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  ConfigKeys,
  UPLOAD_ALLOWED_TYPES,
  UPLOAD_MAX_BYTES,
} from "@contracts/constants";
import { users } from "@db/schema";
import { getConfigValue } from "./site-config";
import { getDb } from "../queries/connection";
import { verifyLocalToken } from "../local-auth-router";

/**
 * Stockage des images produits sur un service compatible S3.
 *
 * Fonctionne avec Google Cloud Storage (mode interoperabilite S3),
 * Cloudflare R2, Scaleway Object Storage, MinIO... Les identifiants se
 * saisissent dans le CRM (Admin > Parametres > Stockage des images).
 *
 * Le fichier transite par le serveur plutot que par une URL pre-signee :
 * cela evite d'avoir a configurer le CORS du bucket, au prix d'un passage
 * en memoire acceptable pour des photos de moins de 8 Mo.
 */

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
  configured: boolean;
};

export async function getStorageConfig(): Promise<StorageConfig> {
  const endpoint = await getConfigValue(ConfigKeys.storageEndpoint, { envKey: "STORAGE_ENDPOINT" });
  const region = await getConfigValue(ConfigKeys.storageRegion, {
    envKey: "STORAGE_REGION",
    fallback: "auto",
  });
  const bucket = await getConfigValue(ConfigKeys.storageBucket, { envKey: "STORAGE_BUCKET" });
  const accessKey = await getConfigValue(ConfigKeys.storageAccessKey, { envKey: "STORAGE_ACCESS_KEY" });
  const secretKey = await getConfigValue(ConfigKeys.storageSecretKey, { envKey: "STORAGE_SECRET_KEY" });
  const publicUrl = await getConfigValue(ConfigKeys.storagePublicUrl, { envKey: "STORAGE_PUBLIC_URL" });

  return {
    endpoint,
    region,
    bucket,
    accessKey,
    secretKey,
    publicUrl,
    configured: endpoint !== "" && bucket !== "" && accessKey !== "" && secretKey !== "",
  };
}

/** URL publique finale d'un objet stocke. */
function publicUrlFor(config: StorageConfig, key: string): string {
  const base = config.publicUrl
    ? config.publicUrl.replace(/\/+$/, "")
    : `${config.endpoint.replace(/\/+$/, "")}/${config.bucket}`;
  return `${base}/${key}`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Nom d'objet non devinable, sans caractere problematique. */
function buildObjectKey(fileName: string, contentType: string): string {
  const ext = EXTENSIONS[contentType] ?? "bin";
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
  return `produits/${base}-${nanoid(10)}.${ext}`;
}

export type UploadResult =
  | { ok: true; url: string; key: string }
  | { ok: false; error: string; status: number };

export async function uploadImage(input: {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
}): Promise<UploadResult> {
  const config = await getStorageConfig();
  if (!config.configured) {
    return {
      ok: false,
      status: 503,
      error:
        "Stockage non configure — renseignez vos identifiants dans Parametres > Stockage des images.",
    };
  }

  if (!(UPLOAD_ALLOWED_TYPES as readonly string[]).includes(input.contentType)) {
    return {
      ok: false,
      status: 415,
      error: "Format non supporte. Utilisez JPEG, PNG, WebP ou AVIF.",
    };
  }

  if (input.bytes.byteLength > UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Image trop lourde (max ${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))} Mo).`,
    };
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint,
      // Indispensable pour les services compatibles S3 autres qu'AWS :
      // sans cela le SDK prefixe le bucket au nom de domaine.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });

    const key = buildObjectKey(input.fileName, input.contentType);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: input.bytes,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return { ok: true, url: publicUrlFor(config, key), key };
  } catch (error) {
    console.error("[storage] upload failed", error);
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Echec de l'envoi vers le stockage",
    };
  }
}

/** Verifie le jeton de session et exige le role administrateur. */
async function requireAdmin(headers: Headers): Promise<boolean> {
  const token = headers.get("x-local-auth-token");
  if (!token) return false;

  const payload = await verifyLocalToken(token);
  if (!payload) return false;

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    // Le role est relu en base : jamais celui porte par le jeton.
    return user?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Route Hono POST /api/upload — multipart/form-data, champ `file`.
 * L'upload ne passe pas par tRPC, qui ne transporte pas de binaire.
 */
export function createUploadHandler() {
  return async (c: Context) => {
    if (!(await requireAdmin(c.req.raw.headers))) {
      return c.json({ error: "Acces reserve aux administrateurs" }, 403);
    }

    let file: unknown;
    try {
      const body = await c.req.parseBody();
      file = body["file"];
    } catch {
      return c.json({ error: "Requete illisible" }, 400);
    }

    if (!(file instanceof File)) {
      return c.json({ error: "Aucun fichier recu" }, 400);
    }

    const result = await uploadImage({
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name || "image",
      contentType: file.type || "application/octet-stream",
    });

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 400);
    }

    return c.json({ url: result.url, key: result.key });
  };
}
