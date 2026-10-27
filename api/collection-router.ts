import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { affectedRows, bulkIdsInput } from "./lib/bulk";
import { RESERVED_COLLECTION_SLUGS, collectionSlug, findCollectionBySlug } from "./lib/slugs";
import { collections } from "@db/schema";

/** Refuse un slug reserve ou deja pris, avec un message clair plutot qu'une erreur MySQL. */
async function assertSlugAvailable(slug: string, exceptId?: number): Promise<void> {
  if (RESERVED_COLLECTION_SLUGS.includes(slug)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Le slug « ${slug} » est reserve a « Tous les articles ». Choisissez-en un autre.`,
    });
  }
  const db = getDb();
  const condition = exceptId === undefined
    ? eq(collections.slug, slug)
    : and(eq(collections.slug, slug), ne(collections.id, exceptId));
  const [existing] = await db.select({ name: collections.name }).from(collections).where(condition);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Le slug « ${slug} » est deja utilise par la collection « ${existing.name} ». Choisissez-en un autre.`,
    });
  }
}

export const collectionRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(collections).orderBy(collections.sortOrder);
  }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return (await findCollectionBySlug(input.slug)) ?? null;
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
      // Slug toujours normalise, meme saisi a la main : minuscules, sans accents.
      const slug = collectionSlug(input.slug, input.name);
      await assertSlugAvailable(slug);
      const db = getDb();
      const result = await db.insert(collections).values({ ...input, slug });
      const id = Number((result as any)[0].insertId);
      return { id, ...input, slug };
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
      if (input.slug !== undefined) {
        // Slug vide : celui du nom (nouveau ou actuel).
        let name = input.name;
        if (name === undefined) {
          const [current] = await db.select({ name: collections.name }).from(collections).where(eq(collections.id, id));
          name = current?.name ?? "";
        }
        data.slug = collectionSlug(input.slug, name, id);
        await assertSlugAvailable(data.slug, id);
      }
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

  deleteMany: adminQuery
    .input(bulkIdsInput)
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.delete(collections).where(inArray(collections.id, input.ids));
      return { deleted: affectedRows(result) };
    }),
});
