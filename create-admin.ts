import { eq } from "drizzle-orm";
import { getDb } from "./api/queries/connection";
import { users } from "./db/schema";
import { hashPassword } from "./api/local-auth-router";

/**
 * Cree (ou met a jour) le compte administrateur du CRM.
 *
 * Identifiants fournis par variables d'environnement, jamais en dur dans le
 * depot :
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "Variables manquantes.\n" +
        "Usage : ADMIN_EMAIL=vous@exemple.fr ADMIN_PASSWORD='motdepasse' npm run admin:create",
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("Le mot de passe administrateur doit faire au moins 12 caracteres.");
    process.exit(1);
  }

  const db = getDb();
  const passwordHash = await hashPassword(password);
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", name })
      .where(eq(users.id, existing.id));
    console.log(`Compte administrateur mis a jour : ${email}`);
  } else {
    await db.insert(users).values({
      unionId: `local_${crypto.randomUUID()}`,
      email,
      name,
      role: "admin",
      provider: "local",
      passwordHash,
    });
    console.log(`Compte administrateur cree : ${email}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
