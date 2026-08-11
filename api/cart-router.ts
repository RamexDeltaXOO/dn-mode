import { z } from "zod";
import { eq, and } from "drizzle-orm";
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

      // Check if item already exists
      const existingItems = await db.select().from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, input.productId)));

      if (existingItems.length > 0) {
        const existing = existingItems[0];
        await db.update(cartItems)
          .set({ quantity: existing.quantity + input.quantity })
          .where(eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
          color: input.color || null,
          size: input.size || null,
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
