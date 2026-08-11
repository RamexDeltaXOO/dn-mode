import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  /** Connexion MySQL (mysql://user:pass@host:port/base). */
  databaseUrl: required("DATABASE_URL"),
  /** Secret de signature HMAC des jetons de session. */
  appSecret: required("APP_SECRET"),
};
