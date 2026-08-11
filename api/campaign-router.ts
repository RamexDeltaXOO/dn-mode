import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { campaigns, newsletterSubscribers } from "@db/schema";

export const campaignRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }),

  getById: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [c] = await db.select().from(campaigns).where(eq(campaigns.id, input.id));
      return c || null;
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      subject: z.string().min(1),
      htmlContent: z.string().min(1),
      imageUrl: z.string().optional(),
      scheduledAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(campaigns).values({
        name: input.name,
        type: input.type,
        subject: input.subject,
        htmlContent: input.htmlContent,
        imageUrl: input.imageUrl || null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: input.scheduledAt ? "scheduled" : "draft",
      });
      return { id: Number((result as any)[0].insertId) };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      subject: z.string().optional(),
      htmlContent: z.string().optional(),
      imageUrl: z.string().optional(),
      scheduledAt: z.string().optional(),
      status: z.enum(["draft", "scheduled", "sent", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, any> = { ...data };
      if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
      await db.update(campaigns).set(updateData).where(eq(campaigns.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { success: true };
    }),

  sendNow: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.id));
      if (!campaign) throw new Error("Campaign not found");

      // Count subscribers
      const subs = await db.select().from(newsletterSubscribers);

      await db.update(campaigns).set({
        status: "sent",
        sentAt: new Date(),
        recipientCount: subs.length,
      }).where(eq(campaigns.id, input.id));

      return { success: true, recipientCount: subs.length };
    }),
});
