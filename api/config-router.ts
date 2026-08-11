import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { siteConfig } from "@db/schema";

export const configRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(siteConfig);
  }),

  getByKey: publicQuery
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
