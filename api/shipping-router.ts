import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { shippingMethods } from "@db/schema";

export const shippingRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(shippingMethods).where(eq(shippingMethods.isActive, true)).orderBy(shippingMethods.sortOrder);
  }),

  listAll: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(shippingMethods).orderBy(shippingMethods.sortOrder);
  }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      carrier: z.string().min(1),
      price: z.string().or(z.number()),
      estimatedDays: z.string().optional(),
      config: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(shippingMethods).values({
        name: input.name,
        carrier: input.carrier,
        price: String(input.price),
        estimatedDays: input.estimatedDays || null,
        config: input.config ? JSON.parse(input.config) : null,
        sortOrder: input.sortOrder || 0,
      });
      return { id: Number((result as any)[0].insertId) };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      carrier: z.string().optional(),
      price: z.string().or(z.number()).optional(),
      estimatedDays: z.string().optional(),
      isActive: z.boolean().optional(),
      config: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...raw } = input;
      const data: Record<string, any> = { ...raw };
      if (data.price !== undefined) data.price = String(data.price);
      await db.update(shippingMethods).set(data).where(eq(shippingMethods.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(shippingMethods).where(eq(shippingMethods.id, input.id));
      return { success: true };
    }),

  // Calculate shipping cost based on address and method
  calculate: publicQuery
    .input(z.object({
      postalCode: z.string(),
      country: z.string().default("France"),
      subtotal: z.number(),
      methodId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const [method] = await db.select().from(shippingMethods).where(eq(shippingMethods.id, input.methodId));
      if (!method || !method.isActive) return { cost: 0, free: false, method: null };

      const price = parseFloat(String(method.price));
      const free = input.subtotal >= 120;

      return {
        cost: free ? 0 : price,
        free,
        method: {
          name: method.name,
          carrier: method.carrier,
          estimatedDays: method.estimatedDays,
        },
      };
    }),
});
