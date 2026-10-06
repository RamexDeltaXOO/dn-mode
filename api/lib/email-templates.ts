import { eq } from "drizzle-orm";
import { EmailTemplateKeys, Shipping } from "@contracts/constants";
import { emailTemplates } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Catalogue des emails transactionnels DN MODE.
 *
 * Les gabarits sont en HTML "email-safe" : tableaux, styles en ligne, largeur
 * 600px, aucune ressource externe hors le logo de la boutique. Ils sont inseres
 * en base au premier demarrage (`ensureDefaultTemplates`) puis modifiables
 * depuis le CRM (Admin > Emails) sans jamais etre ecrases.
 */

export type DefaultTemplate = {
  key: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  description: string;
  variables: string[];
};

const INK = "#222222";
const MUTED = "#666666";
const LIGHT = "#999999";
const HAIRLINE = "#e8e8e8";
const PAGE_BG = "#f4f4f4";

const BASE_VARIABLES = ["shopName", "shopUrl", "logoUrl", "supportEmail"];

/** Enveloppe commune : en-tete avec logo, contenu, pied de page. */
function shell(content: string, opts: { preheader: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DN MODE</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:Helvetica,Arial,sans-serif;color:${INK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${HAIRLINE};">
        <tr>
          <td align="center" style="padding:32px 32px 24px 32px;border-bottom:1px solid ${HAIRLINE};">
            <a href="{{shopUrl}}" style="text-decoration:none;">
              <img src="{{logoUrl}}" alt="DN MODE" height="72" style="height:72px;width:auto;border:0;display:block;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
${content}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;border-top:1px solid ${HAIRLINE};">
            <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${LIGHT};">{{shopName}}</p>
            <p style="margin:0 0 6px 0;font-size:12px;color:${MUTED};">
              Une question ? Ecrivez-nous a <a href="mailto:{{supportEmail}}" style="color:${INK};">{{supportEmail}}</a>
            </p>
            <p style="margin:0;font-size:11px;color:${LIGHT};">
              Cet email vous est envoye suite a votre activite sur {{shopUrl}}.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `            <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:400;color:${INK};">${text}</h1>`;
}

function paragraph(text: string): string {
  return `            <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${MUTED};">${text}</p>`;
}

function label(text: string): string {
  return `            <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${LIGHT};">${text}</p>`;
}

function button(text: string, href: string): string {
  return `            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
              <tr><td style="background-color:${INK};">
                <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${text}</a>
              </td></tr>
            </table>`;
}

function quote(inner: string): string {
  return `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;border-left:2px solid ${HAIRLINE};">
              <tr><td style="padding:12px 16px;font-size:13px;line-height:1.6;color:${MUTED};">${inner}</td></tr>
            </table>`;
}

/** Lignes du recapitulatif produits (utilise par order_confirmation). */
export function buildOrderItemsHtml(
  items: Array<{
    productName: string;
    quantity: number;
    totalPrice: string | number;
    unitPrice?: string | number;
    color?: string | null;
    size?: string | null;
  }>,
): string {
  if (!items || items.length === 0) {
    return `<tr><td style="padding:12px 0;font-size:13px;color:${MUTED};">Aucun article</td></tr>`;
  }

  return items
    .map((item) => {
      const variant = [item.color, item.size].filter(Boolean).join(" / ");
      const total = Number.parseFloat(String(item.totalPrice));
      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-size:13px;color:${INK};">
    ${escapeHtml(item.productName)}
    ${variant ? `<br /><span style="font-size:11px;color:${LIGHT};">${escapeHtml(variant)}</span>` : ""}
  </td>
  <td align="center" style="padding:12px 8px;border-bottom:1px solid ${HAIRLINE};font-size:13px;color:${MUTED};white-space:nowrap;">x${item.quantity}</td>
  <td align="right" style="padding:12px 0;border-bottom:1px solid ${HAIRLINE};font-size:13px;color:${INK};white-space:nowrap;">€${Number.isFinite(total) ? total.toFixed(2) : "0.00"}</td>
</tr>`;
    })
    .join("\n");
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function totalsRow(name: string, value: string, strong = false): string {
  const weight = strong ? "font-weight:600;" : "";
  const border = strong ? `border-top:1px solid ${HAIRLINE};` : "";
  return `<tr>
  <td style="padding:8px 0;${border}font-size:13px;color:${strong ? INK : MUTED};${weight}">${name}</td>
  <td align="right" style="padding:8px 0;${border}font-size:13px;color:${INK};${weight}">${value}</td>
</tr>`;
}

const ORDER_SUMMARY = `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
{{itemsHtml}}
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
${totalsRow("Sous-total", "€{{subtotal}}")}
${totalsRow("Livraison", "{{shippingCost}}")}
${totalsRow("Remise", "-€{{discount}}")}
${totalsRow("Total", "€{{total}}", true)}
            </table>`;

// ── Catalogue ───────────────────────────────────────────────
export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    key: EmailTemplateKeys.orderConfirmation,
    subject: "Confirmation de votre commande {{orderNumber}}",
    description: "Envoye au client des que sa commande est enregistree et payee.",
    variables: [
      ...BASE_VARIABLES,
      "orderNumber",
      "orderDate",
      "firstName",
      "lastName",
      "email",
      "itemsHtml",
      "subtotal",
      "shippingCost",
      "discount",
      "total",
      "shippingAddress",
      "carrierName",
      "servicePointBlock",
      "orderUrl",
      "freeShippingThreshold",
    ],
    htmlBody: shell(
      [
        label("Commande confirmee"),
        heading("Merci {{firstName}} !"),
        paragraph(
          "Nous avons bien recu votre commande <strong style=\"color:" +
            INK +
            ";\">{{orderNumber}}</strong> passee le {{orderDate}}. Elle est en cours de preparation dans notre atelier.",
        ),
        ORDER_SUMMARY,
        label("Livraison"),
        paragraph("{{shippingAddress}}"),
        paragraph("Transporteur : <strong style=\"color:" + INK + ";\">{{carrierName}}</strong>"),
        "{{servicePointBlock}}",
        button("Suivre ma commande", "{{orderUrl}}"),
        paragraph(
          "Pour rappel, la livraison est offerte des {{freeShippingThreshold}}€ d'achat en " +
            Shipping.zone +
            ".",
        ),
      ].join("\n"),
      { preheader: "Votre commande {{orderNumber}} est confirmee." },
    ),
    textBody: `Merci {{firstName}} !

Votre commande {{orderNumber}} du {{orderDate}} est confirmee.

Sous-total : {{subtotal}} EUR
Livraison : {{shippingCost}}
Remise : {{discount}} EUR
Total : {{total}} EUR

Livraison : {{shippingAddress}}
Transporteur : {{carrierName}}

Suivre ma commande : {{orderUrl}}

Livraison offerte des {{freeShippingThreshold}} EUR en ${Shipping.zone}.

{{shopName}} · {{supportEmail}}`,
  },

  {
    key: EmailTemplateKeys.orderShipped,
    subject: "Votre commande {{orderNumber}} est en route",
    description: "Envoye automatiquement quand la commande passe au statut Expedie.",
    variables: [
      ...BASE_VARIABLES,
      "orderNumber",
      "firstName",
      "carrierName",
      "trackingNumber",
      "trackingUrl",
      "servicePointBlock",
      "estimatedDays",
    ],
    htmlBody: shell(
      [
        label("Colis expedie"),
        heading("Votre commande est partie !"),
        paragraph(
          "Bonne nouvelle {{firstName}}, votre commande <strong style=\"color:" +
            INK +
            ";\">{{orderNumber}}</strong> vient de quitter notre atelier avec {{carrierName}}.",
        ),
        quote(
          "Numero de suivi<br /><strong style=\"color:" +
            INK +
            ";font-size:15px;letter-spacing:1px;\">{{trackingNumber}}</strong>",
        ),
        button("Suivre mon colis", "{{trackingUrl}}"),
        "{{servicePointBlock}}",
        paragraph("Delai de livraison estime : {{estimatedDays}}."),
      ].join("\n"),
      { preheader: "Votre commande {{orderNumber}} vient d'etre expediee." },
    ),
    textBody: `Bonne nouvelle {{firstName}},

Votre commande {{orderNumber}} a ete expediee avec {{carrierName}}.
Numero de suivi : {{trackingNumber}}
Suivi : {{trackingUrl}}

Delai estime : {{estimatedDays}}

{{shopName}} · {{supportEmail}}`,
  },

  {
    key: EmailTemplateKeys.orderDelivered,
    subject: "Votre commande {{orderNumber}} a ete livree",
    description: "Envoye quand la commande passe au statut Livre.",
    variables: [...BASE_VARIABLES, "orderNumber", "firstName", "supportUrl"],
    htmlBody: shell(
      [
        label("Commande livree"),
        heading("Votre commande est arrivee"),
        paragraph(
          "{{firstName}}, votre commande <strong style=\"color:" +
            INK +
            ";\">{{orderNumber}}</strong> a bien ete livree. Nous esperons qu'elle vous plaira !",
        ),
        paragraph(
          "Un souci avec votre colis ? Vous disposez de 14 jours pour contacter notre service client, nous vous repondons sous 24 a 48h ouvrees.",
        ),
        button("Contacter le service client", "{{supportUrl}}"),
      ].join("\n"),
      { preheader: "Votre commande {{orderNumber}} a ete livree." },
    ),
    textBody: `{{firstName}}, votre commande {{orderNumber}} a ete livree.

Un souci ? Vous avez 14 jours pour contacter notre service client : {{supportUrl}} ({{supportEmail}}).

{{shopName}}`,
  },

  {
    key: EmailTemplateKeys.orderCancelled,
    subject: "Votre commande {{orderNumber}} a ete annulee",
    description: "Envoye quand la commande passe au statut Annule.",
    variables: [...BASE_VARIABLES, "orderNumber", "firstName", "total"],
    htmlBody: shell(
      [
        label("Commande annulee"),
        heading("Votre commande a ete annulee"),
        paragraph(
          "{{firstName}}, votre commande <strong style=\"color:" +
            INK +
            ";\">{{orderNumber}}</strong> d'un montant de €{{total}} a ete annulee.",
        ),
        paragraph(
          "Si un paiement a ete debite, le remboursement est effectue sous 5 a 10 jours ouvres sur votre moyen de paiement d'origine.",
        ),
        button("Retourner a la boutique", "{{shopUrl}}"),
      ].join("\n"),
      { preheader: "Votre commande {{orderNumber}} a ete annulee." },
    ),
    textBody: `{{firstName}}, votre commande {{orderNumber}} (€{{total}}) a ete annulee.

Remboursement sous 5 a 10 jours ouvres le cas echeant.

{{shopName}} · {{supportEmail}}`,
  },

  {
    key: EmailTemplateKeys.savAcknowledgement,
    subject: "Nous avons bien recu votre message ({{ticketRef}})",
    description: "Accuse de reception envoye automatiquement au client via le formulaire de contact.",
    variables: [...BASE_VARIABLES, "name", "ticketRef", "subject", "customerMessage"],
    htmlBody: shell(
      [
        label("Service client"),
        heading("Message bien recu"),
        paragraph(
          "Bonjour {{name}}, merci de nous avoir ecrit. Votre demande est enregistree sous la reference <strong style=\"color:" +
            INK +
            ";\">{{ticketRef}}</strong>.",
        ),
        label("Votre message"),
        quote("{{customerMessage}}"),
        paragraph(
          "Notre equipe vous repond sous 24 a 48h ouvrees. Merci de conserver cette reference pour tout echange.",
        ),
      ].join("\n"),
      { preheader: "Votre demande {{ticketRef}} est enregistree." },
    ),
    textBody: `Bonjour {{name}},

Nous avons bien recu votre message (reference {{ticketRef}}).

Votre message :
{{customerMessage}}

Notre equipe vous repond sous 24 a 48h ouvrees.

{{shopName}}, Service client : {{supportEmail}}`,
  },

  {
    key: EmailTemplateKeys.savReply,
    subject: "Re: {{subject}} (votre demande {{ticketRef}})",
    description: "Reponse du service client, envoyee depuis le CRM (Admin > Messages).",
    variables: [
      ...BASE_VARIABLES,
      "name",
      "ticketRef",
      "subject",
      "replyMessage",
      "customerMessage",
      "agentName",
    ],
    htmlBody: shell(
      [
        label("Service client · {{ticketRef}}"),
        heading("Notre reponse"),
        paragraph("Bonjour {{name}},"),
        `            <div style="margin:0 0 24px 0;font-size:14px;line-height:1.7;color:${INK};">{{replyMessage}}</div>`,
        paragraph("Bien a vous,<br /><strong style=\"color:" + INK + ";\">{{agentName}}</strong>, Service client {{shopName}}"),
        label("Votre message initial"),
        quote("{{customerMessage}}"),
      ].join("\n"),
      { preheader: "Reponse a votre demande {{ticketRef}}." },
    ),
    textBody: `Bonjour {{name}},

{{replyMessage}}

Bien a vous,
{{agentName}}, Service client {{shopName}}

--- Votre message initial ---
{{customerMessage}}

{{supportEmail}}`,
  },

  {
    key: EmailTemplateKeys.welcome,
    subject: "Bienvenue chez DN MODE",
    description: "Email de bienvenue a la creation d'un compte.",
    variables: [...BASE_VARIABLES, "firstName", "freeShippingThreshold"],
    htmlBody: shell(
      [
        label("Bienvenue"),
        heading("Ravis de vous compter parmi nous"),
        paragraph(
          "Bonjour {{firstName}}, votre compte est cree. Retrouvez vos commandes et vos informations a tout moment depuis votre espace.",
        ),
        button("Decouvrir la boutique", "{{shopUrl}}"),
        paragraph(
          "Livraison offerte des {{freeShippingThreshold}}€ d'achat en " + Shipping.zone + ".",
        ),
      ].join("\n"),
      { preheader: "Votre compte DN MODE est cree." },
    ),
    textBody: `Bonjour {{firstName}},

Bienvenue chez {{shopName}} ! Votre compte est cree.

Boutique : {{shopUrl}}
Livraison offerte des {{freeShippingThreshold}} EUR en ${Shipping.zone}.

{{supportEmail}}`,
  },
];

export function findDefaultTemplate(key: string): DefaultTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
}

/** Insere les gabarits manquants en base, sans jamais ecraser une personnalisation. */
export async function ensureDefaultTemplates(): Promise<{ created: number; total: number }> {
  const db = getDb();
  let created = 0;

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const existing = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, template.key));
    if (existing.length > 0) continue;

    await db.insert(emailTemplates).values({
      key: template.key,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      description: template.description,
      variables: template.variables,
      isActive: true,
    });
    created += 1;
  }

  return { created, total: DEFAULT_EMAIL_TEMPLATES.length };
}
