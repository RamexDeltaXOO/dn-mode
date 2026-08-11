import { trpc } from "@/providers/trpc";
import { Eye, Users, TrendingUp, Package } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminAnalytics() {
  const { data: stats, isLoading } = trpc.analytics.getStats.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center h-[400px]"><div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" /></div>;
  }

  const dailyData = (stats?.dailyViews || []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    views: parseInt(d.count) || 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-light text-[#222222] mb-6">Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 shadow-sm border border-[#e8e8e8]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#999999]">Vues totales</span>
            <Eye size={18} className="text-[#cccccc]" />
          </div>
          <p className="text-2xl font-light text-[#222222]">{stats?.totalViews || 0}</p>
        </div>
        <div className="bg-white p-5 shadow-sm border border-[#e8e8e8]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#999999]">Visiteurs uniques</span>
            <Users size={18} className="text-[#cccccc]" />
          </div>
          <p className="text-2xl font-light text-[#222222]">{stats?.uniqueVisitors || 0}</p>
        </div>
        <div className="bg-white p-5 shadow-sm border border-[#e8e8e8]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#999999]">Vues aujourd'hui</span>
            <TrendingUp size={18} className="text-[#cccccc]" />
          </div>
          <p className="text-2xl font-light text-[#222222]">{stats?.todayViews || 0}</p>
        </div>
        <div className="bg-white p-5 shadow-sm border border-[#e8e8e8]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6875rem] uppercase tracking-[1.5px] text-[#999999]">Pages vues</span>
            <Package size={18} className="text-[#cccccc]" />
          </div>
          <p className="text-2xl font-light text-[#222222]">{stats?.viewsByPage?.length || 0}</p>
        </div>
      </div>

      {/* Daily Views Chart */}
      <div className="bg-white p-6 shadow-sm border border-[#e8e8e8] mb-8">
        <h2 className="text-[0.875rem] font-medium mb-4">Vues par jour (30 derniers jours)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#999" }} />
            <YAxis tick={{ fontSize: 11, fill: "#999" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 0, border: "1px solid #e0e0e0" }} />
            <Area type="monotone" dataKey="views" stroke="#222222" fill="#222222" fillOpacity={0.05} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-white shadow-sm border border-[#e8e8e8]">
          <div className="p-4 border-b border-[#f0f0f0]">
            <h2 className="text-[0.875rem] font-medium">Pages les plus visitees</h2>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {stats?.viewsByPage?.length === 0 ? (
              <p className="p-6 text-center text-[0.8125rem] text-[#999999]">Aucune donnee</p>
            ) : (
              stats?.viewsByPage?.map((vp: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[0.8125rem] truncate max-w-[250px]">{vp.page}</span>
                  <span className="text-[0.75rem] text-[#666666] font-medium">{vp.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white shadow-sm border border-[#e8e8e8]">
          <div className="p-4 border-b border-[#f0f0f0]">
            <h2 className="text-[0.875rem] font-medium">Produits les plus vus</h2>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {stats?.topProducts?.length === 0 ? (
              <p className="p-6 text-center text-[0.8125rem] text-[#999999]">Aucune donnee</p>
            ) : (
              stats?.topProducts?.map((tp: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[0.8125rem] truncate max-w-[250px]">{tp.productName}</span>
                  <span className="text-[0.75rem] text-[#666666] font-medium">{tp.views} vues</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
