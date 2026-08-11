import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { ensureDefaultTemplates } from "../api/lib/email-templates";
import { Shipping } from "../contracts/constants";
import { collections, categories, products, shippingMethods, siteConfig } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // ── Collections ──────────────────────────────────────────
  const collectionData = [
    { name: "T-shirts / Tops", slug: "t-shirts-tops", sortOrder: 1 },
    { name: "Chemises / Hauts", slug: "chemises-hauts", sortOrder: 2 },
    { name: "Sweats / Pulls", slug: "sweats-pulls", sortOrder: 3 },
    { name: "Robes", slug: "robes", sortOrder: 4 },
    { name: "Pantalons", slug: "pantalons", sortOrder: 5 },
    { name: "Jupes", slug: "jupes", sortOrder: 6 },
    { name: "Ensembles", slug: "ensembles", sortOrder: 7 },
    { name: "Gilets / Vestes", slug: "gilets-vestes", sortOrder: 8 },
    { name: "Manteaux", slug: "manteaux", sortOrder: 9 },
    { name: "Hijabs", slug: "hijabs", sortOrder: 10 },
    { name: "Burkini", slug: "burkini", sortOrder: 11 },
  ];

  for (const c of collectionData) {
    const existing = await db.select().from(collections).where(eq(collections.slug, c.slug));
    if (existing.length === 0) {
      await db.insert(collections).values(c);
    }
  }
  console.log("Collections seeded");

  // ── Categories ───────────────────────────────────────────
  const categoryData = [
    { name: "Robes longues", slug: "robes-longues" },
    { name: "Robes midi", slug: "robes-midi" },
    { name: "Ensembles", slug: "ensembles-cat" },
    { name: "Jupes longues", slug: "jupes-longues" },
    { name: "Tops", slug: "tops" },
    { name: "Hijabs jersey", slug: "hijabs-jersey" },
    { name: "Manteaux", slug: "manteaux-cat" },
    { name: "Cardigans", slug: "cardigans" },
  ];

  for (const c of categoryData) {
    const existing = await db.select().from(categories).where(eq(categories.slug, c.slug));
    if (existing.length === 0) {
      await db.insert(categories).values(c);
    }
  }
  console.log("Categories seeded");

  // ── Products ─────────────────────────────────────────────
  const productData = [
    {
      name: "Ensemble QIMAR",
      slug: "ensemble-qimar",
      description: "Cet ensemble élégant se compose d'un haut fluide à manches longues et d'une jupe longue assortie, pour une silhouette à la fois raffinée et confortable. Le haut présente un col froncé délicat et des manches amples. La jupe longue offre un tombé fluide.",
      shortDescription: "Ensemble 2 pièces élégant et confortable",
      price: "25.90",
      images: ["/product-1.jpg"],
      colors: ["Olive", "Kaki", "Noir"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ENS-QMR-001",
      inventoryQuantity: 5,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: true,
    },
    {
      name: "Ensemble SUHA",
      slug: "ensemble-suha",
      description: "Cet ensemble élégant se compose d'un haut fluide à manches longues et d'une jupe longue assortie, pour une silhouette à la fois raffinée et confortable. Le haut présente un col froncé délicat et des manches amples qui apportent du volume et une touche sophistiquée. La jupe longue offre un tombé fluide et une taille structurée.",
      shortDescription: "Ensemble 2 pièces avec col froncé",
      price: "33.90",
      images: ["/product-5.jpg", "/product-6.jpg"],
      colors: ["Bordeaux", "Vanille", "Chocolat", "Kaki", "Noir"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ENS-SHA-002",
      inventoryQuantity: 0,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: true,
    },
    {
      name: "Ensemble VICHY",
      slug: "ensemble-vichy",
      description: "Ensemble composé d'une chemise à motif vichy et d'un pantalon large assorti. Parfait pour un look décontracté et élégant. Tissu léger et agréable à porter.",
      shortDescription: "Ensemble chemise vichy + pantalon",
      price: "39.90",
      images: ["/product-3.jpg"],
      colors: ["Blanc/Camel", "Blanc/Bleu"],
      sizes: ["S", "M", "L"],
      sku: "ENS-VCH-003",
      inventoryQuantity: 3,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: true,
    },
    {
      name: "Jupe SODÉ",
      slug: "jupe-sode",
      description: "Jupe longue fluide avec un tombé parfait. Taille élastiquée pour un confort optimal. Tissu léger et aérien, idéal pour la belle saison.",
      shortDescription: "Jupe longue fluide et légère",
      price: "32.90",
      images: ["/product-4.jpg"],
      colors: ["Beige", "Camel", "Noir"],
      sizes: ["S", "M", "L", "XL"],
      sku: "JUP-SDE-004",
      inventoryQuantity: 12,
      collectionId: 6,
      categoryId: 4,
      isActive: true,
      isFeatured: true,
    },
    {
      name: "Robe AMINA",
      slug: "robe-amina",
      description: "Robe longue fluide avec manches bouffantes et col montant. Coupe ample et confortable pour un look élégant et modeste. Tissu de qualité supérieure.",
      shortDescription: "Robe longue fluide manches bouffantes",
      price: "42.90",
      images: ["/product-1.jpg"],
      colors: ["Olive", "Kaki", "Noir", "Bordeaux"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ROB-AMN-005",
      inventoryQuantity: 8,
      collectionId: 4,
      categoryId: 1,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Robe LAYLA",
      slug: "robe-layla",
      description: "Robe longue dans un tissu fluide et léger. Manches longues amples, coupe droite élégante. Parfaite pour les occasions spéciales ou le quotidien.",
      shortDescription: "Robe longue fluide et élégante",
      price: "45.90",
      images: ["/product-2.jpg"],
      colors: ["Moka", "Chocolat", "Noir", "Bleu marine"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ROB-LYL-006",
      inventoryQuantity: 6,
      collectionId: 4,
      categoryId: 1,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Ensemble PALAZZO",
      slug: "ensemble-palazzo",
      description: "Ensemble 2 pièces avec top brodé et jupe palazzo. Le top présente une broderie florale délicate sur une base crème. La jupe palazzo offre une silhouette fluide et élégante.",
      shortDescription: "Ensemble top brodé + jupe palazzo",
      price: "33.00",
      compareAtPrice: "39.90",
      images: ["/product-4.jpg"],
      colors: ["Crème", "Blanc"],
      sizes: ["S", "M", "L"],
      sku: "ENS-PLZ-007",
      inventoryQuantity: 0,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Ensemble HIYAM",
      slug: "ensemble-hiyam",
      description: "Édition limitée - Ensemble élégant avec top à volants et jupe fluide. Confectionné dans un tissu premium pour un confort optimal et une allure raffinée.",
      shortDescription: "Édition limitée - Ensemble premium",
      price: "69.90",
      images: ["/product-5.jpg"],
      colors: ["Crème", "Rose poudré", "Gris"],
      sizes: ["S", "M", "L"],
      sku: "ENS-HYM-008",
      inventoryQuantity: 4,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Robe rose poudré",
      slug: "robe-rose-poudre",
      description: "Robe longue dans un magnifique tissu rose poudré avec plissage au col. Manches longues avec poignets resserrés. Allure romantique et élégante.",
      shortDescription: "Robe longue rose poudré plissée",
      price: "48.90",
      images: ["/product-8.jpg"],
      colors: ["Rose poudré", "Lavande"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ROB-RSP-009",
      inventoryQuantity: 7,
      collectionId: 4,
      categoryId: 1,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Hijab Jersey Premium",
      slug: "hijab-jersey-premium",
      description: "Hijab en jersey de qualité premium, ultra doux et confortable. Tissu stretch qui se met en place facilement et tient toute la journée. Ne glisse pas, ne nécessite pas d'épingle.",
      shortDescription: "Hijab jersey premium ultra doux",
      price: "12.90",
      images: ["/product-9.jpg"],
      colors: ["Noir", "Marine", "Gris", "Taupe", "Vert olive"],
      sizes: ["Standard"],
      sku: "HIJ-JRY-010",
      inventoryQuantity: 25,
      collectionId: 10,
      categoryId: 6,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Chemise blanche + Pantalon",
      slug: "chemise-blanche-pantalon",
      description: "Ensemble chic avec chemise blanche à col volanté et pantalon large vert sauge. Parfait pour un look professionnel et modeste. Tissus de qualité.",
      shortDescription: "Ensemble chemise blanche + pantalon",
      price: "52.90",
      images: ["/product-10.jpg"],
      colors: ["Blanc/Vert", "Blanc/Noir"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ENS-CHP-011",
      inventoryQuantity: 9,
      collectionId: 2,
      categoryId: 5,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Cardigan CHLOE",
      slug: "cardigan-chloe",
      description: "Cardigan oversize en maille épaisse avec gros boutons. Coupe ample et confortable parfaite pour la mi-saison. Se porte facilement sur une robe ou un ensemble.",
      shortDescription: "Cardigan oversize en maille",
      price: "46.90",
      images: ["/product-11.jpg"],
      colors: ["Gris anthracite", "Beige", "Camel", "Noir"],
      sizes: ["S", "M", "L"],
      sku: "CAR-CHL-012",
      inventoryQuantity: 10,
      collectionId: 8,
      categoryId: 8,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Ensemble vert sauge",
      slug: "ensemble-vert-sauge",
      description: "Ensemble coordonné dans un magnifique vert sauge avec top à col drapé et jupe évasée mi-longue. Tissu fluide de qualité, coupe flatteuse.",
      shortDescription: "Ensemble vert sauge drapé",
      price: "47.90",
      images: ["/product-12.jpg"],
      colors: ["Vert sauge", "Terracotta"],
      sizes: ["S", "M", "L"],
      sku: "ENS-VSA-013",
      inventoryQuantity: 6,
      collectionId: 7,
      categoryId: 3,
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Robe noire abaya",
      slug: "robe-noire-abaya",
      description: "Abaya noire élégante avec liseré doré subtil. Coupe fluide ample, manches larges. Tissu premium léger et confortable. Parfaite pour les occasions ou le quotidien.",
      shortDescription: "Abaya noire avec liseré doré",
      price: "54.90",
      images: ["/product-7.jpg"],
      colors: ["Noir", "Marine"],
      sizes: ["S", "M", "L", "XL"],
      sku: "ROB-ABY-014",
      inventoryQuantity: 8,
      collectionId: 4,
      categoryId: 1,
      isActive: true,
      isFeatured: false,
    },
  ];

  for (const p of productData) {
    const existing = await db.select().from(products).where(eq(products.slug, p.slug));
    if (existing.length === 0) {
      await db.insert(products).values(p);
    }
  }
  console.log("Products seeded");

  // ── Shipping methods (Sendcloud : Colissimo / Chronopost / Mondial Relay) ──
  const shippingData = [
    {
      name: "Colissimo Domicile",
      carrier: "colissimo",
      price: "5.90",
      estimatedDays: "2-3 jours",
      requiresServicePoint: false,
      sortOrder: 1,
    },
    {
      name: "Chronopost Express",
      carrier: "chronopost",
      price: "9.90",
      estimatedDays: "24h",
      requiresServicePoint: false,
      sortOrder: 2,
    },
    {
      name: "Mondial Relay Point Relais",
      carrier: "mondial_relay",
      price: "4.50",
      estimatedDays: "3-5 jours",
      requiresServicePoint: true,
      sortOrder: 3,
    },
  ];

  for (const method of shippingData) {
    const existing = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.name, method.name));
    if (existing.length === 0) {
      await db.insert(shippingMethods).values({ ...method, countries: ["FR"], isActive: true });
    }
  }
  console.log("Shipping methods seeded");

  // ── Email templates (commandes + SAV) ────────────────────
  const { created, total } = await ensureDefaultTemplates();
  console.log(`Email templates seeded (${created} created / ${total} total)`);

  // ── Site config par defaut (jamais ecrasee si deja definie) ──
  const configDefaults: Array<{ key: string; value: string }> = [
    { key: "site_name", value: "DN MODE" },
    { key: "shipping_threshold", value: String(Shipping.freeThreshold) },
    { key: "shipping_cost", value: Shipping.defaultCost.toFixed(2) },
    { key: "currency", value: "EUR" },
  ];

  for (const config of configDefaults) {
    const existing = await db.select().from(siteConfig).where(eq(siteConfig.key, config.key));
    if (existing.length === 0) {
      await db.insert(siteConfig).values(config);
    }
  }
  console.log("Site config seeded");

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
