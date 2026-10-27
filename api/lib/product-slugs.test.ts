import { describe, expect, it } from "vitest";
import { SLUG_MAX_LENGTH, slugify } from "@contracts/constants";
import { planSlugFixes, productSlug } from "./product-slugs";

describe("slugify", () => {
  it("met en minuscules et retire les accents", () => {
    expect(slugify("Robe Été")).toBe("robe-ete");
    expect(slugify("Voile jersey liquide VERT clair")).toBe("voile-jersey-liquide-vert-clair");
    expect(slugify("àâäéèêëîïôöùûüÿç ÀÉÈÇ")).toBe("aaaeeeeiioouuuyc-aeec");
  });

  it("remplace les lettres que la decomposition n'ecrit pas en ASCII", () => {
    expect(slugify("Cœur Ænéide")).toBe("coeur-aeneide");
    expect(slugify("Straße Øre Łódź")).toBe("strasse-ore-lodz");
  });

  it("remplace les caracteres speciaux par des tirets", () => {
    expect(slugify("Robe & Voile")).toBe("robe-et-voile");
    expect(slugify("L'été — 2026 !! (édition)")).toBe("l-ete-2026-edition");
    expect(slugify("  --Abaya   noire--  ")).toBe("abaya-noire");
    expect(slugify("Robe 🌸 fleurie")).toBe("robe-fleurie");
    expect(slugify("€€€")).toBe("");
  });

  it("borne la longueur sans tiret final", () => {
    const slug = slugify("robe ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("ne change pas un slug deja propre", () => {
    expect(slugify("ensemble-qimar-2")).toBe("ensemble-qimar-2");
  });
});

describe("slug d'un produit", () => {
  it("normalise le slug saisi, sinon prend celui du nom", () => {
    expect(productSlug("Robe-Été", "Robe ete")).toBe("robe-ete");
    expect(productSlug("", "Abaya Noire")).toBe("abaya-noire");
    expect(productSlug("!!!", "Abaya Noire")).toBe("abaya-noire");
    expect(productSlug(null, "€€€", 12)).toBe("produit-12");
  });
});

describe("correction des slugs au demarrage", () => {
  it("ne touche pas aux slugs deja valides", () => {
    expect(planSlugFixes([
      { id: 1, slug: "ensemble-qimar", name: "Ensemble QIMAR" },
      { id: 2, slug: "robe-amina", name: "Robe AMINA" },
    ])).toEqual([]);
  });

  it("corrige majuscules, accents et espaces", () => {
    expect(planSlugFixes([
      { id: 1, slug: "Voile Jersey Liquide Vert Clair", name: "Voile jersey" },
      { id: 2, slug: "Robe-Été", name: "Robe été" },
      { id: 3, slug: "", name: "Abaya Noire" },
    ])).toEqual([
      { id: 1, from: "Voile Jersey Liquide Vert Clair", to: "voile-jersey-liquide-vert-clair" },
      { id: 2, from: "Robe-Été", to: "robe-ete" },
      { id: 3, from: "", to: "abaya-noire" },
    ]);
  });

  it("ajoute un suffixe quand le slug corrige est deja pris", () => {
    expect(planSlugFixes([
      { id: 1, slug: "robe-ete", name: "Robe ete" },
      { id: 2, slug: "Robe-Été", name: "Robe été" },
      { id: 3, slug: "robe-été", name: "Robe été bis" },
    ])).toEqual([
      { id: 2, from: "Robe-Été", to: "robe-ete-2" },
      { id: 3, from: "robe-été", to: "robe-ete-3" },
    ]);
  });

  it("reprend une correction interrompue (slug provisoire)", () => {
    expect(planSlugFixes([{ id: 7, slug: "__tmp__7", name: "Cardigan CHLOE" }])).toEqual([
      { id: 7, from: "__tmp__7", to: "cardigan-chloe" },
    ]);
  });

  it("n'a plus rien a corriger une fois les corrections appliquees", () => {
    const rows = [
      { id: 1, slug: "robe-ete", name: "Robe ete" },
      { id: 2, slug: "Robe-Été", name: "Robe été" },
      { id: 3, slug: "Cœur & Âme", name: "Coeur" },
    ];
    const fixes = planSlugFixes(rows);
    const fixed = rows.map((row) => ({ ...row, slug: fixes.find((f) => f.id === row.id)?.to ?? row.slug }));
    expect(planSlugFixes(fixed)).toEqual([]);
    expect(new Set(fixed.map((row) => row.slug)).size).toBe(fixed.length);
  });
});
