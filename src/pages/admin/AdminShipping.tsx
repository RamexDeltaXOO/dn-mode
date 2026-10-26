import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar, SelectAllCell, SelectCell } from "@/components/admin/BulkSelection";
import { Pencil, Trash2, Plus, X, Truck, RefreshCw, MapPin, AlertTriangle } from "lucide-react";
import { CARRIER_LIST } from "@contracts/constants";
import { type RateTier, hasWeightRange, readMethodConfig } from "@contracts/shipping-rates";

interface RateRow {
  upToKg: string;
  price: string;
}

interface FormData {
  name: string;
  carrier: string;
  price: string;
  estimatedDays: string;
  sortOrder: string;
  requiresServicePoint: boolean;
  /** Vide : service choisi automatiquement. */
  sendcloudService: string;
  rates: RateRow[];
}

const emptyForm: FormData = {
  name: "",
  carrier: "colissimo",
  price: "",
  estimatedDays: "",
  sortOrder: "0",
  requiresServicePoint: false,
  sendcloudService: "",
  rates: [],
};

const carriers = CARRIER_LIST.map((c) => ({ value: c.code as string, label: c.label }));

const toRows = (rates: RateTier[]): RateRow[] =>
  rates.map((r) => ({ upToKg: String(r.upToKg), price: r.price.toFixed(2) }));

/** Tranches saisies valides, triees par poids croissant. */
function parseRows(rows: RateRow[]): RateTier[] {
  return rows
    .map((r) => ({
      upToKg: Number.parseFloat(r.upToKg.replace(",", ".")),
      price: Number.parseFloat(r.price.replace(",", ".")),
    }))
    .filter((r) => Number.isFinite(r.upToKg) && r.upToKg > 0 && Number.isFinite(r.price) && r.price >= 0)
    .sort((a, b) => a.upToKg - b.upToKg);
}

