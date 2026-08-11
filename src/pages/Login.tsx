import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { LogIn, UserPlus } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="pt-[92px] min-h-[100dvh] flex items-center justify-center bg-[#f4f4f4]">
      <div className="w-full max-w-[400px] bg-white border border-[#e8e8e8] p-8">
        <div className="text-center mb-8">
          <img src="/logo-dnmode.png" alt="DN MODE" className="h-8 mx-auto mb-4" />
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
      </div>
    </div>
  );
}
