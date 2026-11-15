import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState, Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Mail,
  MailOpen,
  Megaphone,
  Truck,
  LogOut,
  ChevronLeft,
  Settings,
  BarChart3,
  Star,
  Menu,
  ExternalLink,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useSeo } from "@/hooks/useSeo";
import { pageTitle } from "@contracts/seo";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Package, label: "Produits", path: "/admin/products" },
  { icon: Layers, label: "Collections", path: "/admin/collections" },
  { icon: ShoppingCart, label: "Commandes", path: "/admin/orders" },
  { icon: Truck, label: "Livraison", path: "/admin/shipping" },
  { icon: Star, label: "Avis", path: "/admin/reviews" },
  { icon: Mail, label: "Messages", path: "/admin/messages" },
  { icon: MailOpen, label: "Emails", path: "/admin/emails" },
  { icon: Megaphone, label: "Campagnes", path: "/admin/campaigns" },
  { icon: Settings, label: "Parametres", path: "/admin/settings" },
];

function AdminNavigation({
  pathname,
  userLabel,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  userLabel: string;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1a1a1a] text-white">
      <div className="flex h-[88px] shrink-0 items-center gap-3 border-b border-white/10 px-6">
        <img src="/logo-dnmode.png" alt="DN MODE" className="h-12 w-auto max-w-[130px] object-contain brightness-0 invert" />
        <span className="sr-only">Administration DN MODE</span>
      </div>

      <nav aria-label="Navigation de l'administration"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3.5 py-2.5 text-[0.8125rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${
                isActive
                  ? "bg-white/15 font-medium text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}>
              <item.icon size={18} strokeWidth={1.6} className="shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <p className="truncate px-3.5 pb-2 pt-1 text-[0.75rem] text-white/55" title={userLabel}>{userLabel}</p>
        <Link to="/" onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-md px-3.5 py-2 text-[0.8125rem] text-white/75 hover:bg-white/10 hover:text-white">
          <ChevronLeft size={17} aria-hidden="true" /> Retour a la boutique
        </Link>
        <button type="button" onClick={onLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-md px-3.5 py-2 text-left text-[0.8125rem] text-white/75 hover:bg-white/10 hover:text-white">
          <LogOut size={17} aria-hidden="true" /> Se deconnecter
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useSeo((site) => ({ title: pageTitle("Administration", site.siteName), noindex: true }));

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  // Fermer le tiroir lors d'une navigation, y compris via le bouton precedent.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#222222] border-t-transparent" />
      </div>
    );
  }
  if (!user || user.role !== "admin") return null;

  const currentPage = navItems.find((item) => item.path === location.pathname)?.label ?? "Administration";
  const closeMenu = () => setMenuOpen(false);
  const handleLogout = () => {
    closeMenu();
    logout();
  };

  return (
    <div className="min-h-[100dvh] min-w-0 bg-[#f4f4f4]">
      {/* Desktop: sidebar reservee aux ecrans larges. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-col lg:flex">
        <AdminNavigation pathname={location.pathname}
          userLabel={user.name || user.email || "Administrateur"}
          onNavigate={closeMenu} onLogout={handleLogout} />
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col lg:ml-[250px]">
        {/* Mobile/tablette: navigation masquee dans un tiroir accessible. */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[#e3e3e3] bg-white px-4 sm:px-6 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="Ouvrir le menu d'administration"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#e3e3e3] text-[#222222] hover:bg-[#f5f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#222222]">
                <Menu size={21} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined}
              className="z-50 h-[100dvh] w-[min(85vw,320px)] max-w-[320px] gap-0 border-0 bg-[#1a1a1a] p-0 text-white [&>button]:right-4 [&>button]:top-7 [&>button]:text-white">
              <SheetTitle className="sr-only">Menu d'administration</SheetTitle>
              <AdminNavigation pathname={location.pathname}
                userLabel={user.name || user.email || "Administrateur"}
                onNavigate={closeMenu} onLogout={handleLogout} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.6875rem] uppercase tracking-[1px] text-[#888888]">DN MODE · Admin</p>
            <p className="truncate text-[0.875rem] font-medium text-[#222222]">{currentPage}</p>
          </div>
          <Link to="/" aria-label="Retour a la boutique"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#555555] hover:text-[#111111]">
            <ExternalLink size={18} aria-hidden="true" />
          </Link>
        </header>

        <main id="admin-main-content" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7 xl:p-8">
          <div className="min-w-0 max-w-full">
            <Suspense fallback={<PageLoader className="min-h-[50vh]" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
