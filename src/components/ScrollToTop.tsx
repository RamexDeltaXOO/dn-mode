import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Remonte en douceur en haut de la page a chaque changement de page : sans
 * cela, la nouvelle page s'ouvrait a la hauteur ou l'on etait sur la
 * precedente. Le bouton retour du navigateur garde sa position, un lien vers
 * une ancre (#section) va a l'ancre, et l'animation est coupee pour qui a
 * demande a reduire les mouvements.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash || navigationType === "POP") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "instant" et non "auto" : le CSS du site met scroll-behavior: smooth.
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  }, [pathname, hash, navigationType]);

  return null;
}