export default function AdminShipping() {
  const utils = trpc.useUtils();
  const { data: methods, isLoading } = trpc.shipping.listAll.useQuery();
  type MethodRow = NonNullable<typeof methods>[number];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: sendcloudStatus } = trpc.sendcloud.status.useQuery(undefined, { retry: false });
  // Services Sendcloud du compte et service retenu pour chaque offre.
  const { data: sendcloud, isLoading: servicesLoading } = trpc.sendcloud.services.useQuery(undefined, { retry: false });
  const refresh = () => { utils.shipping.listAll.invalidate(); utils.sendcloud.services.invalidate(); };
  const syncMethods = trpc.sendcloud.syncMethods.useMutation({ onSuccess: refresh });

  const create = trpc.shipping.create.useMutation({ onSuccess: () => { refresh(); setShowForm(false); setForm(emptyForm); } });
  const update = trpc.shipping.update.useMutation({ onSuccess: () => { refresh(); setShowForm(false); setEditingId(null); } });
  const del = trpc.shipping.delete.useMutation({ onSuccess: refresh });
  const selection = useBulkSelection(methods?.map((m) => m.id) ?? []);
  const delMany = trpc.shipping.deleteMany.useMutation({ onSuccess: () => { refresh(); selection.clear(); } });

  // Lignes creees par l'ancienne synchronisation : une par tranche de poids.
  const legacyCount = methods?.filter((m) => m.sendcloudMethodId !== null && hasWeightRange(m.name)).length ?? 0;
  const serviceFor = (id: number) => sendcloud?.links.find((l) => l.methodId === id)?.service ?? null;

  // Services possibles pour le transporteur et le mode saisis ; le premier
  // est celui que le choix automatique retient.
  const formServices = (sendcloud?.services ?? []).filter(
    (s) => s.carrier === form.carrier && s.requiresServicePoint === form.requiresServicePoint,
  );
  const chosenService = formServices.find((s) => s.name === form.sendcloudService) ?? formServices[0] ?? null;

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (m: MethodRow) => {
    const config = readMethodConfig(m.config);
    setEditingId(m.id);
    setForm({
      name: m.name,
      carrier: m.carrier,
      price: String(m.price),
      estimatedDays: m.estimatedDays || "",
      sortOrder: String(m.sortOrder || 0),
      requiresServicePoint: Boolean(m.requiresServicePoint),
      sendcloudService: config.sendcloudService ?? "",
      rates: toRows(config.rates),
    });
    setShowForm(true);
  };

  const setRate = (index: number, patch: Partial<RateRow>) =>
    setForm({ ...form, rates: form.rates.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  const addRate = () => {
    const last = parseRows(form.rates).at(-1);
    const next = last
      ? { upToKg: String(last.upToKg < 1 ? last.upToKg + 0.5 : last.upToKg + 1), price: last.price.toFixed(2) }
      : { upToKg: "0.5", price: form.price };
    setForm({ ...form, rates: [...form.rates, next] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rates = parseRows(form.rates);
    const data = {
      name: form.name,
      carrier: form.carrier,
      price: rates.length > 0 ? rates[0].price : form.price,
      estimatedDays: form.estimatedDays || undefined,
      sortOrder: parseInt(form.sortOrder) || 0,
      requiresServicePoint: form.requiresServicePoint,
      rates,
      sendcloudService: form.sendcloudService || null,
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
        <p className="text-[0.6875rem] text-[#999999]">
          Chaque ligne ci-dessous est un choix propose au client. Son prix suit le poids du colis
          (grille de tarifs), et la tranche de poids Sendcloud est choisie automatiquement a la
          creation de l&apos;etiquette.
        </p>
        {sendcloudStatus?.configured && sendcloud?.error && (
          <p className="text-[0.75rem] text-red-600 mt-2">
            Sendcloud injoignable ({sendcloud.error}) : les services affiches sont ceux de demonstration.
          </p>
        )}
        {legacyCount > 0 && (
          <p className="text-[0.75rem] text-[#9a6700] mt-2 flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            {legacyCount} tranche(s) de poids importee(s) par l&apos;ancienne synchronisation. Cliquez sur
            « Synchroniser depuis Sendcloud » pour les regrouper.
          </p>
        )}
        {!sendcloudStatus?.configured && (
          <p className="text-[0.6875rem] text-[#999999] mt-2">
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
          <div className="bg-white w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
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
                <select value={form.carrier} onChange={e => setForm({...form, carrier: e.target.value, sendcloudService: ""})}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white">
                  {carriers.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.rates.length === 0 && (
                  <div>
                    <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Prix unique (EUR) *</label>
                    <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required
                      className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" />
                  </div>
                )}
                <div>
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Delai estime</label>
                  <input value={form.estimatedDays} onChange={e => setForm({...form, estimatedDays: e.target.value})}
                    placeholder="3-5 jours"
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999]">Tarif selon le poids du colis</label>
                  {chosenService && chosenService.suggestedRates.length > 0 && (
                    <button type="button" onClick={() => setForm({ ...form, rates: toRows(chosenService.suggestedRates) })}
                      className="text-[0.625rem] uppercase tracking-[1px] text-[#666666] underline">
                      Reprendre les tarifs Sendcloud
                    </button>
                  )}
                </div>
                {form.rates.length === 0 ? (
                  <p className="text-[0.75rem] text-[#999999] mb-2">Prix unique, quel que soit le poids du colis.</p>
                ) : (
                  <div className="space-y-2 mb-2">
                    {form.rates.map((rate, index) => (
                      <div key={index} className="flex items-center gap-2 text-[0.75rem] text-[#666666]">
                        <span className="w-14">Jusqu&apos;a</span>
                        <input type="number" step="0.01" min="0.01" value={rate.upToKg} required
                          onChange={e => setRate(index, { upToKg: e.target.value })}
                          className="w-20 border border-[#e0e0e0] px-2 py-1.5 text-[0.8125rem] text-[#222222] outline-none focus:border-[#222222]" />
                        <span>kg</span>
                        <input type="number" step="0.01" min="0" value={rate.price} required
                          onChange={e => setRate(index, { price: e.target.value })}
                          className="w-20 border border-[#e0e0e0] px-2 py-1.5 text-[0.8125rem] text-[#222222] outline-none focus:border-[#222222]" />
                        <span>EUR</span>
                        <button type="button" onClick={() => setForm({ ...form, rates: form.rates.filter((_, i) => i !== index) })}
                          className="ml-auto p-1 hover:bg-red-50 text-red-600" title="Retirer la tranche"><X size={14} /></button>
                      </div>
                    ))}
                    <p className="text-[0.6875rem] text-[#999999]">Au-dela de la derniere tranche, son prix s&apos;applique.</p>
                  </div>
                )}
                <button type="button" onClick={addRate}
                  className="flex items-center gap-1 border border-[#e0e0e0] px-2 py-1 text-[0.625rem] uppercase tracking-[1px] hover:border-[#222222]">
                  <Plus size={11} /> Ajouter une tranche de poids
                </button>
              </div>

              <label className="flex items-center gap-2 text-[0.8125rem] text-[#666666] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresServicePoint}
                  onChange={(e) => setForm({ ...form, requiresServicePoint: e.target.checked, sendcloudService: "" })}
                  className="w-4 h-4 accent-[#222222]"
                />
                Livraison en point relais (le client choisit un point au checkout)
              </label>

              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1">Service Sendcloud (etiquette)</label>
                <select value={form.sendcloudService} onChange={e => setForm({...form, sendcloudService: e.target.value})}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white">
                  <option value="">{formServices[0] ? `Automatique (${formServices[0].name})` : "Automatique"}</option>
                  {formServices.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name}{s.maxWeight !== null ? ` · jusqu'a ${s.maxWeight} kg` : ""}
                    </option>
                  ))}
                  {form.sendcloudService && !formServices.some(s => s.name === form.sendcloudService) && (
                    <option value={form.sendcloudService}>{form.sendcloudService} (introuvable)</option>
                  )}
                </select>
                {sendcloud && formServices.length === 0 && (
                  <p className="text-[0.6875rem] text-red-600 mt-1">
                    Aucun service {carriers.find((c) => c.value === form.carrier)?.label}{" "}
                    {form.requiresServicePoint ? "en point relais" : "a domicile"} sur votre compte Sendcloud :
                    les etiquettes ne pourront pas etre creees pour cette offre.
                  </p>
                )}
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
            <SelectAllCell selection={selection} />
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Nom</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Transporteur</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Prix</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Delai</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Sendcloud</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td></tr> :
            !methods?.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune methode</td></tr> :
            methods.map(m => {
              const { rates } = readMethodConfig(m.config);
              const service = serviceFor(m.id);
              return (
              <tr key={m.id} className={`border-b border-[#f8f8f8] hover:bg-[#fafafa] ${selection.isSelected(m.id) ? "bg-[#f6f6f6]" : ""}`}>
                <SelectCell selection={selection} id={m.id} />
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
                <td className="px-4 py-3 text-[0.8125rem] whitespace-nowrap">
                  {rates.length > 0 ? (
                    <span title={rates.map((r) => `jusqu'a ${r.upToKg} kg : €${r.price.toFixed(2)}`).join("\n")}>
                      €{rates[0].price.toFixed(2)}
                      {rates.length > 1 && <> a €{rates[rates.length - 1].price.toFixed(2)}</>}
                      <span className="block text-[0.6875rem] text-[#999999]">{rates.length} tranche(s) de poids</span>
                    </span>
                  ) : (
                    <>€{parseFloat(String(m.price)).toFixed(2)}</>
                  )}
                </td>
                <td className="px-4 py-3 text-[0.8125rem] text-[#666666]">{m.estimatedDays || "-"}</td>
                <td className="px-4 py-3 text-[0.75rem] text-[#666666]">
                  {servicesLoading ? "..." : service ? service : (
                    <span className="inline-flex items-center gap-1 text-red-600" title="Les etiquettes ne pourront pas etre creees pour cette offre">
                      <AlertTriangle size={11} /> Aucun service
                    </span>
                  )}
                </td>
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
              );
            })}
          </tbody>
        </table>
      </div>
      <BulkActionBar selection={selection} noun="methode(s)" onDelete={(ids) => delMany.mutate({ ids })} pending={delMany.isPending} />
    </div>
  );
}
