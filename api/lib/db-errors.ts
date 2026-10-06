/**
 * Traduit une erreur MySQL en message lisible pour le CRM.
 *
 * Drizzle enveloppe l'erreur du pilote dans « Failed query: <requete> params:
 * <valeurs> », qui masque la vraie raison et expose les donnees saisies. On
 * remonte la chaine des `cause` jusqu'a l'erreur mysql2, qui porte un code.
 */
type MysqlError = { code?: string; sqlMessage?: string; message?: string; cause?: unknown };

function findMysqlError(error: unknown): MysqlError | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as MysqlError;
    if (typeof candidate.code === "string" && candidate.code.startsWith("ER_")) return candidate;
    current = candidate.cause;
  }
  return null;
}

export function describeDbError(error: unknown): string | null {
  const mysql = findMysqlError(error);
  if (!mysql) return null;
  const detail = mysql.sqlMessage || mysql.message || mysql.code;

  switch (mysql.code) {
    case "ER_DUP_ENTRY":
      return `Cette valeur existe deja (${detail}).`;
    case "ER_BAD_FIELD_ERROR":
    case "ER_NO_SUCH_TABLE":
      return `La base de donnees n'est pas a jour (${detail}). Redemarrez le serveur pour appliquer la mise a jour automatique.`;
    case "ER_DATA_TOO_LONG":
      return `Un champ est trop long (${detail}).`;
    default:
      return `Erreur de base de donnees : ${detail}.`;
  }
}
