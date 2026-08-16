import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { shippingMethods } from "@db/schema";
import { getShippingSettings, quoteShipping } from "./lib/shipping";
import { gramsToKg, methodAcceptsWeight } from "./lib/weight";

export const shippingRouter = createRouter({
  /**
   * Methodes actives. Avec un poids fourni, on ne renvoie que les methodes
   * dont la tranche couvre ce poids : c'est ce decoupage qui porte le tarif
   * chez Sendcloud.
   */
  list: publicQuery
    .input(z.object({ weightGrams: z.number().min(0).optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const methods = await db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.isActive, true))
        .orderBy(shippingMethods.sortOrder);

      const grams = input?.weightGrams ?? 0;
      if (grams <= 0) return methods;

      const weightKg = gramsToKg(grams);
      const applicable = methods.filter((m) => methodAcceptsWeight(m, weightKg));
      // Ne jamais renvoyer une liste vide : mieux vaut proposer un tarif
      // approximatif que bloquer le tunnel de commande.
      return applicable.length > 0 ? applicable : methods;
    }),

  listAll: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(shippingMethods).orderBy(shippingMethods.sortOrder);
  }),

  /** Reglages de livraison (seuil de gratuite, frais par defaut, bandeau). */
  settings: publicQuery.query(async () => {
    return getShippingSettings();
  }),

  /** Calcul des frais de port pour un sous-total et une methode donnes. */
  quote: publicQuery
    .input(z.object({
      subtotal: z.number().min(0),
      methodId: z.number().optional(),
      weightGrams: z.number().min(0).optional(),
    }))
    .query(async ({ input }) => {
      return quoteShipping({
        subtotal: input.subtotal,
        methodId: input.methodId ?? null,
        weightGrams: input.weightGrams ?? null,
      });
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      carrier: z.string().min(1),
      price: z.string().or(z.number()),
      estimatedDays: z.string().optional(),
      config: z.string().optional(),
      sortOrder: z.number().optional(),
      sendcloudMethodId: z.number().optional(),
      requiresServicePoint: z.boolean().optional(),
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
        sendcloudMethodId: input.sendcloudMethodId ?? null,
        requiresServicePoint: input.requiresServicePoint ?? false,
      });
      return { id: Number((result as unknown as Array<{ insertId: number }>)[0].insertId) };
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
      sendcloudMethodId: z.number().optional(),
      requiresServicePoint: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, config, price, ...rest } = input;
      const data: Partial<typeof shippingMethods.$inferInsert> = { ...rest };
      if (price !== undefined) data.price = String(price);
      if (config !== undefined) data.config = JSON.parse(config);
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
});
