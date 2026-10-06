import { useState } from "react";
import { Link } from "react-router";
import { Instagram } from "lucide-react";
import { trpc } from "@/providers/trpc";

const PAYMENT_METHODS = [
  "AMEX",
  "Apple Pay",
  "CB",
  "Mastercard",
  "PayPal",
  "Shop Pay",
  "Visa",
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setSubscribed(true);
      setEmail("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) subscribe.mutate({ email });
  };

  return (
    <footer className="bg-white border-t border-[#e0e0e0]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Newsletter */}
          <div>
            <h3 className="section-label mb-4">Newsletter</h3>
            <p className="text-[0.8125rem] text-[#666666] mb-4">
              Inscrivez-vous pour ne rien manquer !
            </p>
            {subscribed ? (
              <p className="text-[0.9375rem] text-[#222222]">Merci pour votre inscription !</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center border-b border-[#222222]">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresse courriel"
                  className="flex-1 bg-transparent py-2 text-[0.875rem] outline-none placeholder:text-[#999999]"
                  required
                />
                <button type="submit" className="text-[0.6875rem] uppercase tracking-[1.5px] hover:opacity-60 transition-opacity py-2">
                  {subscribe.isPending ? "..." : "S'inscrire"}
                </button>
              </form>
            )}
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">
                <Instagram size={20} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* My Account */}
          <div>
            <h3 className="section-label mb-4">Mon Compte</h3>
            <ul className="space-y-2">
              <li><Link to="/account" className="text-[0.8125rem] text-[#666666] hover:text-[#222222] transition-colors">Mes commandes</Link></li>
              <li><Link to="/account" className="text-[0.8125rem] text-[#666666] hover:text-[#222222] transition-colors">Mon compte</Link></li>
              <li><Link to="/contact" className="text-[0.8125rem] text-[#666666] hover:text-[#222222] transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Logo */}
          <div className="flex items-start justify-center lg:justify-center">
            <Link to="/" aria-label="DN MODE">
              <img src="/logo-dnmode.png" alt="DN MODE" className="h-8 w-auto" />
            </Link>
          </div>

          {/* Info */}
          <div>
            <div className="text-[0.6875rem] uppercase tracking-[1.5px] mb-4">Français</div>
            <div className="flex flex-wrap gap-2 opacity-60">
              {PAYMENT_METHODS.map((method) => (
                <span key={method} className="text-[0.625rem] border border-[#e0e0e0] px-2 py-1 text-[#666666]">
                  {method}
                </span>
              ))}
            </div>
            <p className="text-[0.6875rem] text-[#aaaaaa] mt-4 font-light">
              WEBSITE DESIGN BY RAMEXA
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
