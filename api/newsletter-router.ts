import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { newsletterSubscribers } from "@db/schema";
import { clientIp, hitRateLimit } from "./lib/rate-limit";

export const newsletterRouter = createRouter({
  subscribe: publicQuery
    .input(z.object({ email: z.string().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      hitRateLimit(`newsletter:${clientIp(ctx.req)}`, 5, 10 * 60 * 1000);
      const db = getDb();
      try {
        await db.insert(newsletterSubscribers).values({ email: input.email });
        return { success: true };
      } catch {
        return { success: true };
      }
    }),
});
