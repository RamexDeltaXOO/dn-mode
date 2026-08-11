import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, X, Truck, RefreshCw, MapPin } from "lucide-react";
import { CARRIER_LIST } from "@contracts/constants";

interface FormData {
  name: string;
  carrier: string;
  price: string;
  estimatedDays: string;
  sortOrder: string;
  requiresServicePoint: boolean;
}

const emptyForm: FormData = {
  name: "",
  carrier: "colissimo",
  price: "",
  estimatedDays: "",
  sortOrder: "0",
  requiresServicePoint: false,
};

const carriers = CARRIER_LIST.map((c) => ({ value: c.code as string, label: c.label }));

export default function AdminShipping() {
  const utils = trpc.useUtils();
  const { data: methods, isLoading } = trpc.shipping.listAll.useQuery();
  type MethodRow = NonNullable<typeof methods>[number];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: sendcloudStatus } = trpc.sendcloud.status.useQuery(undefined, { retry: false });
  const syncMethods = trpc.sendcloud.syncMethods.useMutation({
    onSuccess: () => utils.shipping.listAll.invalidate(),
  });

  const create = trpc.shipping.create.useMutation({ onSuccess: () => { utils.shipping.listAll.invalidate(); setShowForm(false); setForm(emptyForm); } });
  const update = trpc.shipping.update.useMutation({ onSuccess: () => { utils.shipping.listAll.invalidate(); setShowForm(false); setEditingId(null); } });
  const del = trpc.shipping.delete.useMutation({ onSuccess: () => utils.shipping.listAll.invalidate() });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (m: MethodRow) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      carrier: m.carrier,
      price: String(m.price),
      estimatedDays: m.estimatedDays || "",
      sortOrder: String(m.sortOrder || 0),
      requiresServicePoint: Boolean(m.requiresServicePoint),
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      carrier: form.carrier,
      price: form.price,
      estimatedDays: form.estimatedDays || undefined,
      sortOrder: parseInt(form.sortOrder) || 0,
      requiresServicePoint: form.requiresServicePoint,
    };
    if (editingId) update.mutate({ id: editingId, ...data }); else create.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Methodes de Livraison</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px]"><Plus size={14} /> Ajouter</button>
      </div>

      {/* Sendcloud */}
      <div className="bg-white border border-[#e8e8e8] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Truck size={16} className="text-[#999999]" />
          <h2 className="text-[0.875rem] font-medium">Sendcloud</h2>
          <span
            className={`text-[0.5625rem] uppercase tracking-[1px] px-2 py-0.5 ${
              sendcloudStatus?.configured ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
            }`}
          >
            {sendcloudStatus?.configured ? "Connecte" : "Mode demo"}
          </span>
          <button
            onClick={() => syncMethods.mutate()}
            disabled={syncMethods.isPending}
            className="ml-auto flex items-center gap-2 border border-[#e0e0e0] px-3 py-1.5 text-[0.625rem] uppercase tracking-[1px] hover:border-[#222222] disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncMethods.isPending ? "animate-spin" : ""} />
            Synchroniser depuis Sendcloud
          </button>
        </div>
        {syncMethods.data && (
          <p className="text-[0.75rem] text-[#666666] mb-2">{syncMethods.data.message}</p>
        )}
        {!sendcloudStatus?.configured && (
          <p className="text-[0.6875rem] text-[#999999]">
            Renseignez vos cles API dans Parametres &gt; Livraison Sendcloud pour activer les
            etiquettes et les vrais points relais.
          </p>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {carriers.map(c => (
          <div key={c.value} className="bg-white border border-[#e8e8e8] p-4 flex items-center gap-3">
            <Truck size={20} className="text-[#999999]" />
            <div>
              <p className="text-[0.8125rem] font-medium">{c.label}</p>
              <p className="text-[0.625rem] text-[#999999] uppercase tracking-[1px]">
                {methods?.filter(m => m.carrier === c.value).length || 0} methode(s)
              </p>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[500px]">
            <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h2 className="text-[0.875rem] font-medium">{editingId ? "Modifier" : "Ajouter"} une methode</h2>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Nom *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" />
              </div>
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Transporteur *</label>
                <select value={form.carrier} onChange={e => setForm({...form, carrier: e.target.value})}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white">
                  {carriers.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Prix (EUR) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" />
                </div>
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Delai estime</label>
                  <input value={form.estimatedDays} onChange={e => setForm({...form, estimatedDays: e.target.value})}
                    placeholder="3-5 jours"
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[0.8125rem] text-[#666666] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresServicePoint}
                  onChange={(e) => setForm({ ...form, requiresServicePoint: e.target.checked })}
                  className="w-4 h-4 accent-[#222222]"
                />
                Livraison en point relais (le client choisit un point au checkout)
              </label>
              <button type="submit" className="w-full bg-[#222222] text-white py-2.5 text-[0.75rem] uppercase tracking-[2px]">
                {editingId ? "Mettre a jour" : "Creer"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-[#f0f0f0]">
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Nom</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Transporteur</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Prix</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Delai</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td></tr> :
            !methods?.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune methode</td></tr> :
            methods.map(m => (
              <tr key={m.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                <td className="px-4 py-3 text-[0.8125rem]">
                  {m.name}
                  {m.requiresServicePoint && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[0.5625rem] uppercase tracking-[1px] bg-[#f0f0f0] text-[#666666] px-1.5 py-0.5">
                      <MapPin size={9} /> Point relais
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">
                  {carriers.find((c) => c.value === m.carrier)?.label || m.carrier}
                </td>
                <td className="px-4 py-3 text-[0.8125rem]">€{parseFloat(String(m.price)).toFixed(2)}</td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">{m.estimatedDays || "-"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}
                    className={`text-[0.625rem] uppercase px-2 py-0.5 ${m.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    title="Activer / desactiver"
                  >
                    {m.isActive ? "Actif" : "Inactif"}
                  </button>
                </td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={() => openEdit(m)} className="p-1 hover:bg-[#f0f0f0]"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm("Supprimer ?")) del.mutate({ id: m.id }); }} className="p-1 hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
