import { eq } from "drizzle-orm";
import { ConfigKeys, Shipping, freeShippingBanner } from "@contracts/constants";
import { getConfigNumber } from "./site-config";
import { getDb } from "../queries/connection";
import { shippingMethods } from "@db/schema";

export type ShippingSettings = {
  /** Seuil (€) a partir duquel la livraison est offerte. */
  threshold: number;
  /** Frais de livraison par defaut (€) quand aucune methode n'est choisie. */
  defaultCost: number;
  /** Zone concernee par la livraison offerte. */
  zone: string;
  /** Texte pret a afficher dans le bandeau. */
  banner: string;
};

/** Lit les reglages de livraison depuis le CRM (avec repli sur les constantes). */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const threshold = await getConfigNumber(ConfigKeys.shippingThreshold, Shipping.freeThreshold);
  const defaultCost = await getConfigNumber(ConfigKeys.shippingCost, Shipping.defaultCost);
  return {
    threshold,
    defaultCost,
    zone: Shipping.zone,
    banner: freeShippingBanner(threshold),
  };
}

export type ShippingQuote = {
  cost: number;
  free: boolean;
  threshold: number;
  /** Montant restant avant la livraison offerte (0 si deja atteint). */
  remaining: number;
  methodId: number | null;
  methodName: string | null;
  carrier: string | null;
  requiresServicePoint: boolean;
};

/**
 * Calcule les frais de port d'une commande.
 *
 * La livraison est offerte des que le sous-total atteint le seuil configure
 * (100€ par defaut, France metropolitaine). Sinon on applique le tarif de la
 * methode choisie, ou le tarif par defaut.
 */
export async function quoteShipping(input: {
  subtotal: number;
  methodId?: number | null;
}): Promise<ShippingQuote> {
  const settings = await getShippingSettings();

  let price = settings.defaultCost;
  let methodName: string | null = null;
  let carrier: string | null = null;
  let requiresServicePoint = false;
  let methodId: number | null = null;

  if (input.methodId) {
    try {
      const db = getDb();
      const [method] = await db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.id, input.methodId));
      if (method && method.isActive) {
        price = Number.parseFloat(String(method.price));
        if (!Number.isFinite(price)) price = settings.defaultCost;
        methodName = method.name;
        carrier = method.carrier;
        requiresServicePoint = Boolean(method.requiresServicePoint);
        methodId = method.id;
      }
    } catch {
      /* base indisponible : tarif par defaut */
    }
  }

  const free = input.subtotal >= settings.threshold;

  return {
    cost: free ? 0 : round2(price),
    free,
    threshold: settings.threshold,
    remaining: free ? 0 : round2(Math.max(0, settings.threshold - input.subtotal)),
    methodId,
    methodName,
    carrier,
    requiresServicePoint,
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
