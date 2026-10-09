import { HomeTextDefaults, type HomeTexts } from "@contracts/constants";
import { trpc } from "@/providers/trpc";

/**
 * Textes du site saisis dans le CRM (Parametres). Pendant le chargement ou en
 * cas d'erreur, on affiche les textes par defaut.
 */
export function useSiteContent(): { texts: HomeTexts; instagramUrl: string; isLoading: boolean } {
  const { data, isLoading } = trpc.config.siteContent.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    texts: data?.texts ?? { ...HomeTextDefaults },
    instagramUrl: data?.instagramUrl ?? "https://www.instagram.com",
    isLoading,
  };
}
