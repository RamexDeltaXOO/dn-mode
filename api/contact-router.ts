import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { contacts } from "@db/schema";
import type { Contact } from "@db/schema";
import { ConfigKeys, EmailTemplateKeys } from "@contracts/constants";
import { getConfigValue } from "./lib/site-config";
import { getSupportEmail, sendTemplateEmail } from "./lib/mailer";
import { escapeHtml } from "./lib/email-templates";
import { resolveShopUrl } from "./order-router";

/** Reference lisible d'un ticket SAV. */
function ticketRef(id: number): string {
  return `SAV-${String(id).padStart(6, "0")}`;
}

/** Variables communes aux emails du service client. */
async function savVariables(contact: Contact, reqUrl?: string) {
  const shopUrl = await resolveShopUrl(reqUrl);
  return {
    shopName: await getConfigValue(ConfigKeys.siteName, { fallback: "DN MODE" }),
    shopUrl,
    logoUrl: `${shopUrl}/logo-dnmode.png`,
    supportEmail: await getSupportEmail(),
    supportUrl: `${shopUrl}/contact`,
    name: contact.name,
    ticketRef: ticketRef(contact.id),
    subject: contact.subject || "Votre demande",
    customerMessage: escapeHtml(contact.message).replace(/\n/g, "<br />"),
  };
}

export const contactRouter = createRouter({
  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      message: z.string().min(1),
      subject: z.string().optional(),
      orderNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db.insert(contacts).values({
        name: input.name,
        email: input.email,
        message: input.message,
        subject: input.subject || null,
        orderNumber: input.orderNumber || null,
      });

      const id = Number((result as unknown as Array<{ insertId: number }>)[0].insertId);

      // Accuse de reception (non bloquant)
      try {
        const [created] = await db.select().from(contacts).where(eq(contacts.id, id));
        if (created) {
          await sendTemplateEmail({
            to: created.email,
            templateKey: EmailTemplateKeys.savAcknowledgement,
            variables: await savVariables(created, ctx.req.url),
            replyTo: await getSupportEmail(),
          });
        }
      } catch (error) {
        console.error("[sav] accuse de reception non envoye:", error);
      }

      return { id, success: true };
    }),

  /** Reponse du service client, envoyee depuis le CRM. */
  reply: adminQuery
    .input(z.object({
      id: z.number(),
      message: z.string().min(1),
      subject: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, input.id));
      if (!contact) {
        return { success: false, sentVia: "none", error: "Message introuvable" };
      }

      const supportEmail = await getSupportEmail();
      const base = await savVariables(contact, ctx.req.url);
      const result = await sendTemplateEmail({
        to: contact.email,
        templateKey: EmailTemplateKeys.savReply,
        variables: {
          ...base,
          subject: input.subject || base.subject,
          replyMessage: escapeHtml(input.message).replace(/\n/g, "<br />"),
          agentName: ctx.user.name || "Service client",
        },
        replyTo: supportEmail,
      });

      await db
        .update(contacts)
        .set({ adminReply: input.message, repliedAt: new Date(), status: "replied" })
        .where(eq(contacts.id, input.id));

      return { success: result.success, sentVia: result.sentVia, error: result.error };
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
        query = db.select().from(contacts).where(eq(contacts.status, input.status as NonNullable<Contact["status"]>)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset);
      } else {
        query = db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset);
      }

      const contactList = await query;

      let countQuery;
      if (input?.status) {
        countQuery = db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.status, input.status as NonNullable<Contact["status"]>));
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
