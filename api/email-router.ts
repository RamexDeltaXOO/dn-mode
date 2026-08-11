import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { emailTemplates, newsletterSubscribers } from "@db/schema";
import { Shipping } from "@contracts/constants";
import {
  getFromEmail,
  getResendApiKey,
  getSupportEmail,
  renderTemplate,
  resolveTemplate,
  sendTemplateEmail,
} from "./lib/mailer";
import {
  DEFAULT_EMAIL_TEMPLATES,
  ensureDefaultTemplates,
  findDefaultTemplate,
} from "./lib/email-templates";

/** Valeurs de demonstration pour l'apercu dans le CRM. */
const PREVIEW_SAMPLES: Record<string, string> = {
  shopName: "DN MODE",
  shopUrl: "https://dnmode.fr",
  logoUrl: "https://dnmode.fr/logo-dnmode.png",
  supportEmail: "sav@dnmode.fr",
  supportUrl: "https://dnmode.fr/contact",
  orderNumber: "DNM-20260811-A1B2C",
  orderDate: "11/08/2026",
  orderUrl: "https://dnmode.fr/checkout",
  firstName: "Amina",
  lastName: "Benali",
  name: "Amina Benali",
  email: "client@example.com",
  subtotal: "119.80",
  shippingCost: "Offerte",
  discount: "0.00",
  total: "119.80",
  shippingAddress: "12 rue de la Paix<br />75002 Paris<br />France",
  carrierName: "Mondial Relay",
  servicePointBlock: "",
  trackingNumber: "6A12345678901",
  trackingUrl: "https://www.mondialrelay.fr/suivi-de-colis",
  estimatedDays: "3-5 jours ouvres",
  ticketRef: "SAV-000123",
  subject: "Question sur ma commande",
  customerMessage: "Bonjour, quand ma commande sera-t-elle expediee ?",
  replyMessage: "Votre commande part demain, vous recevrez le suivi par email.",
  agentName: "Service client",
  freeShippingThreshold: String(Shipping.freeThreshold),
};

function withPreviewDefaults(
  variables: string[] | null | undefined,
  provided: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = { ...PREVIEW_SAMPLES };
  for (const name of variables ?? []) {
    if (!vars[name]) vars[name] = `[${name}]`;
  }
  // Le tableau produits est du HTML : on fournit un echantillon realiste.
  if (!provided.itemsHtml) {
    vars.itemsHtml =
      '<tr><td style="padding:12px 0;border-bottom:1px solid #e8e8e8;font-size:13px;">Ensemble SUHA<br /><span style="font-size:11px;color:#999999;">Noir / M</span></td>' +
      '<td align="center" style="padding:12px 8px;border-bottom:1px solid #e8e8e8;font-size:13px;color:#666666;">x2</td>' +
      '<td align="right" style="padding:12px 0;border-bottom:1px solid #e8e8e8;font-size:13px;">€67.80</td></tr>';
  }
  return { ...vars, ...provided };
}

export const emailRouter = createRouter({
  status: adminQuery.query(async () => {
    const apiKey = await getResendApiKey();
    return {
      provider: apiKey ? ("resend" as const) : ("demo" as const),
      fromEmail: await getFromEmail(),
      supportEmail: await getSupportEmail(),
    };
  }),

  /** Cree en base les gabarits par defaut manquants. */
  seedDefaults: adminQuery.mutation(async () => {
    return ensureDefaultTemplates();
  }),

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
      // Drizzle attend les noms de proprietes JS (htmlBody / textBody),
      // pas les noms de colonnes SQL.
      const updateData: Partial<typeof emailTemplates.$inferInsert> = {};
      if (data.subject !== undefined) updateData.subject = data.subject;
      if (data.htmlBody !== undefined) updateData.htmlBody = data.htmlBody;
      if (data.textBody !== undefined) updateData.textBody = data.textBody;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      if (Object.keys(updateData).length > 0) {
        await db.update(emailTemplates).set(updateData).where(eq(emailTemplates.key, key));
      }
      const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key));
      return updated;
    }),

  previewTemplate: adminQuery
    .input(z.object({
      key: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const resolved = await resolveTemplate(input.key);
      if (!resolved) return null;

      const declared =
        findDefaultTemplate(input.key)?.variables ??
        DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === input.key)?.variables ??
        [];
      const vars = withPreviewDefaults(declared, input.variables || {});

      return {
        subject: renderTemplate(resolved.subject, vars),
        html: renderTemplate(resolved.htmlBody, vars),
        textBody: resolved.textBody ? renderTemplate(resolved.textBody, vars) : null,
        source: resolved.source,
      };
    }),

  send: adminQuery
    .input(z.object({
      to: z.string().email(),
      templateKey: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const declared = findDefaultTemplate(input.templateKey)?.variables ?? [];
      const vars = withPreviewDefaults(declared, input.variables || {});
      const result = await sendTemplateEmail({
        to: input.to,
        templateKey: input.templateKey,
        variables: vars,
      });
      return result;
    }),

  sendBulk: adminQuery
    .input(z.object({
      templateKey: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const subscribers = await db.select().from(newsletterSubscribers);
      const declared = findDefaultTemplate(input.templateKey)?.variables ?? [];

      let sent = 0;
      for (const sub of subscribers) {
        const vars = withPreviewDefaults(declared, {
          ...(input.variables || {}),
          email: sub.email,
        });
        const result = await sendTemplateEmail({
          to: sub.email,
          templateKey: input.templateKey,
          variables: vars,
        });
        if (result.success) sent++;
      }

      return { success: true, sent, total: subscribers.length };
    }),
});
