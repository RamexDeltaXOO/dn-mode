import { describe, expect, it } from "vitest";
import { tokenMatchesCurrentUser, type TokenPayload } from "./local-auth-router";

const token: TokenPayload = {
  sub: 42,
  email: "Walid.bko47@gmail.com",
  role: "admin",
  iat: 1,
  exp: 1_000_000,
};

describe("tokenMatchesCurrentUser", () => {
  it("accepte une session dont l'email et le role correspondent au compte", () => {
    expect(tokenMatchesCurrentUser(token, { email: token.email, role: token.role })).toBe(true);
  });

  it("invalide l'ancienne session apres changement de l'email admin", () => {
    expect(tokenMatchesCurrentUser(token, { email: "sav.dnmode@gmail.com", role: "admin" })).toBe(false);
  });

  it("invalide une session apres retrait du role admin", () => {
    expect(tokenMatchesCurrentUser(token, { email: token.email, role: "user" })).toBe(false);
  });

  it("invalide une session apres promotion d'un utilisateur", () => {
    expect(tokenMatchesCurrentUser({ ...token, role: "user" }, { email: token.email, role: "admin" })).toBe(false);
  });
});
