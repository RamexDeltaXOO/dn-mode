import { z } from "zod";

/**
 * Lignes de commande envoyees par le navigateur. Seuls l'identifiant et la
 * quantite comptent : le prix est toujours relu en base.
 */
export const orderItemInput = z.object({
  productId: z.number().int().positive(),
  // Entier positif : une quantite negative ou decimale faisait baisser le
  // total facture (2 robes et -1 ensemble payees au prix d'une robe).
  quantity: z.number().int().min(1).max(99),
  color: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
});

export const orderItemsInput = z.array(orderItemInput).min(1, "Panier vide").max(50);

/** Champs texte libres d'une adresse : bornes pour la base et les emails. */
export const shortText = (max: number) => z.string().trim().max(max);
