import { eq, sql } from "drizzle-orm";
import { variantJsonPath, variantKey } from "@contracts/constants";
import { getDb } from "../queries/connection";
import { orderItems, products } from "@db/schema";

/**
 * Retire du stock les articles d'une commande payee : stock global et stock
 * de la variante (couleur x taille) quand le produit en a un. Chaque mise a
 * jour est atomique cote base et ne descend jamais sous zero.
 *
 * A n'appeler qu'une fois par commande, au passage pending -> processing.
 */
export async function decrementStockForOrder(orderId: number): Promise<void> {
  const db = getDb();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    const qty = item.quantity;
    const path = variantJsonPath(variantKey(item.color, item.size));
    try {
      await db
        .update(products)
        .set({
          inventoryQuantity: sql`GREATEST(COALESCE(${products.inventoryQuantity}, 0) - ${qty}, 0)`,
          variantStock: sql`CASE
            WHEN ${products.variantStock} IS NOT NULL AND JSON_CONTAINS_PATH(${products.variantStock}, 'one', ${path})
            THEN JSON_SET(${products.variantStock}, ${path},
              GREATEST(CAST(JSON_EXTRACT(${products.variantStock}, ${path}) AS SIGNED) - ${qty}, 0))
            ELSE ${products.variantStock}
          END`,
        })
        .where(eq(products.id, item.productId));
    } catch (err) {
      // Le paiement est deja encaisse : on ne bloque pas la commande, on trace.
      console.error(`[stock] Decrement impossible (commande ${orderId}, produit ${item.productId}) :`, err);
    }
  }
}
