import { describe, expect, it } from "vitest";
import { renderTemplate } from "./mailer";

describe("gabarits d'emails", () => {
  const tpl = '<h1>Merci {{firstName}} !</h1>{{itemsHtml}}<a href="{{shopUrl}}">Boutique</a>';
  const vars = {
    firstName: '<a href="https://pirate.test">Payez ici</a>',
    itemsHtml: "<table><tr><td>Robe</td></tr></table>",
    shopUrl: "https://dn-mode.com/?a=1&b=2",
  };

  it("echappe les valeurs saisies par les visiteurs dans le HTML", () => {
    const html = renderTemplate(tpl, vars, "html");
    expect(html).toContain("Merci &lt;a href=&quot;https://pirate.test&quot;&gt;Payez ici&lt;/a&gt; !");
    expect(html).not.toContain('<a href="https://pirate.test">');
  });

  it("garde tel quel le HTML construit par le serveur", () => {
    expect(renderTemplate(tpl, vars, "html")).toContain("<table><tr><td>Robe</td></tr></table>");
  });

  it("n'echappe pas l'objet ni la version texte", () => {
    expect(renderTemplate("Commande de {{firstName}}", { firstName: "Anne & Marc" })).toBe(
      "Commande de Anne & Marc",
    );
  });
});
