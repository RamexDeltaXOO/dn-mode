import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ne, like, and, sql } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { products } from "@db/schema";

/** Refuse un slug deja pris, avec un message clair plutot qu'une erreur MySQL. */
async function assertSlugAvailable(slug: string, exceptId?: number): Promise<void> {
  const db = getDb();
  const condition = exceptId === undefined
    ? eq(products.slug, slug)
    : and(eq(products.slug, slug), ne(products.id, exceptId));
  const [existing] = await db.select({ id: products.id, name: products.name }).from(products).where(condition);
  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Le slug « ${slug} » est deja utilise par le produit « ${existing.name} ». Choisissez-en un autre.`,
    });
  }
}

export const productRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        collectionId: z.number().optional(),
        categoryId: z.number().optional(),
        featured: z.boolean().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(12),
        includeInactive: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];

      let page = 1;
      let limit = 12;

      if (input) {
        page = input.page;
        limit = input.limit;

        if (input.collectionId) {
          filters.push(eq(products.collectionId, input.collectionId));
        }
        if (input.categoryId) {
          filters.push(eq(products.categoryId, input.categoryId));
        }
        if (input.featured) {
          filters.push(eq(products.isFeatured, true));
        }
        if (input.search) {
          filters.push(like(products.name, `%${input.search}%`));
        }
        if (!input.includeInactive) {
          filters.push(eq(products.isActive, true));
        }
      } else {
        filters.push(eq(products.isActive, true));
      }

      const offset = (page - 1) * limit;

      let query;
      if (filters.length > 0) {
        query = db.select().from(products).where(and(...filters)).limit(limit).offset(offset);
      } else {
        query = db.select().from(products).limit(limit).offset(offset);
      }

      const productList = await query;

      let countQuery;
      if (filters.length > 0) {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(products).where(and(...filters));
      } else {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(products);
      }
      const [{ count }] = await countQuery;

      return { products: productList, total: count };
    }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [product] = await db.select().from(products).where(eq(products.slug, input.slug));
      return product || null;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [product] = await db.select().from(products).where(eq(products.id, input.id));
      return product || null;
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      shortDescription: z.string().optional(),
      price: z.string().or(z.number()),
      compareAtPrice: z.string().or(z.number()).optional(),
      images: z.array(z.string()).optional(),
      colors: z.array(z.string()).optional(),
      sizes: z.array(z.string()).optional(),
      sku: z.string().optional(),
      weightGrams: z.number().int().min(0).optional().nullable(),
      inventoryQuantity: z.number().optional(),
      categoryId: z.number().optional(),
      collectionId: z.number().optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await assertSlugAvailable(input.slug);
      const db = getDb();
      const data = {
        ...input,
        price: String(input.price),
        compareAtPrice: input.compareAtPrice ? String(input.compareAtPrice) : undefined,
      };
      const [product] = await db.insert(products).values(data);
      return product;
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      shortDescription: z.string().optional(),
      price: z.string().or(z.number()).optional(),
      compareAtPrice: z.string().or(z.number()).optional().nullable(),
      images: z.array(z.string()).optional(),
      colors: z.array(z.string()).optional(),
      sizes: z.array(z.string()).optional(),
      sku: z.string().optional(),
      weightGrams: z.number().int().min(0).optional().nullable(),
      inventoryQuantity: z.number().optional(),
      categoryId: z.number().optional(),
      collectionId: z.number().optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.slug !== undefined) await assertSlugAvailable(input.slug, input.id);
      const db = getDb();
      const { id, ...raw } = input;
      const data: Record<string, unknown> = { ...raw };
      if (data.price !== undefined) data.price = String(data.price);
      if (data.compareAtPrice !== undefined && data.compareAtPrice !== null) {
        data.compareAtPrice = String(data.compareAtPrice);
      }
      await db.update(products).set(data).where(eq(products.id, id));
      const [updated] = await db.select().from(products).where(eq(products.id, id));
      return updated;
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
      return { success: true };
    }),
});
