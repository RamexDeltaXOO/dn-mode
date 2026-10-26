import { z } from "zod";

/**
 * Suppression groupee depuis le CRM : les identifiants des lignes cochees.
 * La borne evite qu'une requete demesuree bloque la base.
 */
export const bulkIdsInput = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
});

/** Nombre de lignes touchees par un DELETE / UPDATE (mysql2 renvoie [ResultSetHeader, ...]). */
export function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const count = (header as { affectedRows?: unknown } | null)?.affectedRows;
  return typeof count === "number" ? count : 0;
}
