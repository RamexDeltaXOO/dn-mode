import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { emailTemplates, newsletterSubscribers } from "@db/schema";

// Lazy init Resend
let resendInstance: any = null;
function getResend() {
  if (!resendInstance) {
    try {
      const { Resend } = require("resend");
      const apiKey = process.env.RESEND_API_KEY || "re_dummy";
      if (apiKey === "re_dummy") return null;
      resendInstance = new Resend(apiKey);
    } catch {
      return null;
    }
  }
  return resendInstance;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || "contact@dnmode.fr";
}

function replaceVariables(template: string, vars: Record<string, string> | undefined): string {
  if (!vars) return template;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

export const emailRouter = createRouter({
  listTemplates: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(emailTemplates).orderBy(emailTemplates.key);
  }),

  getTemplate: adminQuery
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.key));
      return t || null;
    }),

  updateTemplate: adminQuery
    .input(z.object({
      key: z.string(),
      subject: z.string().optional(),
      htmlBody: z.string().optional(),
      textBody: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { key, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.subject !== undefined) updateData.subject = data.subject;
      if (data.htmlBody !== undefined) updateData.html_body = data.htmlBody;
      if (data.textBody !== undefined) updateData.text_body = data.textBody;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      await db.update(emailTemplates).set(updateData).where(eq(emailTemplates.key, key));
      const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key));
      return updated;
    }),

  previewTemplate: adminQuery
    .input(z.object({
      key: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.key));
      if (!t) return null;
      const html = replaceVariables(t.htmlBody, input.variables || {});
      return { subject: t.subject, html, textBody: t.textBody };
    }),

  send: adminQuery
    .input(z.object({
      to: z.string().email(),
      templateKey: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.templateKey));
      if (!t) throw new Error("Template not found");

      const html = replaceVariables(t.htmlBody, input.variables);
      const subject = replaceVariables(t.subject, input.variables);
      const text = t.textBody ? replaceVariables(t.textBody, input.variables) : "";

      // Try Resend
      const resend = getResend();
      if (resend) {
        try {
          await resend.emails.send({
            from: getFromEmail(),
            to: input.to,
            subject,
            html,
            text,
          });
          return { success: true, sentVia: "resend" };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }

      // Demo mode
      console.log("[DEMO EMAIL] To:", input.to, "Subject:", subject);
      return { success: true, sentVia: "demo", html, subject };
    }),

  sendBulk: adminQuery
    .input(z.object({
      templateKey: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const subscribers = await db.select().from(newsletterSubscribers);
      const resend = getResend();

      const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.templateKey));
      if (!t) throw new Error("Template not found");

      let sent = 0;
      for (const sub of subscribers) {
        const vars = input.variables ? { ...input.variables, email: sub.email } : { email: sub.email };
        const html = replaceVariables(t.htmlBody, vars);
        const subject = replaceVariables(t.subject, input.variables);

        if (resend) {
          try {
            await resend.emails.send({
              from: getFromEmail(),
              to: sub.email,
              subject,
              html,
            });
            sent++;
          } catch { /* skip */ }
        } else {
          console.log("[DEMO BULK] To:", sub.email, "Subject:", subject);
          sent++;
        }
      }

      return { success: true, sent, total: subscribers.length };
    }),
});
