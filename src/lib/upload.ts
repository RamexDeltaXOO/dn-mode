import { Paths, UPLOAD_MAX_BYTES } from "@contracts/constants";

export const UPLOAD_MAX_MB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));

/**
 * Cote le plus long d'une photo apres reduction, en pixels. La plus grande
 * image affichee (fiche produit) occupe environ 1200 pixels reels sur un
 * ecran haute densite : au-dela, le poids augmente sans gain visible.
 */
const MAX_DIMENSION = 1600;

/**
 * Reduit une photo avant l'envoi : 1600 px de cote au plus, reencodee en
 * WebP (en JPEG si le navigateur ne sait pas produire de WebP). Une photo de
 * telephone de 5 Mo descend ainsi a quelques centaines de Ko, ce qui allege
 * le stockage et l'affichage de la boutique. En cas d'echec, ou si le
 * resultat n'est pas plus leger, le fichier d'origine part tel quel.
 */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    let blob = await encode("image/webp");
    if (blob?.type !== "image/webp") {
      // Le JPEG perdrait la transparence d'un PNG detoure.
      if (file.type === "image/png") return file;
      blob = await encode("image/jpeg");
    }
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

/**
 * Reduit puis envoie une image vers le stockage via la route /api/upload et
 * retourne son URL publique. Leve une Error dont le message est affichable
 * tel quel.
 */
export async function uploadImage(original: File): Promise<string> {
  const file = await shrinkImage(original);
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
