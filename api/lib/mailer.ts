import { eq } from "drizzle-orm";
import { ConfigKeys } from "@contracts/constants";
import { emailTemplates } from "@db/schema";
import { getDb } from "../queries/connection";
import { getConfigValue } from "./site-config";
import { findDefaultTemplate } from "./email-templates";

/**
 * Envoi des emails transactionnels.
 *
 * On appelle l'API HTTP de Resend directement (fetch) plutot que le SDK : le
 * backend est bundle en ESM par esbuild, ou un `require()` du SDK est fragile.
 * La cle API se saisit dans le CRM (Admin > Parametres > Emails).
 * Sans cle configuree, on bascule en mode demo : les emails sont journalises
 * mais l'appelant recoit un succes, pour ne jamais bloquer une commande.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = {
  success: boolean;
  sentVia: "resend" | "demo" | "none";
  error?: string;
};

export async function getResendApiKey(): Promise<string> {
  const key = await getConfigValue(ConfigKeys.resendApiKey, { envKey: "RESEND_API_KEY" });
  return key === "re_dummy" ? "" : key;
}

export async function getFromEmail(): Promise<string> {
  return getConfigValue(ConfigKeys.fromEmail, {
    envKey: "FROM_EMAIL",
    fallback: "DN MODE <contact@dnmode.fr>",
  });
}

export async function getSupportEmail(): Promise<string> {
  const support = await getConfigValue(ConfigKeys.supportEmail, { envKey: "SUPPORT_EMAIL" });
  if (support) return support;
  return getConfigValue(ConfigKeys.contactEmail, { fallback: "sav@dnmode.fr" });
}

/** Remplace les {{variables}} d'un gabarit (valeur absente -> chaine vide). */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => vars[name] ?? "");
}

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = await getResendApiKey();
  const from = await getFromEmail();

  if (!apiKey) {
    console.log("[DEMO EMAIL] To:", opts.to, "| Sujet:", opts.subject);
    return { success: true, sentVia: "demo" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: string } | null;
      return {
        success: false,
        sentVia: "resend",
        error: detail?.message || `Resend a repondu ${response.status}`,
      };
    }

    return { success: true, sentVia: "resend" };
  } catch (error) {
    return {
      success: false,
      sentVia: "resend",
      error: error instanceof Error ? error.message : "Erreur reseau",
    };
  }
}

/**
 * Envoie un gabarit par sa cle. Le gabarit est lu en base ; s'il n'existe pas
 * encore (ou s'il est desactive), on retombe sur le gabarit par defaut afin
 * qu'une base fraiche envoie quand meme de vrais emails.
 */
export async function sendTemplateEmail(opts: {
  to: string;
  templateKey: string;
  variables?: Record<string, string>;
  replyTo?: string;
}): Promise<SendResult> {
  const vars = opts.variables ?? {};
  const source = await resolveTemplate(opts.templateKey);

  if (!source) {
    return {
      success: false,
      sentVia: "none",
      error: `Gabarit introuvable : ${opts.templateKey}`,
    };
  }

  return sendRawEmail({
    to: opts.to,
    subject: renderTemplate(source.subject, vars),
    html: renderTemplate(source.htmlBody, vars),
    text: source.textBody ? renderTemplate(source.textBody, vars) : undefined,
    replyTo: opts.replyTo,
  });
}

export type ResolvedTemplate = {
  subject: string;
  htmlBody: string;
  textBody: string | null;
  source: "db" | "default";
};

export async function resolveTemplate(key: string): Promise<ResolvedTemplate | null> {
  try {
    const db = getDb();
    const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key));
    if (row && row.isActive !== false) {
      return {
        subject: row.subject,
        htmlBody: row.htmlBody,
        textBody: row.textBody,
        source: "db",
      };
    }
  } catch {
    // Base indisponible : on utilise le gabarit par defaut.
  }

  const fallback = findDefaultTemplate(key);
  if (!fallback) return null;
  return {
    subject: fallback.subject,
    htmlBody: fallback.htmlBody,
    textBody: fallback.textBody,
    source: "default",
  };
}
