import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { newsletterSubscribers } from "@db/schema";

export const newsletterRouter = createRouter({
  subscribe: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      try {
        await db.insert(newsletterSubscribers).values({ email: input.email });
        return { success: true };
      } catch {
        return { success: true };
      }
    }),
});
