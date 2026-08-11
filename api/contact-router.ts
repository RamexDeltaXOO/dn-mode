import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { contacts } from "@db/schema";

export const contactRouter = createRouter({
  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [contact] = await db.insert(contacts).values(input);
      return contact;
    }),

  list: adminQuery
    .input(z.object({
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const offset = (page - 1) * limit;

      let query;
      if (input?.status) {
        query = db.select().from(contacts).where(eq(contacts.status, input.status as any)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset);
      } else {
        query = db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset);
      }

      const contactList = await query;
      
      let countQuery;
      if (input?.status) {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.status, input.status as any));
      } else {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(contacts);
      }
      const [{ count }] = await countQuery;

      return { contacts: contactList, total: count };
    }),

  updateStatus: adminQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "read", "replied"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(contacts).set({ status: input.status }).where(eq(contacts.id, input.id));
      const [updated] = await db.select().from(contacts).where(eq(contacts.id, input.id));
      return updated;
    }),
});
