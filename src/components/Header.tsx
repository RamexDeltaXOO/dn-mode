import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { Shipping, freeShippingBanner } from "@contracts/constants";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { useSiteContent } from "@/hooks/useSiteContent";

interface HeaderProps {
  onCartOpen: () => void;
  onSearchOpen: () => void;
  onNavOpen: () => void;
}

/** Une sequence complete du bandeau, dupliquee pour une boucle sans couture. */
function MarqueeSequence({ messages }: { messages: string[] }) {
  return (
    <>
      {messages.map((message, index) => (
        <span key={`${message}-${index}`} className="flex items-center shrink-0">
          <span className="px-6">{message}</span>
          <span aria-hidden="true" className="opacity-40">
            •
          </span>
        </span>
      ))}
    </>
  );
}

export default function Header({ onCartOpen, onSearchOpen, onNavOpen }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  // Menu du compte. L'icone deconnectait d'un seul clic, alors qu'elle est la
  // meme que "Mon compte" hors connexion : on se deconnectait sans le vouloir.
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [accountOpen]);

  const { data: cartData } = trpc.cart.get.useQuery();
  const cartCount = cartData?.items?.length || 0;

  // Seuil de livraison offerte pilote depuis le CRM (100€ par defaut).
  const { data: shippingSettings } = trpc.shipping.settings.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const banner = shippingSettings?.banner ?? freeShippingBanner();
  const threshold = shippingSettings?.threshold ?? Shipping.freeThreshold;
  // Repete pour que la sequence couvre toute la largeur d'un ecran desktop.
  // Messages du bandeau saisis dans le CRM, un par ligne.
  const { texts } = useSiteContent();
  const secondaryMessages = texts.bannerMessages.split("\n").map((m) => m.trim()).filter(Boolean);
  const marqueeMessages = Array.from({ length: 4 }, () => [banner, ...secondaryMessages]).flat();

  // Position precedente gardee dans une ref : l'en-tete ne se redessine que
  // quand il change d'etat, pas a chaque pixel de defilement.
  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 80);
      setHidden(current > lastScroll.current && current > 300);
      lastScroll.current = current;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Header transparent au-dessus de la photo sombre de l'accueil : logo et
  // icones passent en blanc pour rester lisibles.
  const overHero = pathname === "/" && !scrolled;

  return (
    <>
      {/* Top bar : bandeau defilant sur mobile comme sur desktop */}
      <div className="bg-[#121212] text-white text-[0.625rem] tracking-[1.5px] uppercase py-2 z-[110] relative overflow-hidden">
        <div className="overflow-hidden">
          <div className="marquee-track flex w-max whitespace-nowrap animate-marquee">
            <MarqueeSequence messages={marqueeMessages} />
            <span aria-hidden="true" className="flex">
              <MarqueeSequence messages={marqueeMessages} />
            </span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header
        className={`fixed left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.05)] top-0" : "bg-transparent top-8"
        } ${hidden ? "-translate-y-full" : "translate-y-0"} ${overHero ? "text-white" : ""}`}
      >
        <div className="flex items-center justify-between h-[60px] px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
          {/* Left: Menu */}
          <button onClick={onNavOpen} className="p-1 hover:opacity-60 transition-opacity" aria-label="Menu">
            <Menu size={20} strokeWidth={1.5} />
          </button>

          {/* Center: Logo */}
          <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="DN MODE">
            <img
              src="/logo-dnmode-160.webp"
              width={160}
              height={160}
              alt="DN MODE"
              className={`h-14 sm:h-[52px] w-auto transition-[filter] duration-300 ${
                overHero
                  ? "brightness-0 invert"
                  : scrolled
                    ? ""
                    : "drop-shadow-[0_1px_8px_rgba(255,255,255,0.55)]"
              }`}
            />
          </Link>

          {/* Right: Icons */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="p-1 hover:opacity-60 transition-opacity text-[0.625rem] uppercase tracking-[1px]"
              >
                CRM
              </button>
            )}
            {isAuthenticated ? (
              <div ref={accountRef} className="relative flex items-center gap-2">
                <span className={`text-[0.625rem] hidden sm:inline ${overHero ? "text-white/70" : "text-[#666666]"}`}>{user?.name}</span>
                <button
                  onClick={() => setAccountOpen((open) => !open)}
                  className="relative p-1 hover:opacity-60 transition-opacity"
                  aria-label="Mon compte"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <User size={20} strokeWidth={1.5} />
                  {/* Distingue l'icone connectee de celle de connexion. */}
                  <span aria-hidden="true" className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-600" />
                </button>
                {accountOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#e8e8e8] shadow-lg py-2 text-left">
                    <div className="px-4 pb-2 mb-1 border-b border-[#f0f0f0]">
                      <p className="text-[0.8125rem] text-[#222222] truncate">{user?.name || "Mon compte"}</p>
                      {user?.email && <p className="text-[0.6875rem] text-[#999999] truncate">{user.email}</p>}
                    </div>
                    <button
                      role="menuitem"
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-[0.6875rem] uppercase tracking-[1px] text-[#222222] hover:bg-[#f4f4f4]"
                    >
                      Se deconnecter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="p-1 hover:opacity-60 transition-opacity" aria-label="Mon compte">
                <User size={20} strokeWidth={1.5} />
              </Link>
            )}
            <button onClick={onSearchOpen} className="p-1 hover:opacity-60 transition-opacity" aria-label="Rechercher">
              <Search size={20} strokeWidth={1.5} />
            </button>
            <button onClick={onCartOpen} className="p-1 hover:opacity-60 transition-opacity relative" aria-label="Panier">
              <ShoppingBag size={20} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#222222] text-white text-[0.5rem] flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Valeur du seuil exposee aux lecteurs d'ecran uniquement */}
      <span className="sr-only">Livraison offerte a partir de {threshold} euros en {Shipping.zone}</span>
    </>
  );
}
