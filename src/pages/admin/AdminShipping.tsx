import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, X, Truck } from "lucide-react";

interface FormData {
  name: string;
  carrier: string;
  price: string;
  estimatedDays: string;
  sortOrder: string;
}

const emptyForm: FormData = { name: "", carrier: "colissimo", price: "", estimatedDays: "", sortOrder: "0" };

const carriers = [
  { value: "colissimo", label: "Colissimo (La Poste)" },
  { value: "chronopost", label: "Chronopost" },
  { value: "mondial_relay", label: "Mondial Relay" },
];

export default function AdminShipping() {
  const utils = trpc.useUtils();
  const { data: methods, isLoading } = trpc.shipping.listAll.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const create = trpc.shipping.create.useMutation({ onSuccess: () => { utils.shipping.listAll.invalidate(); setShowForm(false); setForm(emptyForm); } });
  const update = trpc.shipping.update.useMutation({ onSuccess: () => { utils.shipping.listAll.invalidate(); setShowForm(false); setEditingId(null); } });
  const del = trpc.shipping.delete.useMutation({ onSuccess: () => utils.shipping.listAll.invalidate() });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (m: any) => { setEditingId(m.id); setForm({ name: m.name, carrier: m.carrier, price: String(m.price), estimatedDays: m.estimatedDays || "", sortOrder: String(m.sortOrder || 0) }); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, carrier: form.carrier, price: form.price, estimatedDays: form.estimatedDays || undefined, sortOrder: parseInt(form.sortOrder) || 0 };
    if (editingId) update.mutate({ id: editingId, ...data }); else create.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Methodes de Livraison</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px]"><Plus size={14} /> Ajouter</button>
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
                <td className="px-4 py-3 text-[0.8125rem]">{m.name}</td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">{m.carrier}</td>
                <td className="px-4 py-3 text-[0.8125rem]">€{parseFloat(String(m.price)).toFixed(2)}</td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">{m.estimatedDays || "-"}</td>
                <td className="px-4 py-3"><span className={`text-[0.625rem] uppercase px-2 py-0.5 ${m.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{m.isActive ? "Actif" : "Inactif"}</span></td>
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
