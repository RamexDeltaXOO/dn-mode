import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { siteConfig } from "@db/schema";
import { ConfigKeys, HomeImageDefaults, HomeTextDefaults, type HomeTexts } from "@contracts/constants";
import { getConfigValues } from "./lib/site-config";

export const configRouter = createRouter({
  // Reserve a l'admin : la configuration contient les cles secretes
  // (Stripe, Sendcloud, stockage...).
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(siteConfig);
  }),

  /**
   * Visuels de la page d'accueil. Expose uniquement ces deux cles, jamais
   * le reste de la configuration, et retombe sur les images par defaut.
   */
  homeImages: publicQuery.query(async () => {
    const values = await getConfigValues([ConfigKeys.homeHeroImage, ConfigKeys.homeLookImage]);
    return {
      hero: values[ConfigKeys.homeHeroImage]?.trim() || HomeImageDefaults.hero,
      look: values[ConfigKeys.homeLookImage]?.trim() || HomeImageDefaults.look,
    };
  }),

  /**
   * Textes du site modifiables depuis le CRM (accueil, bandeau) et lien
   * Instagram. Liste blanche : rien d'autre de la configuration ne sort.
   */
  siteContent: publicQuery.query(async () => {
    const textKeys: Record<keyof HomeTexts, string> = {
      heroButton: ConfigKeys.homeHeroButton,
      heroCollection: ConfigKeys.homeHeroCollection,
      brandText: ConfigKeys.homeBrandText,
      productsLink: ConfigKeys.homeProductsLink,
      productsCollection: ConfigKeys.homeProductsCollection,
      lookButton: ConfigKeys.homeLookButton,
      lookCollection: ConfigKeys.homeLookCollection,
      reviewsTitle: ConfigKeys.homeReviewsTitle,
      bannerMessages: ConfigKeys.bannerMessages,
    };
    const values = await getConfigValues([...Object.values(textKeys), ConfigKeys.instagramUrl]);
    const texts = Object.fromEntries(
      (Object.keys(textKeys) as Array<keyof HomeTexts>).map((k) => [
        k,
        values[textKeys[k]]?.trim() || HomeTextDefaults[k],
      ]),
    ) as HomeTexts;
    return {
      texts,
      instagramUrl: values[ConfigKeys.instagramUrl]?.trim() || "https://www.instagram.com",
    };
  }),

  getByKey: adminQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [config] = await db.select().from(siteConfig).where(eq(siteConfig.key, input.key));
      return config || null;
    }),

  set: adminQuery
    .input(z.object({
      key: z.string().min(1),
      value: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.select().from(siteConfig).where(eq(siteConfig.key, input.key));
      if (existing.length > 0) {
        await db.update(siteConfig).set({ value: input.value }).where(eq(siteConfig.key, input.key));
      } else {
        await db.insert(siteConfig).values(input);
      }
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(siteConfig).where(eq(siteConfig.key, input.key));
      return { success: true };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM site_config`);
    return { totalConfigs: (result as any)[0]?.[0]?.count || 0 };
  }),
});
