import {
  ConfigKeys,
  DEFAULT_PACKAGING_WEIGHT_G,
  DEFAULT_PRODUCT_WEIGHT_G,
} from "@contracts/constants";
import { getConfigNumber } from "./site-config";

/**
 * Calcul du poids des colis.
 *
 * Les poids sont manipules en grammes entiers dans toute l'application et
 * convertis en kilos uniquement au moment de parler a Sendcloud, qui attend
 * des kilos. Cela evite d'accumuler des erreurs d'arrondi sur les additions.
 */

export type WeighedLine = {
  weightGrams?: number | null;
  quantity: number;
};

/** Poids d'une ligne : le poids declare, sinon la valeur de repli. */
export function lineWeightGrams(line: WeighedLine, fallbackGrams: number): number {
  const unit =
    typeof line.weightGrams === "number" && line.weightGrams > 0
      ? line.weightGrams
      : fallbackGrams;
  return unit * Math.max(1, line.quantity);
}

/** Somme des lignes, hors emballage. */
export function contentWeightGrams(lines: WeighedLine[], fallbackGrams: number): number {
  return lines.reduce((total, line) => total + lineWeightGrams(line, fallbackGrams), 0);
}

export type WeightSettings = {
  /** Poids retenu pour un produit sans poids declare. */
  fallbackGrams: number;
  /** Poids de l'emballage ajoute une fois par colis. */
  packagingGrams: number;
};

export async function getWeightSettings(): Promise<WeightSettings> {
  // `sendcloud_default_weight` est saisi en kilos dans le CRM (c'est l'unite
  // de Sendcloud) : on le ramene en grammes.
  const defaultKg = await getConfigNumber(
    ConfigKeys.sendcloudDefaultWeight,
    DEFAULT_PRODUCT_WEIGHT_G / 1000,
    { envKey: "SENDCLOUD_DEFAULT_WEIGHT" },
  );
  const packagingG = await getConfigNumber(
    ConfigKeys.sendcloudPackagingWeight,
    DEFAULT_PACKAGING_WEIGHT_G,
    { envKey: "SENDCLOUD_PACKAGING_WEIGHT" },
  );

  return {
    fallbackGrams: Math.max(1, Math.round(defaultKg * 1000)),
    packagingGrams: Math.max(0, Math.round(packagingG)),
  };
}

/** Poids total du colis, emballage compris. */
export async function parcelWeightGrams(lines: WeighedLine[]): Promise<number> {
  const settings = await getWeightSettings();
  const content = contentWeightGrams(lines, settings.fallbackGrams);
  return content + settings.packagingGrams;
}

export function gramsToKg(grams: number): number {
  return Math.round(grams) / 1000;
}

/**
 * Une methode d'expedition est applicable si le poids du colis tombe dans sa
 * tranche. Sendcloud decoupe souvent un meme transporteur en plusieurs
 * methodes par palier de poids, et c'est ce decoupage qui porte le tarif.
 * Les bornes absentes sont traitees comme non contraignantes.
 */
export function methodAcceptsWeight(
  method: { minWeight?: string | number | null; maxWeight?: string | number | null },
  weightKg: number,
): boolean {
  const min = toNumber(method.minWeight);
  const max = toNumber(method.maxWeight);
  if (min !== null && weightKg < min) return false;
  if (max !== null && weightKg > max) return false;
  return true;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
