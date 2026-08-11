import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { collections } from "@db/schema";

export const collectionRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(collections).orderBy(collections.sortOrder);
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [collection] = await db.select().from(collections).where(eq(collections.slug, input.slug));
      return collection || null;
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      image: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(collections).values(input);
      const id = Number((result as any)[0].insertId);
      return { id, ...input };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(collections).set(data).where(eq(collections.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(collections).where(eq(collections.id, input.id));
      return { success: true };
    }),
});
