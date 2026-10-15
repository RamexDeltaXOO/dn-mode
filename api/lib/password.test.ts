import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { hitRateLimit, resetRateLimit } from "./rate-limit";

describe("mots de passe", () => {
  it("hache en scrypt avec un sel different a chaque fois", async () => {
    const a = await hashPassword("motdepasse-solide");
    const b = await hashPassword("motdepasse-solide");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toBe(b);
    expect(await verifyPassword("motdepasse-solide", a)).toBe(true);
    expect(await verifyPassword("mauvais", a)).toBe(false);
    expect(needsRehash(a)).toBe(false);
  });

  it("accepte encore les anciens hash SHA-256 et demande leur conversion", async () => {
    const legacy = createHash("sha256").update("ancien-mdp" + "dnmode-salt-2026-v2").digest("hex");
    expect(await verifyPassword("ancien-mdp", legacy)).toBe(true);
    expect(await verifyPassword("autre", legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
  });

  it("refuse un compte sans mot de passe ou un hash illisible", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "scrypt$abc")).toBe(false);
  });
});

describe("limite de tentatives", () => {
  it("bloque au-dela de la limite puis repart a zero", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) hitRateLimit(key, 3, 60_000);
    expect(() => hitRateLimit(key, 3, 60_000)).toThrow(/Trop de tentatives/);
    resetRateLimit(key);
    expect(() => hitRateLimit(key, 3, 60_000)).not.toThrow();
  });
});
