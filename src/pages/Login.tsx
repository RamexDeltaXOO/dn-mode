import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { LogIn, UserPlus } from "lucide-react";

const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Connexion Google annulee.",
  google_missing_code: "Reponse Google incomplete, merci de reessayer.",
  google_token: "Google a refuse la connexion. Verifiez la configuration dans le CRM.",
  google_profile: "Impossible de recuperer votre profil Google.",
  google_unverified: "Votre adresse Gmail n'est pas verifiee.",
  google_account: "Impossible de creer votre compte, merci de reessayer.",
  google_failed: "La connexion Google a echoue.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(searchParams.get("error") ? GOOGLE_ERRORS[searchParams.get("error") as string] || "La connexion a echoue." : "");
  const [googlePending, setGooglePending] = useState(false);

  const utils = trpc.useUtils();
  const { data: googleConfig } = trpc.googleAuth.getConfig.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = trpc.localAuth.loginPassword.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("dnmode_local_token", data.token);
      window.location.href = "/";
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("dnmode_local_token", data.token);
      window.location.href = "/";
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password, name: name || undefined });
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGooglePending(true);
    try {
      const result = await utils.googleAuth.getAuthUrl.fetch({ redirectTo: "/" });
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      setError("La connexion Gmail n'est pas encore configuree.");
    } catch {
      setError("Impossible de demarrer la connexion Gmail.");
    }
    setGooglePending(false);
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="pt-[92px] min-h-[100dvh] flex items-center justify-center bg-[#f4f4f4]">
      <div className="w-full max-w-[400px] bg-white border border-[#e8e8e8] p-8">
        <div className="text-center mb-8">
          <img src="/logo-dnmode.png" alt="DN MODE" className="h-8 w-auto mx-auto mb-4" />
          <p className="text-[0.8125rem] text-[#666666] mt-2">
            {mode === "login" ? "Connectez-vous a votre compte" : "Creez votre compte"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex border border-[#e0e0e0] mb-6">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 text-[0.75rem] uppercase tracking-[1px] transition-colors ${
              mode === "login" ? "bg-[#222222] text-white" : "bg-white text-[#666666] hover:text-[#222222]"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 text-[0.75rem] uppercase tracking-[1px] transition-colors ${
              mode === "register" ? "bg-[#222222] text-white" : "bg-white text-[#666666] hover:text-[#222222]"
            }`}
          >
            Inscription
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-[0.8125rem] mb-4">
            {error}
          </div>
        )}

        {/* Connexion via Gmail */}
        {googleConfig?.enabled && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googlePending}
              className="w-full flex items-center justify-center gap-3 bg-white border border-[#e0e0e0] text-[#222222] py-3 text-[0.75rem] uppercase tracking-[2px] hover:border-[#222222] transition-colors disabled:opacity-50"
            >
              {googlePending ? (
                <div className="w-4 h-4 border border-[#222222] border-t-transparent animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[1px] bg-[#e0e0e0]" />
              <span className="text-[0.625rem] uppercase tracking-[1.5px] text-[#999999]">ou</span>
              <div className="flex-1 h-[1px] bg-[#e0e0e0]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222]"
              />
            </div>
          )}

          <div>
            <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222]"
            />
          </div>

          <div>
            <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Mot de passe *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-[#e0e0e0] px-3 py-2.5 text-[0.875rem] outline-none focus:border-[#222222]"
            />
            {mode === "register" && (
              <p className="text-[0.625rem] text-[#999999] mt-1">Minimum 6 caracteres</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#222222] text-white py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <div className="w-4 h-4 border border-white border-t-transparent animate-spin" />
            ) : mode === "login" ? (
              <><LogIn size={14} /> Se connecter</>
            ) : (
              <><UserPlus size={14} /> S&apos;inscrire</>
            )}
          </button>
        </form>

        <p className="text-center text-[0.6875rem] text-[#999999] mt-6">
          En vous connectant, vous acceptez nos conditions d&apos;utilisation.
        </p>
        <p className="text-center mt-3">
          <Link to="/" className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#666666] hover:text-[#222222]">
            Retour a la boutique
          </Link>
        </p>
      </div>
    </div>
  );
}
