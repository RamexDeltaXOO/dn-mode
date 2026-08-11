import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { categories } from "@db/schema";

export const categoryRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(categories);
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [category] = await db.select().from(categories).where(eq(categories.slug, input.slug));
      return category || null;
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      parentId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(categories).values(input);
      const id = Number((result as any)[0].insertId);
      return { id, ...input };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      parentId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(categories).set(data).where(eq(categories.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(categories).where(eq(categories.id, input.id));
      return { success: true };
    }),
});
