import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { stockFor } from "@contracts/constants";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { carts, cartItems, products } from "@db/schema";
import { TRPCError } from "@trpc/server";

function getSessionId(headers: Headers): string | null {
  return headers.get("x-session-id");
}

export const cartRouter = createRouter({
  get: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const sessionId = getSessionId(ctx.req.headers);
    const userId = ctx.user?.id;

    let cart;
    if (userId) {
      [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
      if (!cart && sessionId) {
        [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
        if (cart) {
          await db.update(carts).set({ userId }).where(eq(carts.id, cart.id));
        }
      }
    } else if (sessionId) {
      [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    }

    if (!cart) {
      return { items: [], total: 0 };
    }

    const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        return {
          ...item,
          product: product || null,
          subtotal: product ? (parseFloat(product.price as string) * item.quantity).toFixed(2) : "0",
        };
      })
    );

    const total = enrichedItems.reduce((sum, item) => {
      return sum + (item.product ? parseFloat(item.product.price as string) * item.quantity : 0);
    }, 0);

    return { items: enrichedItems, total: total.toFixed(2) };
  }),

  addItem: publicQuery
    .input(z.object({
      productId: z.number(),
      quantity: z.number().min(1).default(1),
      color: z.string().optional(),
      size: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const sessionId = getSessionId(ctx.req.headers);
      const userId = ctx.user?.id;

      if (!sessionId && !userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session ID required" });
      }

      // Get or create cart
      let cart;
      if (userId) {
        [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
      }
      if (!cart && sessionId) {
        [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
      }
      if (!cart) {
        const result = await db.insert(carts).values({
          userId: userId || null,
          sessionId: sessionId || null,
        });
        cart = { id: Number(result[0].insertId), userId: userId || null, sessionId: sessionId || null };
      }

      // Meme produit, meme couleur, meme taille : on cumule sur la meme ligne.
      const color = input.color || null;
      const size = input.size || null;
      const existingItems = await db.select().from(cartItems)
        .where(and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, input.productId),
          color === null ? isNull(cartItems.color) : eq(cartItems.color, color),
          size === null ? isNull(cartItems.size) : eq(cartItems.size, size),
        ));
      const existing = existingItems[0];

      // Stock de la variante choisie (couleur x taille).
      const [product] = await db.select().from(products).where(eq(products.id, input.productId));
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable" });
      const available = stockFor(product, color, size);
      if ((existing?.quantity ?? 0) + input.quantity > available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: available > 0
            ? `Plus que ${available} piece(s) disponible(s) pour cette variante`
            : "Cette variante est epuisee",
        });
      }

      if (existing) {
        await db.update(cartItems)
          .set({ quantity: existing.quantity + input.quantity })
          .where(eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
          color,
          size,
        });
      }

      return { success: true };
    }),

  updateItem: publicQuery
    .input(z.object({
      itemId: z.number(),
      quantity: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.quantity === 0) {
        await db.delete(cartItems).where(eq(cartItems.id, input.itemId));
      } else {
        const [item] = await db.select().from(cartItems).where(eq(cartItems.id, input.itemId));
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable" });
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        const available = product ? stockFor(product, item.color, item.size) : 0;
        // Baisser la quantite reste toujours possible.
        if (input.quantity > item.quantity && input.quantity > available) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Plus que ${available} piece(s) disponible(s) pour cette variante`,
          });
        }
        await db.update(cartItems).set({ quantity: input.quantity }).where(eq(cartItems.id, input.itemId));
      }
      return { success: true };
    }),

  removeItem: publicQuery
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(cartItems).where(eq(cartItems.id, input.itemId));
      return { success: true };
    }),

  clear: publicQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const sessionId = getSessionId(ctx.req.headers);
    const userId = ctx.user?.id;

    let cart;
    if (userId) {
      [cart] = await db.select().from(carts).where(eq(carts.userId, userId));
    }
    if (!cart && sessionId) {
      [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId));
    }

    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    }

    return { success: true };
  }),
});
