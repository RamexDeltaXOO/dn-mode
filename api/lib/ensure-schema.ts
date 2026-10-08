import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/**
 * Colonnes ajoutees au schema apres la creation de la base de production.
 *
 * Le projet n'a pas de fichiers de migration (convention db:push), et la base
 * de production n'est joignable qu'en IP privee depuis le serveur : on ne peut
 * pas compter sur un `npm run db:push` lance a la main apres chaque evolution.
 * Le serveur ajoute donc lui-meme, au demarrage, les colonnes manquantes.
 *
 * Uniquement des ajouts de colonnes nullables : jamais de suppression ni de
 * modification, rien qui puisse perdre une donnee.
 */
const ADDITIVE_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: "products", column: "weight_grams", definition: "int NULL" },
  { table: "order_items", column: "weight_grams", definition: "int NULL" },
  { table: "products", column: "variant_stock", definition: "json NULL" },
];

/** Tables ajoutees apres la creation de la base de production. */
const ADDITIVE_TABLES: Array<{ table: string; ddl: string }> = [
  {
    table: "reviews",
    ddl: `CREATE TABLE IF NOT EXISTS \`reviews\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`author_name\` varchar(255) NOT NULL,
      \`subtitle\` varchar(255),
      \`content\` text NOT NULL,
      \`rating\` int NOT NULL DEFAULT 5,
      \`is_active\` boolean DEFAULT true,
      \`sort_order\` int DEFAULT 0,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      PRIMARY KEY (\`id\`)
    )`,
  },
];

function firstRow(result: unknown): Record<string, unknown> | undefined {
  // mysql2 renvoie [lignes, champs].
  const rows = Array.isArray(result) ? result[0] : undefined;
  return Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
}

export async function ensureSchema(): Promise<void> {
  const db = getDb();
  for (const { table, ddl } of ADDITIVE_TABLES) {
    try {
      await db.execute(sql.raw(ddl));
    } catch (err) {
      console.error(`[schema] Impossible de creer la table ${table} :`, err);
    }
  }
  for (const { table, column, definition } of ADDITIVE_COLUMNS) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
      `);
      if (Number(firstRow(result)?.n ?? 0) > 0) continue;

      await db.execute(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`));
      console.log(`[schema] Colonne ajoutee : ${table}.${column}`);
    } catch (err) {
      console.error(`[schema] Impossible de verifier ${table}.${column} :`, err);
    }
  }
}
