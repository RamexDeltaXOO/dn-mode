import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { Save, Check, CreditCard, Mail, Globe } from "lucide-react";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data: configs, isLoading } = trpc.config.list.useQuery();
  const setConfig = trpc.config.set.useMutation({ onSuccess: () => utils.config.list.invalidate() });
  const [saved, setSaved] = useState<string | null>(null);

  const configMap: Record<string, string> = {};
  configs?.forEach((c) => { configMap[c.key] = c.value || ""; });

  const [form, setForm] = useState({
    site_name: configMap["site_name"] || "DN MODE",
    site_description: configMap["site_description"] || "",
    contact_email: configMap["contact_email"] || "",
    shipping_threshold: configMap["shipping_threshold"] || "120",
    shipping_cost: configMap["shipping_cost"] || "5.90",
    currency: configMap["currency"] || "EUR",
    instagram_url: configMap["instagram_url"] || "",
    // Stripe
    stripe_publishable_key: configMap["stripe_publishable_key"] || "",
    stripe_secret_key: configMap["stripe_secret_key"] || "",
    // Gmail OAuth
    gmail_client_id: configMap["gmail_client_id"] || "",
    gmail_client_secret: configMap["gmail_client_secret"] || "",
  });

  // Update form when configs load
  useEffect(() => {
    if (configs) {
      const cm: Record<string, string> = {};
      configs.forEach((c) => { cm[c.key] = c.value || ""; });
      setForm(prev => ({
        ...prev,
        site_name: cm["site_name"] || prev.site_name,
        site_description: cm["site_description"] || prev.site_description,
        contact_email: cm["contact_email"] || prev.contact_email,
        shipping_threshold: cm["shipping_threshold"] || prev.shipping_threshold,
        shipping_cost: cm["shipping_cost"] || prev.shipping_cost,
        currency: cm["currency"] || prev.currency,
        instagram_url: cm["instagram_url"] || prev.instagram_url,
        stripe_publishable_key: cm["stripe_publishable_key"] || prev.stripe_publishable_key,
        stripe_secret_key: cm["stripe_secret_key"] || prev.stripe_secret_key,
        gmail_client_id: cm["gmail_client_id"] || prev.gmail_client_id,
        gmail_client_secret: cm["gmail_client_secret"] || prev.gmail_client_secret,
      }));
    }
  }, [configs]);

  const handleSave = (key: string, value: string) => {
    setConfig.mutate({ key, value }, {
      onSuccess: () => {
        setSaved(key);
        setTimeout(() => setSaved(null), 1500);
      },
    });
  };

  const handleSaveAll = () => {
    Object.entries(form).forEach(([key, value]) => {
      setConfig.mutate({ key, value });
    });
    setSaved("all");
    setTimeout(() => setSaved(null), 1500);
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#f0f0f0]">
      <Icon size={16} className="text-[#999999]" />
      <h2 className="text-[0.875rem] font-medium">{title}</h2>
    </div>
  );

  const Field = ({ label, value, onChange, type = "text", placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1.5">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222]"
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Parametres</h1>
        <button
          onClick={handleSaveAll}
          disabled={setConfig.isPending}
          className="flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-[#333333] disabled:opacity-50"
        >
          {saved === "all" ? <Check size={14} /> : <Save size={14} />}
          {saved === "all" ? "Enregistre !" : "Tout enregistrer"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[200px]">
          <div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Site Settings */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader icon={Globe} title="Site Web" />
            <div className="space-y-4">
              <Field label="Nom du site" value={form.site_name} onChange={(v) => setForm({ ...form, site_name: v })} placeholder="DN MODE" />
              <Field label="Description" value={form.site_description} onChange={(v) => setForm({ ...form, site_description: v })} placeholder="Description pour SEO..." />
              <Field label="Email de contact" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} placeholder="contact@dnmode.fr" />
              <Field label="URL Instagram" value={form.instagram_url} onChange={(v) => setForm({ ...form, instagram_url: v })} placeholder="https://instagram.com/..." />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Seuil livraison offerte" value={form.shipping_threshold} onChange={(v) => setForm({ ...form, shipping_threshold: v })} placeholder="120" />
                <Field label="Frais de livraison" value={form.shipping_cost} onChange={(v) => setForm({ ...form, shipping_cost: v })} placeholder="5.90" />
                <Field label="Devise" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} placeholder="EUR" />
              </div>
            </div>
          </div>

          {/* Stripe Settings */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader icon={CreditCard} title="Paiement Stripe" />
            <div className="space-y-4">
              <Field label="Stripe Publishable Key (pk_...)" value={form.stripe_publishable_key} onChange={(v) => setForm({ ...form, stripe_publishable_key: v })} placeholder="pk_test_..." />
              <Field label="Stripe Secret Key (sk_...)" value={form.stripe_secret_key} onChange={(v) => setForm({ ...form, stripe_secret_key: v })} type="password" placeholder="sk_test_..." />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleSave("stripe_publishable_key", form.stripe_publishable_key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "stripe_publishable_key" ? "OK" : "Enregistrer PK"}
                </button>
                <button onClick={() => handleSave("stripe_secret_key", form.stripe_secret_key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "stripe_secret_key" ? "OK" : "Enregistrer SK"}
                </button>
              </div>
              <p className="text-[0.6875rem] text-[#999999]">
                Laissez vide pour utiliser le mode demo (paiement simule).
              </p>
            </div>
          </div>

          {/* Gmail OAuth Settings */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader icon={Mail} title="Connexion Gmail (Google OAuth)" />
            <div className="space-y-4">
              <Field label="Google Client ID" value={form.gmail_client_id} onChange={(v) => setForm({ ...form, gmail_client_id: v })} placeholder="xxx.apps.googleusercontent.com" />
              <Field label="Google Client Secret" value={form.gmail_client_secret} onChange={(v) => setForm({ ...form, gmail_client_secret: v })} type="password" placeholder="GOCSPX-..." />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleSave("gmail_client_id", form.gmail_client_id)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "gmail_client_id" ? "OK" : "Enregistrer Client ID"}
                </button>
                <button onClick={() => handleSave("gmail_client_secret", form.gmail_client_secret)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "gmail_client_secret" ? "OK" : "Enregistrer Secret"}
                </button>
              </div>
              <div className="bg-[#f4f4f4] p-3 text-[0.6875rem] text-[#666666]">
                <p className="font-medium mb-1">URL de redirection autorisee :</p>
                <code className="text-[0.625rem] bg-white px-2 py-1 border border-[#e0e0e0]">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/oauth/callback
                </code>
                <p className="mt-2 text-[#999999]">
                  Configurez cette URL dans votre console Google Cloud.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
