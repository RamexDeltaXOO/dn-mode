import { useEffect, useState } from "react";
import { Link } from "react-router";
import { safeRedirectPath } from "@contracts/constants";
import { OAUTH_NONCE_KEY } from "@/lib/oauth";

/**
 * Lit le jeton depuis le fragment d'URL (#token=...&redirect=...&nonce=...).
 * Le jeton n'est accepte que si `nonce` est celui tire par cet onglet au
 * depart vers Google : un lien envoye par quelqu'un d'autre ne connecte pas
 * le visiteur a un compte qui n'est pas le sien.
 */
function readCallbackHash(): { token: string | null; redirect: string } {
  if (typeof window === "undefined") return { token: null, redirect: "/" };
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  let expected: string | null = null;
  try {
    expected = sessionStorage.getItem(OAUTH_NONCE_KEY);
    sessionStorage.removeItem(OAUTH_NONCE_KEY);
  } catch {
    expected = null;
  }
  const nonce = params.get("nonce");
  return {
    token: expected && nonce === expected ? params.get("token") : null,
    redirect: safeRedirectPath(params.get("redirect")),
  };
}

/**
 * Page d'atterrissage apres la connexion Google.
 * Le serveur redirige ici avec le jeton dans le fragment d'URL, on le stocke
 * puis on renvoie l'utilisateur la ou il etait.
 */
export default function AuthCallback() {
  const [{ token, redirect }] = useState(readCallbackHash);
  const failed = token === null;

  useEffect(() => {
    if (!token) return;
    localStorage.setItem("dnmode_local_token", token);
    // On quitte la page : le fragment disparait avec elle.
    window.location.replace(redirect);
  }, [token, redirect]);

  if (failed) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f4f4] px-4">
        <div className="w-full max-w-[400px] bg-white border border-[#e8e8e8] p-8 text-center">
          <img src="/logo-dnmode-160.webp" width={160} height={160} alt="DN MODE" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-[0.875rem] text-[#222222] mb-2">Connexion impossible</p>
          <p className="text-[0.8125rem] text-[#666666] mb-6">
            Le jeton de connexion est absent ou expire.
          </p>
          <Link
            to="/login"
            className="inline-block bg-[#222222] text-white px-6 py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333]"
          >
            Retour a la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f4f4f4] gap-4">
      <div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" />
      <p className="text-[0.75rem] uppercase tracking-[2px] text-[#999999]">Connexion...</p>
    </div>
  );
}
