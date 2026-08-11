import { sql, desc } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, products, contacts, users } from "@db/schema";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();

    const [{ totalRevenue }] = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
    }).from(orders).where(sql`${orders.status} != 'cancelled'`);

    const [{ totalOrders }] = await db.select({
      totalOrders: sql<number>`count(*)`,
    }).from(orders);

    const [{ totalCustomers }] = await db.select({
      totalCustomers: sql<number>`count(DISTINCT ${orders.email})`,
    }).from(orders);

    const [{ totalProducts }] = await db.select({
      totalProducts: sql<number>`count(*)`,
    }).from(products).where(sql`${products.isActive} = true`);

    const [{ totalUsers }] = await db.select({
      totalUsers: sql<number>`count(*)`,
    }).from(users);

    const [{ totalContacts }] = await db.select({
      totalContacts: sql<number>`count(*)`,
    }).from(contacts).where(sql`${contacts.status} = 'new'`);

    const recentOrders = await db.select().from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const recentContacts = await db.select().from(contacts)
      .orderBy(desc(contacts.createdAt))
      .limit(5);

    return {
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalOrders,
      totalCustomers,
      totalProducts,
      totalUsers,
      totalNewContacts: totalContacts,
      recentOrders,
      recentContacts,
    };
  }),
});
