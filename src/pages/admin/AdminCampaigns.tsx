import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Trash2, Plus, Eye, Send, X, Check } from "lucide-react";

const campaignTypes = [
  { value: "promo", label: "Promotion" },
  { value: "black_friday", label: "Black Friday" },
  { value: "new_year", label: "Nouvel An" },
  { value: "soldes", label: "Soldes" },
  { value: "newsletter", label: "Newsletter" },
  { value: "event", label: "Evenement" },
];

const presetTemplates: Record<string, { subject: string; html: string }> = {
  black_friday: {
    subject: "BLACK FRIDAY - Jusqu'a -50% chez DN MODE",
    html: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:0;color:#222;background:#000">
  <div style="background:#fff;padding:40px 30px;margin:20px auto">
    <h1 style="font-family:Playfair Display,serif;font-weight:400;text-align:center;font-size:24px;letter-spacing:6px">DN MODE</h1>
    <h2 style="text-align:center;font-size:42px;letter-spacing:8px;margin:20px 0">BLACK<br>FRIDAY</h2>
    <p style="text-align:center;font-size:18px;margin:20px 0">Jusqu'a <strong>-50%</strong> sur toute la collection</p>
    <a href="{{shopUrl}}" style="display:block;background:#222;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:30px auto;max-width:280px">PROFITER DES OFFRES</a>
    <p style="text-align:center;color:#999;font-size:11px;margin-top:20px">Offre valable jusqu'au 30 novembre</p>
  </div>
</body></html>`,
  },
  new_year: {
    subject: "Bonne annee ! Nouvelle collection DN MODE",
    html: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 30px;color:#222">
  <h1 style="font-family:Playfair Display,serif;font-weight:400;text-align:center;font-size:24px;letter-spacing:6px">DN MODE</h1>
  <h2 style="text-align:center;font-size:36px;margin:30px 0;color:#c9a96e">Bonne Annee !</h2>
  <p style="text-align:center;font-size:16px;margin:20px 0">Decouvrez notre nouvelle collection pour cette nouvelle annee.</p>
  <a href="{{shopUrl}}" style="display:block;background:#222;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:30px auto;max-width:280px">DECOUVRIR LA COLLECTION</a>
  <p style="text-align:center;color:#999;font-size:11px;margin-top:30px">DN MODE vous souhaite une merveilleuse annee</p>
</body></html>`,
  },
  soldes: {
    subject: "SOLDES - Jusqu'a -70% chez DN MODE",
    html: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 30px;color:#222">
  <h1 style="font-family:Playfair Display,serif;font-weight:400;text-align:center;font-size:24px;letter-spacing:6px">DN MODE</h1>
  <h2 style="text-align:center;font-size:42px;letter-spacing:8px;margin:20px 0;color:#e74c3c">SOLDES</h2>
  <p style="text-align:center;font-size:18px;margin:20px 0">Jusqu'a <strong style="color:#e74c3c">-70%</strong> sur une selection d'articles</p>
  <a href="{{shopUrl}}" style="display:block;background:#e74c3c;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:30px auto;max-width:280px">SHOPPER LES SOLDES</a>
  <p style="text-align:center;color:#999;font-size:11px;margin-top:20px">Quantites limitees - Offres valable jusqu'a epuisement</p>
</body></html>`,
  },
  promo: {
    subject: "Offre speciale DN MODE - Profitez de -10%",
    html: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 30px;color:#222">
  <h1 style="font-family:Playfair Display,serif;font-weight:400;text-align:center;font-size:24px;letter-spacing:6px">DN MODE</h1>
  <h2 style="text-align:center;font-size:32px;margin:30px 0">Offre Speciale</h2>
  <p style="text-align:center;font-size:18px;margin:20px 0"><strong>-10% sur votre premiere commande</strong></p>
  <p style="text-align:center;font-size:14px;color:#666">Code : <strong style="background:#f4f4f4;padding:4px 12px">BIENVENUE10</strong></p>
  <a href="{{shopUrl}}" style="display:block;background:#222;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:30px auto;max-width:280px">J'EN PROFITE</a>
</body></html>`,
  },
  newsletter: {
    subject: "Les nouveautes DN MODE sont arrivees",
    html: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 30px;color:#222">
  <h1 style="font-family:Playfair Display,serif;font-weight:400;text-align:center;font-size:24px;letter-spacing:6px">DN MODE</h1>
  <h2 style="text-align:center;font-size:28px;margin:30px 0">Nouvelles Arrivees</h2>
  <p style="text-align:center;font-size:16px;margin:20px 0">Decouvrez nos nouveaux modeles pour la saison.</p>
  <a href="{{shopUrl}}" style="display:block;background:#222;color:#fff;padding:16px;text-align:center;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:30px auto;max-width:280px">DECOUVRIR</a>
</body></html>`,
  },
};

export default function AdminCampaigns() {
  const utils = trpc.useUtils();
  const { data: campaignList, isLoading } = trpc.campaign.list.useQuery();
  const create = trpc.campaign.create.useMutation({ onSuccess: () => { utils.campaign.list.invalidate(); setShowForm(false); } });
  const del = trpc.campaign.delete.useMutation({ onSuccess: () => utils.campaign.list.invalidate() });
  const sendNow = trpc.campaign.sendNow.useMutation({
    onSuccess: (data) => { setSentMsg(`${data.recipientCount} emails envoyes !`); setTimeout(() => setSentMsg(""), 3000); utils.campaign.list.invalidate(); },
  });

  const [showForm, setShowForm] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [sentMsg, setSentMsg] = useState("");
  const [form, setForm] = useState({
    name: "", type: "promo", subject: "", htmlContent: "", imageUrl: "", scheduledAt: "",
  });

  const applyPreset = (type: string) => {
    const preset = presetTemplates[type];
    if (preset) {
      setForm(prev => ({ ...prev, type, subject: preset.subject, htmlContent: preset.html }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form);
  };

  const previewCampaign = campaignList?.find(c => c.id === previewId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Campagnes Email</h1>
        <div className="flex items-center gap-3">
          {sentMsg && <span className="text-[0.8125rem] text-green-600 flex items-center gap-1"><Check size={14} />{sentMsg}</span>}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px]"><Plus size={14} /> Nouvelle campagne</button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white w-full max-w-[700px] max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-[#f0f0f0] flex items-center justify-between">
              <h3 className="text-[0.875rem] font-medium">Nouvelle campagne</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Preset selector */}
              <div>
                <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-2">Template predefini</label>
                <div className="flex flex-wrap gap-2">
                  {campaignTypes.map(ct => (
                    <button key={ct.value} type="button" onClick={() => applyPreset(ct.value)}
                      className={`px-3 py-1.5 text-[0.6875rem] border transition-colors ${form.type === ct.value ? "border-[#222222] bg-[#222222] text-white" : "border-[#e0e0e0] text-[#666666] hover:border-[#222222]"}`}>
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Nom *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]" />
                </div>
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Sujet *</label>
                  <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]" />
                </div>
              </div>

              <div>
                <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Contenu HTML *</label>
                <textarea value={form.htmlContent} onChange={e => setForm({...form, htmlContent: e.target.value})} required rows={10}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.75rem] outline-none focus:border-[#222222] resize-none font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Image URL</label>
                  <input value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})}
                    placeholder="https://..."
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]" />
                </div>
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Programmer (optionnel)</label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]" />
                </div>
              </div>

              {/* Live Preview */}
              {form.htmlContent && (
                <div className="border border-[#e0e0e0]">
                  <div className="bg-[#f4f4f4] px-3 py-2 text-[0.625rem] uppercase tracking-[1px] text-[#999999]">Apercu en direct</div>
                  <iframe srcDoc={form.htmlContent.replace(/{{shopUrl}}/g, window.location.origin)} className="w-full h-[250px] border-0" />
                </div>
              )}

              <button type="submit" disabled={create.isPending}
                className="w-full bg-[#222222] text-white py-2.5 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50">
                {create.isPending ? "Creation..." : "Creer la campagne"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewId && previewCampaign && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[600px] max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-[#f0f0f0] flex items-center justify-between">
              <h3 className="text-[0.875rem] font-medium">{previewCampaign.name}</h3>
              <button onClick={() => setPreviewId(null)}><X size={16} /></button>
            </div>
            <iframe srcDoc={previewCampaign.htmlContent.replace(/{{shopUrl}}/g, window.location.origin)} className="w-full h-[500px] border-0" />
          </div>
        </div>
      )}

      {/* Campaigns List */}
      <div className="bg-white shadow-sm border border-[#e8e8e8] overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-[#f0f0f0]">
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Nom</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Type</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Statut</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Destinataires</th>
            <th className="px-4 py-3 text-[0.6875rem] uppercase tracking-[1px] text-[#999999] font-normal">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</td></tr> :
            !campaignList?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[0.8125rem] text-[#999999]">Aucune campagne</td></tr> :
            campaignList.map(c => (
              <tr key={c.id} className="border-b border-[#f8f8f8] hover:bg-[#fafafa]">
                <td className="px-4 py-3 text-[0.8125rem]">{c.name}</td>
                <td className="px-4 py-3 text-[0.75rem] uppercase">{c.type}</td>
                <td className="px-4 py-3">
                  <span className={`text-[0.625rem] uppercase px-2 py-0.5 ${
                    c.status === "sent" ? "bg-green-100 text-green-800" :
                    c.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                    c.status === "cancelled" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-[0.75rem] text-[#666666]">{c.recipientCount || 0}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => setPreviewId(c.id)} className="p-1.5 hover:bg-[#f4f4f4]" title="Apercu"><Eye size={13} /></button>
                    {c.status === "draft" && (
                      <button onClick={() => sendNow.mutate({ id: c.id })} className="p-1.5 hover:bg-green-50 text-green-600" title="Envoyer"><Send size={13} /></button>
                    )}
                    <button onClick={() => { if (confirm("Supprimer ?")) del.mutate({ id: c.id }); }} className="p-1.5 hover:bg-red-50 text-red-600" title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
