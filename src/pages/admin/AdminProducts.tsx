import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, Search, X } from "lucide-react";

interface ProductForm {
  name: string;
  slug: string;
  price: string;
  description: string;
  shortDescription: string;
  images: string;
  colors: string;
  sizes: string;
  inventoryQuantity: string;
  collectionId: string;
  isActive: boolean;
  isFeatured: boolean;
}

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  price: "",
  description: "",
  shortDescription: "",
  images: "",
  colors: "",
  sizes: "",
  inventoryQuantity: "0",
  collectionId: "",
  isActive: true,
  isFeatured: false,
};

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const { data: productsData, isLoading } = trpc.product.list.useQuery({ page: 1, limit: 100, includeInactive: true });
  const { data: collections } = trpc.collection.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [search, setSearch] = useState("");

  const createProduct = trpc.product.create.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const updateProduct = trpc.product.update.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    },
  });

  const deleteProduct = trpc.product.delete.useMutation({
    onSuccess: () => utils.product.list.invalidate(),
  });

  const products = productsData?.products || [];
  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (product: (typeof products)[0]) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      slug: product.slug,
      price: String(product.price),
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      images: (product.images || []).join(","),
      colors: (product.colors || []).join(","),
      sizes: (product.sizes || []).join(","),
      inventoryQuantity: String(product.inventoryQuantity || 0),
      collectionId: product.collectionId ? String(product.collectionId) : "",
      isActive: product.isActive || false,
      isFeatured: product.isFeatured || false,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      price: form.price,
      description: form.description || undefined,
      shortDescription: form.shortDescription || undefined,
      images: form.images ? form.images.split(",").map((s) => s.trim()) : [],
      colors: form.colors ? form.colors.split(",").map((s) => s.trim()) : [],
      sizes: form.sizes ? form.sizes.split(",").map((s) => s.trim()) : [],
      inventoryQuantity: parseInt(form.inventoryQuantity) || 0,
      collectionId: form.collectionId ? parseInt(form.collectionId) : undefined,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    };
    if (editingId) {
      updateProduct.mutate({ id: editingId, ...data });
    } else {
      createProduct.mutate(data);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Produits</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-[#333333]"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center border-b border-[#e0e0e0] bg-white px-4 mb-4">
        <Search size={16} className="text-[#999999]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="flex-1 py-2.5 px-3 text-[0.875rem] outline-none bg-transparent"
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X size={14} className="text-[#999999]" />
          </button>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[600px] max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h2 className="text-[0.875rem] font-medium">
                {editingId ? "Modifier" : "Ajouter"} un produit
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Nom *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="auto-genere"
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Prix (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Stock</label>
                  <input
                    type="number"
                    value={form.inventoryQuantity}
                    onChange={(e) => setForm({ ...form, inventoryQuantity: e.target.value })}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] resize-none"
                />
              </div>
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Images (URLs separees par des virgules)</label>
                <input
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                  placeholder="/product-1.jpg, /product-2.jpg"
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Couleurs</label>
                  <input
                    value={form.colors}
                    onChange={(e) => setForm({ ...form, colors: e.target.value })}
                    placeholder="Rouge, Bleu, Noir"
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                  />
                </div>
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Tailles</label>
                  <input
                    value={form.sizes}
                    onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                    placeholder="S, M, L, XL"
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Collection</label>
                  <select
                    value={form.collectionId}
                    onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white"
                  >
                    <option value="">Aucune</option>
                    {collections?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-[0.75rem]">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4"
                    />
                    Actif
                  </label>
                  <label className="flex items-center gap-2 text-[0.75rem]">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                      className="w-4 h-4"
                    />
                    Mis en avant
                  </label>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={createProduct.isPending || updateProduct.isPending}
                  className="w-full bg-[#222222] text-white py-2.5 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50"
                >
                  {createProduct.isPending || updateProduct.isPending
                    ? "Enregistrement..."
                    : editingId
                    ? "Mettre a jour"
                    : "Creer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#f0f0f0]">
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Image</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Nom</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Prix</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Stock</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
              <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucun produit</td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="w-10 h-12 bg-[#f4f4f4] overflow-hidden">
                      <img
                        src={(product.images || [])[0] || "/placeholder.png"}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem]">{product.name}</td>
                  <td className="px-4 py-3 text-[0.8125rem]">€{parseFloat(product.price as string).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[0.8125rem]">{product.inventoryQuantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[0.625rem] uppercase px-2 py-0.5 ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {product.isActive ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="p-1 hover:bg-[#f0f0f0] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Supprimer ce produit ?")) {
                            deleteProduct.mutate({ id: product.id });
                          }
                        }}
                        className="p-1 hover:bg-red-50 text-red-600 transition-colors"
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
