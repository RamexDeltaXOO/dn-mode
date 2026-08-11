import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, X } from "lucide-react";

interface FormData {
  name: string;
  slug: string;
  parentId: string;
}

const emptyForm: FormData = { name: "", slug: "", parentId: "" };

export default function AdminCategories() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.category.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const create = trpc.category.create.useMutation({ onSuccess: () => { utils.category.list.invalidate(); setShowForm(false); setForm(emptyForm); } });
  const update = trpc.category.update.useMutation({ onSuccess: () => { utils.category.list.invalidate(); setShowForm(false); setEditingId(null); setForm(emptyForm); } });
  const del = trpc.category.delete.useMutation({ onSuccess: () => utils.category.list.invalidate() });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c: any) => { setEditingId(c.id); setForm({ name: c.name, slug: c.slug, parentId: c.parentId ? String(c.parentId) : "" }); setShowForm(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"), parentId: form.parentId ? parseInt(form.parentId) : undefined };
    if (editingId) update.mutate({ id: editingId, ...data }); else create.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Categories</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px]"><Plus size={14} /> Ajouter</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[500px]">
            <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h2 className="text-[0.875rem] font-medium">{editingId ? "Modifier" : "Ajouter"} une categorie</h2>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div><label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Nom *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" /></div>
              <div><label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Slug</label><input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" /></div>
              <div><label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Categorie parente</label>
                <select value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})} className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white">
                  <option value="">Aucune</option>
                  {categories?.filter(c => c.id !== editingId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#222222] text-white py-2.5 text-[0.75rem] uppercase tracking-[2px]">{editingId ? "Mettre a jour" : "Creer"}</button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-[#f0f0f0]">
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Nom</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Slug</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Parent</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td></tr> :
            !categories?.length ? <tr><td colSpan={4} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune categorie</td></tr> :
            categories.map(c => (
              <tr key={c.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                <td className="px-4 py-3 text-[0.8125rem]">{c.name}</td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">{c.slug}</td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#999999]">{c.parentId ? categories.find(p => p.id === c.parentId)?.name || "-" : "-"}</td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="p-1 hover:bg-[#f0f0f0]"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm("Supprimer ?")) del.mutate({ id: c.id }); }} className="p-1 hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
