import { and, eq } from "drizzle-orm";
import { users } from "@db/schema";
import { getDb } from "../queries/connection";

/**
 * Transfert ponctuel de l'administration DN MODE.
 * Idempotent : les redemarrages suivants ne reattribuent aucun droit.
 *
 * Le mot de passe existant est conserve. L'identite Google liee a l'ancienne
 * adresse est dissociee si le compte est renomme, afin que l'ancien Gmail ne
 * puisse pas se reconnecter en administrateur.
 */
const PREVIOUS_EMAIL = "Walid.bko47@gmail.com";
const ADMIN_EMAIL = "sav.dnmode@gmail.com";

export async function migrateAdminAccountEmail(): Promise<void> {
  const state = await getDb().transaction(async (tx) => {
    const oldAdmins = await tx
      .select({ id: users.id, passwordHash: users.passwordHash, googleId: users.googleId })
      .from(users)
      .where(and(eq(users.email, PREVIOUS_EMAIL), eq(users.role, "admin")))
      .for("update");

    if (oldAdmins.length > 1) {
      throw new Error("Plusieurs administrateurs utilisent l'ancienne adresse.");
    }

    const previous = oldAdmins[0];

    if (!previous) {
      const existing = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.email, ADMIN_EMAIL));
      if (existing.length > 1) {
        throw new Error("Plusieurs comptes utilisent la nouvelle adresse admin.");
      }
      return existing[0]?.role === "admin" ? "already-migrated" : "previous-admin-not-found";
    }

    const destinations = await tx
      .select({ id: users.id, googleId: users.googleId })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .for("update");

    if (destinations.length > 1) {
      throw new Error("Plusieurs comptes utilisent la nouvelle adresse admin.");
    }

    // Sans mot de passe administrateur a conserver, ne promouvoir qu'un
    // compte deja associe au vrai Google de la nouvelle adresse.
    // Sinon, un compte inscrit sans verification email pourrait devenir admin.
    if (!previous.passwordHash && !destinations[0]?.googleId) {
      throw new Error(
        "Ancien admin sans mot de passe : connectez d'abord la nouvelle adresse via Google et relancez le deploiement.",
      );
    }

    if (destinations.length === 0) {
      // Conserver le meme compte et son mot de passe, mais detacher son
      // ancienne identite Google. Le nouveau Gmail pourra etre lie au login.
      await tx
        .update(users)
        .set({
          email: ADMIN_EMAIL,
          provider: "local",
          googleId: null,
          ...(previous.googleId ? { unionId: `local_${crypto.randomUUID()}` } : {}),
        })
        .where(eq(users.id, previous.id));

      return "renamed";
    }

    // Si le nouvel email possede deja un compte, conserver son historique et
    // ses identifiants Google. Remplacer son mot de passe pour qu'un compte
    // local preinscrit ne puisse pas devenir administrateur avec son ancien
    // mot de passe. Ses sessions « user » seront invalidees par la verification
    // du role dans tokenMatchesCurrentUser.
    await tx
      .update(users)
      .set({ role: "admin", ...(previous.passwordHash ? { passwordHash: previous.passwordHash } : {}) })
      .where(eq(users.id, destinations[0].id));

    await tx
      .update(users)
      .set({ role: "user" })
      .where(eq(users.id, previous.id));

    return "transferred";
  });

  if (state === "renamed" || state === "transferred") {
    console.info(`[admin-account-migration] Admin transfere vers ${ADMIN_EMAIL} (${state})`);
  } else if (state === "previous-admin-not-found") {
    console.warn("[admin-account-migration] Ancien compte admin introuvable : aucun compte modifie.");
  }
}
