import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { verifyLocalToken } from "./local-auth-router";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try local JWT auth
  try {
    const localToken = opts.req.headers.get("x-local-auth-token");
    if (localToken) {
      const payload = verifyLocalToken(localToken);
      if (payload) {
        const db = getDb();
        const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
        if (user) {
          ctx.user = user;
        }
      }
    }
  } catch {
    // Local auth failed
  }

  return ctx;
}
