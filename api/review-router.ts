import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { reviews } from "@db/schema";

const reviewInput = z.object({
  authorName: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().max(255).optional().nullable(),
  content: z.string().trim().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const ordering = [asc(reviews.sortOrder), desc(reviews.createdAt)];

export const reviewRouter = createRouter({
  /** Avis visibles sur l'accueil. */
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(reviews).where(eq(reviews.isActive, true)).orderBy(...ordering);
  }),

  /** Tous les avis, masques compris, pour le CRM. */
  listAll: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(reviews).orderBy(...ordering);
  }),

  create: adminQuery.input(reviewInput).mutation(async ({ input }) => {
    const db = getDb();
    await db.insert(reviews).values({ ...input, subtitle: input.subtitle || null });
    return { success: true };
  }),

  update: adminQuery
    .input(reviewInput.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      if (data.subtitle !== undefined) data.subtitle = data.subtitle || null;
      await db.update(reviews).set(data).where(eq(reviews.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(reviews).where(eq(reviews.id, input.id));
      return { success: true };
    }),
});
