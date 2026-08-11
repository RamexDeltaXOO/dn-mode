import { useEffect, useState } from "react";
import { Link } from "react-router";

/** Lit le jeton depuis le fragment d'URL (#token=...&redirect=...). */
function readCallbackHash(): { token: string | null; redirect: string } {
  if (typeof window === "undefined") return { token: null, redirect: "/" };
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const redirect = params.get("redirect") || "/";
  return {
    token: params.get("token"),
    redirect: redirect.startsWith("/") ? redirect : "/",
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
          <img src="/logo-dnmode.png" alt="DN MODE" className="h-8 w-auto mx-auto mb-4" />
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
