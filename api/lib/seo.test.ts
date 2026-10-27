import { describe, expect, it } from "vitest";
import { plainText, productSeo, isPrivatePath } from "@contracts/seo";
import {
  absoluteUrl,
  buildSitemap,
  injectPageMeta,
  resolvePageMeta,
  type PageMeta,
  type SeoSettings,
} from "./seo";

const settings: SeoSettings = {
  siteName: "DN MODE",
  description: "Boutique de mode",
  baseUrl: "https://dn-mode.com",
  instagramUrl: "",
  heroImage: "/hero-bg.jpg",
};

const INDEX_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <!-- seo:start -->
    <title>DN MODE</title>
    <!-- seo:end -->
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function page(overrides: Partial<PageMeta> = {}): PageMeta {
  return {
    status: 200,
    title: "Robe AMINA | DN MODE",
    description: "Une robe",
    path: "/products/robe-amina",
    noindex: false,
    type: "product",
    jsonLd: [],
    fallback: "",
    ...overrides,
  };
}

describe("textes SEO", () => {
  it("coupe une description trop longue entre deux mots", () => {
    const text = plainText("mot ".repeat(80));
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith("mot…")).toBe(true);
  });

  it("met le texte sur une ligne", () => {
    expect(plainText("  Robe\n\nlongue  ")).toBe("Robe longue");
  });

  it("decrit un produit sans description a partir de son prix", () => {
    const seo = productSeo({ name: "Robe AMINA", price: "49.9" }, "DN MODE");
    expect(seo.title).toBe("Robe AMINA | DN MODE");
    expect(seo.description).toContain("49,90 €");
  });

  it("reconnait les pages privees", () => {
    expect(isPrivatePath("/admin")).toBe(true);
    expect(isPrivatePath("/admin/products")).toBe(true);
    expect(isPrivatePath("/checkout")).toBe(true);
    expect(isPrivatePath("/administration-des-ventes")).toBe(false);
    expect(isPrivatePath("/products/login")).toBe(false);
  });
});

describe("balises injectees dans index.html", () => {
  it("remplace le bloc par defaut et pose la canonique", () => {
    const html = injectPageMeta(INDEX_HTML, page(), settings);
    expect(html).toContain("<title>Robe AMINA | DN MODE</title>");
    expect(html).not.toContain("<title>DN MODE</title>");
    expect(html).toContain('<link rel="canonical" href="https://dn-mode.com/products/robe-amina" />');
    expect(html).not.toContain("noindex");
  });

  it("echappe les textes saisis dans le CRM", () => {
    const html = injectPageMeta(
      INDEX_HTML,
      page({ title: 'Robe "été" <b>', description: "a & b" }),
      settings,
    );
    expect(html).toContain("<title>Robe &quot;été&quot; &lt;b&gt;</title>");
    expect(html).toContain('content="a &amp; b"');
  });

  it("empeche un nom de produit de fermer la balise des donnees structurees", () => {
    const html = injectPageMeta(
      INDEX_HTML,
      page({ jsonLd: [{ name: "</script><script>alert(1)</script>" }] }),
      settings,
    );
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });

  it("exclut une page 404 des resultats sans canonique", () => {
    const html = injectPageMeta(INDEX_HTML, page({ status: 404, noindex: true }), settings);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).not.toContain('rel="canonical"');
  });

  it("ajoute le contenu de secours sans JavaScript", () => {
    const html = injectPageMeta(INDEX_HTML, page({ fallback: "<h1>Robe</h1>" }), settings);
    expect(html).toContain('<div id="root"></div>\n    <noscript><h1>Robe</h1></noscript>');
  });

  it("garde les URL absolues telles quelles", () => {
    expect(absoluteUrl("https://dn-mode.com", "/api/images/a.webp")).toBe("https://dn-mode.com/api/images/a.webp");
    expect(absoluteUrl("https://dn-mode.com", "https://cdn.test/a.jpg")).toBe("https://cdn.test/a.jpg");
  });
});

describe("routage SEO sans base", () => {
  it("met les pages privees en noindex", async () => {
    const meta = await resolvePageMeta("/admin/orders", settings);
    expect(meta.noindex).toBe(true);
    expect(meta.title).toBe("Administration | DN MODE");
  });

  it("repond 404 pour une adresse inconnue", async () => {
    const meta = await resolvePageMeta("/n-existe-pas", settings);
    expect(meta.status).toBe(404);
  });
});

describe("sitemap", () => {
  it("liste les pages avec leurs images et echappe les URL", () => {
    const xml = buildSitemap("https://dn-mode.com", [
      { path: "/" },
      { path: "/products/robe", lastmod: new Date("2026-10-01T12:00:00Z"), images: ["/api/images/a.webp?x=1&y=2"] },
    ]);
    expect(xml).toContain("<loc>https://dn-mode.com/</loc>");
    expect(xml).toContain("<lastmod>2026-10-01</lastmod>");
    expect(xml).toContain("<image:loc>https://dn-mode.com/api/images/a.webp?x=1&amp;y=2</image:loc>");
  });
});
