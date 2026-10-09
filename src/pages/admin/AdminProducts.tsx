import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Trash2, Plus, Search, X } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import { slugify, variantKey, variantKeys } from "@contracts/constants";

interface ProductForm {
  name: string;
  slug: string;
  price: string;
  description: string;
  shortDescription: string;
  images: string[];
  colors: string;
  sizes: string;
  weightGrams: string;
  inventoryQuantity: string;
  /** Stock saisi par combinaison, indexe par variantKey(couleur, taille). */
  variantStock: Record<string, string>;
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
  images: [],
  colors: "",
  sizes: "",
  weightGrams: "",
  inventoryQuantity: "0",
  variantStock: {},
  collectionId: "",
  isActive: true,
  isFeatured: false,
};

function parseList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

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
    createProduct.reset();
    updateProduct.reset();
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (product: (typeof products)[0]) => {
    createProduct.reset();
    updateProduct.reset();
    setEditingId(product.id);
    setForm({
      name: product.name,
      slug: product.slug,
      price: String(product.price),
      description: product.description || "",
      shortDescription: product.shortDescription || "",
      images: product.images || [],
      colors: (product.colors || []).join(","),
      sizes: (product.sizes || []).join(","),
      weightGrams: product.weightGrams ? String(product.weightGrams) : "",
      inventoryQuantity: String(product.inventoryQuantity || 0),
      variantStock: Object.fromEntries(
        Object.entries(product.variantStock || {}).map(([k, v]) => [k, String(v)]),
      ),
      collectionId: product.collectionId ? String(product.collectionId) : "",
      isActive: product.isActive || false,
      isFeatured: product.isFeatured || false,
    });
    setShowForm(true);
  };

  // Des qu'il y a des couleurs ou des tailles, le stock se saisit par
  // combinaison et le stock total en devient la somme.
  const formColors = parseList(form.colors);
  const formSizes = parseList(form.sizes);
  const hasVariants = formColors.length > 0 || formSizes.length > 0;
  const keys = variantKeys(formColors, formSizes);
  const variantTotal = keys.reduce((sum, k) => sum + (parseInt(form.variantStock[k] ?? "", 10) || 0), 0);

  const setVariantQty = (key: string, value: string) =>
    setForm({ ...form, variantStock: { ...form.variantStock, [key]: value } });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const variantStock = hasVariants
      ? Object.fromEntries(keys.map((k) => [k, Math.max(0, parseInt(form.variantStock[k] ?? "", 10) || 0)]))
      : null;
    const data = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      price: form.price,
      description: form.description || undefined,
      shortDescription: form.shortDescription || undefined,
      images: form.images.filter((url) => url.trim() !== ""),
      colors: formColors,
      sizes: formSizes,
      weightGrams: form.weightGrams.trim() === "" ? null : parseInt(form.weightGrams, 10) || 0,
      inventoryQuantity: hasVariants ? variantTotal : parseInt(form.inventoryQuantity) || 0,
      variantStock,
      collectionId: form.collectionId ? parseInt(form.collectionId) : null,
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
                    min="0"
                    value={hasVariants ? String(variantTotal) : form.inventoryQuantity}
                    onChange={(e) => setForm({ ...form, inventoryQuantity: e.target.value })}
                    disabled={hasVariants}
                    title={hasVariants ? "Somme du stock par couleur et taille" : undefined}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] disabled:bg-[#f8f8f8] disabled:text-[#666666]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">
                  Poids (grammes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={form.weightGrams}
                  onChange={(e) => setForm({ ...form, weightGrams: e.target.value })}
                  placeholder="350"
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
                />
                <p className="text-[0.625rem] text-[#999999] mt-1">
                  Poids d&apos;une piece, emballage exclu. Sert a choisir la tranche tarifaire du
                  transporteur et a declarer le poids exact du colis a Sendcloud. Laisse vide pour
                  utiliser le poids par defaut des Parametres.
                </p>
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
              <ImageUploader
                value={form.images}
                onChange={(images) => setForm({ ...form, images })}
              />
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
              {hasVariants && (
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">
                    Stock par {formColors.length > 0 && formSizes.length > 0 ? "couleur et taille" : formColors.length > 0 ? "couleur" : "taille"}
                  </label>
                  <div className="overflow-x-auto border border-[#e0e0e0]">
                    <table className="w-full text-[0.75rem]">
                      {formSizes.length > 0 && (
                        <thead>
                          <tr className="bg-[#fafafa]">
                            {formColors.length > 0 && <th className="px-2 py-1.5 text-left font-normal text-[#999999]" />}
                            {formSizes.map((size) => (
                              <th key={size} className="px-2 py-1.5 text-center font-normal text-[#666666]">{size}</th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {(formColors.length > 0 ? formColors : [""]).map((color) => (
                          <tr key={color} className="border-t border-[#f0f0f0]">
                            {formColors.length > 0 && (
                              <td className="px-2 py-1.5 text-[#666666] whitespace-nowrap">{color}</td>
                            )}
                            {(formSizes.length > 0 ? formSizes : [""]).map((size) => {
                              const key = variantKey(color, size);
                              return (
                                <td key={key} className="px-1 py-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={form.variantStock[key] ?? ""}
                                    onChange={(e) => setVariantQty(key, e.target.value)}
                                    placeholder="0"
                                    aria-label={`Stock ${[color, size].filter(Boolean).join(" ")}`}
                                    className="w-full min-w-[3.5rem] border border-[#e0e0e0] px-2 py-1 text-center outline-none focus:border-[#222222]"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[0.625rem] text-[#999999] mt-1">
                    Le stock total ({variantTotal}) est calcule automatiquement.
                  </p>
                </div>
              )}
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
                {(createProduct.error || updateProduct.error) && (
                  <p className="text-[0.75rem] text-red-600 mt-2">
                    {(createProduct.error || updateProduct.error)?.message}
                  </p>
                )}
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
