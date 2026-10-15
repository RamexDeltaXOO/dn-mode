import { useEffect } from "react";
import { useLocation } from "react-router";
import { plainText } from "@contracts/seo";
import { useSiteContent } from "./useSiteContent";

export type SeoInput = {
  title: string;
  /** Description du site si absente. */
  description?: string;
  /** Page exclue des resultats de recherche (compte, panier, 404...). */
  noindex?: boolean;
};

type Site = { siteName: string; siteDescription: string };

function setMeta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Domaine officiel, tel que l'a pose le serveur dans og:url. */
function siteOrigin(): string {
  const ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
  try {
    return ogUrl ? new URL(ogUrl).origin : window.location.origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Titre, description, URL canonique et consigne d'indexation de la page.
 *
 * Au premier chargement, ces balises sont deja posees par le serveur
 * (api/lib/seo.ts), qui sert aussi les donnees structurees. Ce hook les garde
 * justes quand on change de page sans recharger. `build` vaut null tant que
 * la page n'a pas ses donnees : les balises en place ne bougent pas.
 */
export function useSeo(build: ((site: Site) => SeoInput) | null): void {
  const { pathname } = useLocation();
  const { siteName, siteDescription, isLoading } = useSiteContent();
  const seo = build && !isLoading ? build({ siteName, siteDescription }) : null;
  const title = seo?.title;
  const description = seo ? (seo.description ?? plainText(siteDescription)) : undefined;
  const noindex = seo?.noindex ?? false;

  useEffect(() => {
    if (title === undefined || description === undefined) return;
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const url = `${siteOrigin()}${path}`;

    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : null);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (noindex) {
      canonical?.remove();
    } else {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    // Donnees structurees et prechargement servis avec une autre page que
    // celle affichee.
    document.head.querySelectorAll<HTMLElement>("[data-seo-path]").forEach((el) => {
      if (el.dataset.seoPath !== path) el.remove();
    });
  }, [title, description, noindex, pathname]);
}
