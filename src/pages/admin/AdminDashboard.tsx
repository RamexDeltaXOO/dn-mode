import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Mail,
  Eye,
  MailOpen,
  Megaphone,
  Truck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  shipped: "Expedie",
  delivered: "Livre",
  cancelled: "Annule",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: analytics } = trpc.analytics.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin" />
      </div>
    );
  }

  const chartData = [
    { date: "01/06", revenue: 120 },
    { date: "02/06", revenue: 250 },
    { date: "03/06", revenue: 180 },
    { date: "04/06", revenue: 320 },
    { date: "05/06", revenue: 290 },
    { date: "06/06", revenue: 450 },
    { date: "07/06", revenue: 380 },
  ];

  const kpis = [
    { label: "Chiffre d'affaires", value: stats ? `€${stats.totalRevenue.toFixed(2)}` : "€0", icon: TrendingUp, link: "/admin/orders" },
    { label: "Commandes", value: stats?.totalOrders?.toString() || "0", icon: ShoppingCart, link: "/admin/orders" },
    { label: "Visiteurs", value: analytics?.uniqueVisitors?.toString() || "0", icon: Eye, link: "/admin/analytics" },
    { label: "Vues totales", value: analytics?.totalViews?.toString() || "0", icon: Users, link: "/admin/analytics" },
    { label: "Produits", value: stats?.totalProducts?.toString() || "0", icon: Package, link: "/admin/products" },
    { label: "Messages non lus", value: stats?.totalNewContacts?.toString() || "0", icon: Mail, link: "/admin/messages" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light text-[#222222]">Dashboard</h1>
        <span className="text-[0.75rem] text-[#999999]">{new Date().toLocaleDateString("fr-FR")}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.link} className="bg-white p-5 shadow-sm border border-[#e8e8e8] hover:border-[#222222] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#999999]">{kpi.label}</span>
              <kpi.icon size={18} className="text-[#cccccc]" />
            </div>
            <p className="text-2xl font-light text-[#222222]">{kpi.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link to="/admin/emails" className="flex items-center gap-2 bg-white border border-[#e8e8e8] px-4 py-2 text-[0.75rem] uppercase tracking-[1px] hover:border-[#222222]"><MailOpen size={14} /> Emails</Link>
        <Link to="/admin/campaigns" className="flex items-center gap-2 bg-white border border-[#e8e8e8] px-4 py-2 text-[0.75rem] uppercase tracking-[1px] hover:border-[#222222]"><Megaphone size={14} /> Campagnes</Link>
        <Link to="/admin/shipping" className="flex items-center gap-2 bg-white border border-[#e8e8e8] px-4 py-2 text-[0.75rem] uppercase tracking-[1px] hover:border-[#222222]"><Truck size={14} /> Livraison</Link>
      </div>

      {/* New Messages Alert */}
      {stats && stats.totalNewContacts > 0 && (
        <Link to="/admin/messages" className="flex items-center gap-3 bg-orange-50 border border-orange-200 px-5 py-3 mb-6 hover:bg-orange-100 transition-colors">
          <Mail size={18} className="text-orange-600" />
          <span className="text-[0.8125rem] text-orange-800">
            <strong>{stats.totalNewContacts}</strong> nouveau{stats.totalNewContacts > 1 ? "x" : ""} message{stats.totalNewContacts > 1 ? "s" : ""} non lu{stats.totalNewContacts > 1 ? "s" : ""}
          </span>
        </Link>
      )}

      {/* Revenue Chart */}
      <div className="bg-white p-6 shadow-sm border border-[#e8e8e8] mb-8">
        <h2 className="text-[0.875rem] font-medium mb-4">Chiffre d'affaires (7 derniers jours)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#999" }} />
            <YAxis tick={{ fontSize: 12, fill: "#999" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0, border: "1px solid #e0e0e0" }} formatter={(value: number) => [`€${value}`, "CA"]} />
            <Area type="monotone" dataKey="revenue" stroke="#222222" fill="#222222" fillOpacity={0.05} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Orders */}
      <div className="bg-white shadow-sm border border-[#e8e8e8] mb-8">
        <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
          <h2 className="text-[0.875rem] font-medium">Commandes recentes</h2>
          <Link to="/admin/orders" className="text-[0.75rem] text-[#999999] hover:text-[#222222] underline">Voir tout</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[#f0f0f0]">
              <th className="px-5 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Commande</th>
              <th className="px-5 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Client</th>
              <th className="px-5 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Date</th>
              <th className="px-5 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Total</th>
              <th className="px-5 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
            </tr></thead>
            <tbody>
              {stats?.recentOrders?.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune commande</td></tr>
              ) : (
                stats?.recentOrders?.map((order) => (
                  <tr key={order.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                    <td className="px-5 py-3 text-[0.8125rem] font-medium">{order.orderNumber}</td>
                    <td className="px-5 py-3 text-[0.8125rem] text-[#666666]">{order.firstName} {order.lastName || order.email}</td>
                    <td className="px-5 py-3 text-[0.75rem] text-[#999999]">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-5 py-3 text-[0.8125rem]">€{parseFloat(String(order.total)).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[0.625rem] uppercase tracking-[1px] px-2 py-1 ${statusColors[order.status || ""] || "bg-gray-100 text-gray-800"}`}>{statusLabels[order.status || ""] || order.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="bg-white shadow-sm border border-[#e8e8e8]">
        <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
          <h2 className="text-[0.875rem] font-medium">Messages recents</h2>
          <Link to="/admin/messages" className="text-[0.75rem] text-[#999999] hover:text-[#222222] underline">Voir tout</Link>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {stats?.recentContacts?.length === 0 ? (
            <p className="px-5 py-8 text-center text-[0.8125rem] text-[#999999]">Aucun message</p>
          ) : (
            stats?.recentContacts?.map((contact) => (
              <div key={contact.id} className={`px-5 py-4 ${contact.status === "new" ? "bg-orange-50/30" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.8125rem] font-medium">{contact.name}</span>
                  <span className="text-[0.75rem] text-[#999999]">{contact.email}</span>
                  {contact.status === "new" && <span className="w-2 h-2 bg-orange-400 rounded-full" />}
                </div>
                <p className="text-[0.75rem] text-[#666666] line-clamp-1">{contact.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
