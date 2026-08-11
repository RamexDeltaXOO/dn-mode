import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";

interface HeaderProps {
  onCartOpen: () => void;
  onSearchOpen: () => void;
  onNavOpen: () => void;
}

export default function Header({ onCartOpen, onSearchOpen, onNavOpen }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const { data: cartData } = trpc.cart.get.useQuery();
  const cartCount = cartData?.items?.length || 0;

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setScrolled(current > 80);
      setHidden(current > lastScroll && current > 300);
      setLastScroll(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  return (
    <>
      {/* Top bar */}
      <div className="bg-[#121212] text-white text-[0.625rem] tracking-[1.5px] uppercase py-2 px-4 text-center z-[110] relative">
        <span className="hidden sm:inline">Livraison offerte a partir de 120€ — En France metropolitaine **</span>
        <span className="sm:hidden">Livraison offerte des 120€</span>
      </div>

      {/* Main header */}
      <header
        className={`fixed left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.05)] top-0" : "bg-transparent top-8"
        } ${hidden ? "-translate-y-full" : "translate-y-0"}`}
      >
        <div className="flex items-center justify-between h-[60px] px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
          {/* Left: Menu */}
          <button onClick={onNavOpen} className="p-1 hover:opacity-60 transition-opacity" aria-label="Menu">
            <Menu size={20} strokeWidth={1.5} />
          </button>

          {/* Center: Logo */}
          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 font-['Playfair_Display'] text-xl sm:text-[1.4rem] tracking-[-0.5px] text-[#222222]"
          >
            dn mode
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
              <div className="flex items-center gap-2">
                <span className="text-[0.625rem] text-[#666666] hidden sm:inline">{user?.name}</span>
                <button onClick={logout} className="p-1 hover:opacity-60 transition-opacity" title="Deconnexion">
                  <User size={20} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="p-1 hover:opacity-60 transition-opacity">
                <User size={20} strokeWidth={1.5} />
              </Link>
            )}
            <button onClick={onSearchOpen} className="p-1 hover:opacity-60 transition-opacity" aria-label="Search">
              <Search size={20} strokeWidth={1.5} />
            </button>
            <button onClick={onCartOpen} className="p-1 hover:opacity-60 transition-opacity relative" aria-label="Cart">
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
    </>
  );
}
