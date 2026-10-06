import { Outlet, Link, useLocation } from "react-router";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  Layers,
  FolderTree,
  ShoppingCart,
  Mail,
  MailOpen,
  Megaphone,
  Truck,
  LogOut,
  ChevronLeft,
  Settings,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Package, label: "Produits", path: "/admin/products" },
  { icon: Layers, label: "Collections", path: "/admin/collections" },
  { icon: FolderTree, label: "Categories", path: "/admin/categories" },
  { icon: ShoppingCart, label: "Commandes", path: "/admin/orders" },
  { icon: Truck, label: "Livraison", path: "/admin/shipping" },
  { icon: Mail, label: "Messages", path: "/admin/messages" },
  { icon: MailOpen, label: "Emails", path: "/admin/emails" },
  { icon: Megaphone, label: "Campagnes", path: "/admin/campaigns" },
  { icon: Settings, label: "Parametres", path: "/admin/settings" },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-[100dvh] flex bg-[#f4f4f4]">
      {/* Sidebar */}
      <aside className="w-[250px] bg-[#1a1a1a] text-white flex flex-col flex-shrink-0 fixed h-full overflow-auto">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo-dnmode.png" alt="DN MODE" className="h-14 w-auto brightness-0 invert" />
        </div>

        <nav className="flex-1 px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] transition-colors ${
                  isActive
                    ? "bg-white/10 border-l-2 border-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="px-4 py-2 text-[0.75rem] text-white/40 truncate">{user.name || user.email}</div>
          <Link to="/" className="flex items-center gap-3 px-4 py-2 text-[0.75rem] text-white/60 hover:text-white transition-colors">
            <ChevronLeft size={16} />
            Retour au site
          </Link>
          <button onClick={logout} className="flex items-center gap-3 px-4 py-2 text-[0.75rem] text-white/60 hover:text-white transition-colors w-full">
            <LogOut size={16} />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-[250px] flex-1 min-h-[100dvh]">
        <div className="p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
