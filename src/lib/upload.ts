import { Paths, UPLOAD_MAX_BYTES } from "@contracts/constants";

export const UPLOAD_MAX_MB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));

/**
 * Envoie une image vers le stockage via la route /api/upload et retourne
 * son URL publique. Leve une Error dont le message est affichable tel quel.
 */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error(`${file.name} depasse ${UPLOAD_MAX_MB} Mo.`);
  }

  const body = new FormData();
  body.append("file", file);

  let data: { url?: string; error?: string };
  let ok: boolean;
  try {
    const response = await fetch(Paths.upload, {
      method: "POST",
      body,
      headers: {
        "x-local-auth-token": localStorage.getItem("dnmode_local_token") || "",
      },
    });
    ok = response.ok;
    data = (await response.json()) as { url?: string; error?: string };
  } catch {
    throw new Error(`Echec de l'envoi de ${file.name}.`);
  }

  if (!ok || !data.url) {
    throw new Error(data.error || `Echec de l'envoi de ${file.name}.`);
  }
  return data.url;
}
