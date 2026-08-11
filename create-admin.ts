import { getDb } from './api/queries/connection';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "dnmode-salt-2026-v2");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const db = getDb();

  // Add password_hash column if not exists
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
    console.log('password_hash column added');
  } catch (e: any) {
    console.log('Column may already exist:', e.message?.substring(0, 100));
  }

  // Check if admin exists
  const existing = await db.execute(`SELECT * FROM users WHERE email = 'admin@dnmode.fr'`);
  const rows = existing as any[];

  const passwordHash = await hashPassword("dnmodeadmin123!");

  if (rows.length > 0 && rows[0].length > 0) {
    // Update existing admin
    await db.execute(`
      UPDATE users 
      SET password_hash = '${passwordHash}', role = 'admin', name = 'Admin'
      WHERE email = 'admin@dnmode.fr'
    `);
    console.log('Admin account updated: admin@dnmode.fr / dnmodeadmin123!');
  } else {
    // Create admin
    await db.execute(`
      INSERT INTO users (unionId, email, name, role, password_hash, createdAt, updatedAt, lastSignInAt)
      VALUES ('local_admin', 'admin@dnmode.fr', 'Admin', 'admin', '${passwordHash}', NOW(), NOW(), NOW())
    `);
    console.log('Admin account created: admin@dnmode.fr / dnmodeadmin123!');
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
