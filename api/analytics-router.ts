import { z } from "zod";
import { eq, sql, desc, gte } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { pageViews, productViews, products } from "@db/schema";

export const analyticsRouter = createRouter({
  trackPageView: publicQuery
    .input(z.object({ page: z.string(), sessionId: z.string().optional(), referrer: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ip = ctx.req.headers.get("x-forwarded-for") || "unknown";
      const ipHash = await hashIp(ip);
      await db.insert(pageViews).values({
        page: input.page,
        sessionId: input.sessionId || null,
        referrer: input.referrer || null,
        ipHash,
      });
      return { success: true };
    }),

  trackProductView: publicQuery
    .input(z.object({ productId: z.number(), sessionId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const ip = ctx.req.headers.get("x-forwarded-for") || "unknown";
      const ipHash = await hashIp(ip);
      await db.insert(productViews).values({
        productId: input.productId,
        sessionId: input.sessionId || null,
        ipHash,
      });
      return { success: true };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();

    // Total page views
    const [{ totalViews }] = await db.select({ totalViews: sql<number>`count(*)` }).from(pageViews);

    // Unique visitors (by session_id)
    const [{ uniqueVisitors }] = await db.select({ uniqueVisitors: sql<number>`count(DISTINCT session_id)` }).from(pageViews);

    // Today's views
    const [{ todayViews }] = await db.select({ todayViews: sql<number>`count(*)` }).from(pageViews)
      .where(gte(pageViews.createdAt, sql`DATE_SUB(NOW(), INTERVAL 1 DAY)`));

    // Views by page (top 10)
    const viewsByPage = await db.select({
      page: pageViews.page,
      count: sql<number>`count(*)`,
    }).from(pageViews).groupBy(pageViews.page).orderBy(desc(sql`count(*)`)).limit(10);

    // Product views (top 10)
    const topProducts = await db.select({
      productId: productViews.productId,
      count: sql<number>`count(*)`,
    }).from(productViews).groupBy(productViews.productId).orderBy(desc(sql`count(*)`)).limit(10);

    // Enrich with product names
    const enrichedProducts = await Promise.all(
      topProducts.map(async (tp) => {
        const [p] = await db.select().from(products).where(eq(products.id, tp.productId));
        return { productId: tp.productId, productName: p?.name || "Unknown", views: tp.count };
      })
    );

    // Daily views for chart (last 30 days)
    const dailyViews = await db.execute(
      sql`SELECT DATE(created_at) as date, count(*) as count FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY date`
    );

    return {
      totalViews,
      uniqueVisitors,
      todayViews,
      viewsByPage,
      topProducts: enrichedProducts,
      dailyViews: dailyViews as any[],
    };
  }),
});

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "dnmode-analytics-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
