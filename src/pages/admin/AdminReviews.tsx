import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, X, Star } from "lucide-react";

interface ReviewForm {
  authorName: string;
  subtitle: string;
  content: string;
  rating: number;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm: ReviewForm = { authorName: "", subtitle: "", content: "", rating: 5, sortOrder: "0", isActive: true };

const labelClass = "text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1";
const inputClass = "w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]";

export default function AdminReviews() {
  const utils = trpc.useUtils();
  const { data: reviews, isLoading } = trpc.review.listAll.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyForm);

  const refresh = () => {
    utils.review.listAll.invalidate();
    utils.review.list.invalidate();
  };
  const close = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };
  const create = trpc.review.create.useMutation({ onSuccess: () => { refresh(); close(); } });
  const update = trpc.review.update.useMutation({ onSuccess: () => { refresh(); close(); } });
  const del = trpc.review.delete.useMutation({ onSuccess: refresh });
  const toggle = trpc.review.update.useMutation({ onSuccess: refresh });

  const openCreate = () => {
    create.reset();
    update.reset();
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (r: NonNullable<typeof reviews>[number]) => {
    create.reset();
    update.reset();
    setEditingId(r.id);
    setForm({
      authorName: r.authorName,
      subtitle: r.subtitle || "",
      content: r.content,
      rating: r.rating,
      sortOrder: String(r.sortOrder || 0),
      isActive: r.isActive ?? true,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      authorName: form.authorName,
      subtitle: form.subtitle || null,
      content: form.content,
      rating: form.rating,
      sortOrder: parseInt(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    if (editingId) update.mutate({ id: editingId, ...data });
    else create.mutate(data);
  };

  const error = create.error || update.error;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Avis clients</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-[#333333]"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <p className="text-[0.75rem] text-[#999999] mb-4">
        Les avis actifs s&apos;affichent en carrousel sur la page d&apos;accueil, dans l&apos;ordre indique.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[500px] max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h2 className="text-[0.875rem] font-medium">{editingId ? "Modifier" : "Ajouter"} un avis</h2>
              <button onClick={close}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Avis *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  required
                  maxLength={2000}
                  placeholder="Je recommande vraiment, les tenues sont magnifiques..."
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input
                    value={form.authorName}
                    onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                    required
                    placeholder="Assia C."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sous-titre</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    placeholder="Cliente DN MODE"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Note</label>
                  <div className="flex gap-1 py-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, rating: n })}
                        aria-label={`${n} etoile${n > 1 ? "s" : ""}`}
                      >
                        <Star size={22} className={n <= form.rating ? "fill-black text-black" : "text-[#cccccc]"} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Ordre</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[0.75rem]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                Afficher sur l&apos;accueil
              </label>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="w-full bg-[#222222] text-white py-2.5 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50"
              >
                {create.isPending || update.isPending ? "Enregistrement..." : editingId ? "Mettre a jour" : "Creer"}
              </button>
              {error && <p className="text-[0.75rem] text-red-600">{error.message}</p>}
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              {["Nom", "Avis", "Note", "Ordre", "Statut", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td></tr>
            ) : !reviews?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucun avis</td></tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa] align-top">
                  <td className="px-4 py-3 text-[0.8125rem] whitespace-nowrap">
                    {r.authorName}
                    {r.subtitle && <span className="block text-[0.6875rem] text-[#999999]">{r.subtitle}</span>}
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] text-[#666666] max-w-[360px]">
                    <span className="line-clamp-2">{r.content}</span>
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] whitespace-nowrap">{"★".repeat(r.rating)}</td>
                  <td className="px-4 py-3 text-[0.8125rem]">{r.sortOrder}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle.mutate({ id: r.id, isActive: !r.isActive })}
                      className={`text-[0.625rem] uppercase px-2 py-0.5 ${r.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      title="Cliquer pour changer"
                    >
                      {r.isActive ? "Affiche" : "Masque"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="p-1 hover:bg-[#f0f0f0]"><Pencil size={14} /></button>
                      <button
                        onClick={() => { if (confirm("Supprimer cet avis ?")) del.mutate({ id: r.id }); }}
                        className="p-1 hover:bg-red-50 text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
