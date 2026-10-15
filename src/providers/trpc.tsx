import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

// Donnees reutilisees 30 s sans nouvel appel : passer d'une page a l'autre
// ne recharge pas les memes produits. Les mutations (panier, CRM)
// invalident explicitement ce qu'elles modifient.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const sessionId = localStorage.getItem("dnmode_session_id");
        const localToken = localStorage.getItem("dnmode_local_token");
        return {
          ...(sessionId ? { "x-session-id": sessionId } : {}),
          ...(localToken ? { "x-local-auth-token": localToken } : {}),
        };
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
