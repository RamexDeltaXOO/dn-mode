import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, products, carts, cartItems } from "@db/schema";

export const orderRouter = createRouter({
  create: publicQuery
    .input(z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        color: z.string().optional(),
        size: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      
      // Calculate totals
      let subtotal = 0;
      const orderItemsData = [];
      
      for (const item of input.items) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId));
        if (!product) continue;
        const price = parseFloat(product.price as string);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        orderItemsData.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal.toFixed(2),
          color: item.color || null,
          size: item.size || null,
        });
      }

      const shippingCost = subtotal >= 120 ? 0 : 5.90;
      const discount = 0;
      const total = subtotal + shippingCost - discount;

      // Generate order number
      const orderCount = await db.select({ count: sql<number>`count(*)` }).from(orders);
      const orderNumber = `MYM-${String(orderCount[0].count + 1).padStart(6, "0")}`;

      // Create order
      const result = await db.insert(orders).values({
        orderNumber,
        userId: ctx.user?.id || null,
        email: input.email,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        address: input.address || null,
        city: input.city || null,
        postalCode: input.postalCode || null,
        country: input.country || "France",
        phone: input.phone || null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
      });

      const orderId = Number(result[0].insertId);

      // Create order items
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({ ...item, orderId });
      }

      // Clear cart if user is logged in
      if (ctx.user?.id) {
        const [cart] = await db.select().from(carts).where(eq(carts.userId, ctx.user.id));
        if (cart) {
          await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        }
      }

      return { orderId, orderNumber, total: total.toFixed(2) };
    }),

  getMyOrders: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const myOrders = await db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt));
    return myOrders;
  }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [order] = await db.select().from(orders).where(eq(orders.id, input.id));
      if (!order) return null;
      
      // Check authorization
      if (ctx.user?.role !== "admin" && order.userId !== ctx.user?.id) {
        return null;
      }

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return { ...order, items };
    }),

  list: adminQuery
    .input(z.object({
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const offset = (page - 1) * limit;

      let query;
      if (input?.status) {
        query = db.select().from(orders).where(eq(orders.status, input.status as any)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
      } else {
        query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset);
      }

      const orderList = await query;
      
      let countQuery;
      if (input?.status) {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, input.status as any));
      } else {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(orders);
      }
      const [{ count }] = await countQuery;

      return { orders: orderList, total: count };
    }),

  updateStatus: adminQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      const [updated] = await db.select().from(orders).where(eq(orders.id, input.id));
      return updated;
    }),
});
