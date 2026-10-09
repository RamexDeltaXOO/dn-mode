import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Save, Check, CreditCard, Mail, Globe, Truck, Copy, Image, LayoutTemplate, Type } from "lucide-react";
import { HomeImageDefaults, HomeTextDefaults, Paths, Shipping } from "@contracts/constants";
import SingleImageUploader from "@/components/admin/SingleImageUploader";

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
};

/**
 * Field et SectionHeader sont declares au niveau module : les redefinir dans
 * le corps du composant remonterait les inputs a chaque frappe (perte de focus).
 */
function Field({ label, value, onChange, type = "text", placeholder }: FieldProps) {
  return (
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
}

const TEXT_KEYS = [
  "home_hero_button",
  "home_hero_collection",
  "home_brand_text",
  "home_products_link",
  "home_products_collection",
  "home_look_button",
  "home_look_collection",
  "home_reviews_title",
  "banner_messages",
] as const;

function CollectionSelect({ label, value, onChange, collections }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  collections: Array<{ slug: string; name: string }>;
}) {
  const known = value === "all" || collections.some((c) => c.slug === value);
  return (
    <div>
      <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white"
      >
        <option value="all">Tous les articles</option>
        {collections.map((c) => (
          <option key={c.slug} value={c.slug}>{c.name}</option>
        ))}
        {!known && <option value={value}>{value} (introuvable)</option>}
      </select>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: typeof Globe;
  title: string;
  badge?: { label: string; ok: boolean };
}) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#f0f0f0]">
      <Icon size={16} className="text-[#999999]" />
      <h2 className="text-[0.875rem] font-medium">{title}</h2>
      {badge && (
        <span
          className={`ml-auto text-[0.5625rem] uppercase tracking-[1px] px-2 py-0.5 ${
            badge.ok ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  site_name: "DN MODE",
  site_description: "",
  contact_email: "",
  shipping_threshold: String(Shipping.freeThreshold),
  shipping_cost: "5.90",
  currency: "EUR",
  instagram_url: "",
  // Page d'accueil (vide = image par defaut)
  home_hero_image: "",
  home_look_image: "",
  // Textes du site (pre-remplis avec les textes actuels)
  home_hero_button: HomeTextDefaults.heroButton as string,
  home_hero_collection: HomeTextDefaults.heroCollection as string,
  home_brand_text: HomeTextDefaults.brandText as string,
  home_products_link: HomeTextDefaults.productsLink as string,
  home_products_collection: HomeTextDefaults.productsCollection as string,
  home_look_button: HomeTextDefaults.lookButton as string,
  home_look_collection: HomeTextDefaults.lookCollection as string,
  home_reviews_title: HomeTextDefaults.reviewsTitle as string,
  banner_messages: HomeTextDefaults.bannerMessages as string,
  // Stripe
  stripe_publishable_key: "",
  stripe_secret_key: "",
  stripe_webhook_secret: "",
  // Gmail OAuth
  gmail_client_id: "",
  gmail_client_secret: "",
  // Sendcloud
  sendcloud_public_key: "",
  sendcloud_secret_key: "",
  sendcloud_sender_address_id: "",
  sendcloud_default_weight: "1",
  sendcloud_packaging_weight: "100",
  // Stockage des images
  storage_endpoint: "",
  storage_region: "auto",
  storage_bucket: "",
  storage_access_key: "",
  storage_secret_key: "",
  storage_public_url: "",
  // Emails
  resend_api_key: "",
  from_email: "",
  support_email: "",
};

type ConfigRow = { key: string; value: string | null };

/** Valeurs initiales du formulaire, calculees une seule fois au montage. */
function initialForm(configs: ConfigRow[]): typeof EMPTY_FORM {
  const cm: Record<string, string> = {};
  configs.forEach((c) => { cm[c.key] = c.value || ""; });
  const next = { ...EMPTY_FORM };
  (Object.keys(EMPTY_FORM) as Array<keyof typeof EMPTY_FORM>).forEach((key) => {
    if (cm[key]) next[key] = cm[key];
  });
  return next;
}

export default function AdminSettings() {
  const { data: configs, isLoading } = trpc.config.list.useQuery();

  if (isLoading || !configs) {
    return (
      <div>
        <h1 className="text-2xl font-light text-[#222222] mb-6">Parametres</h1>
        <div className="flex items-center justify-center h-[200px]">
          <div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Le formulaire n'est monte qu'une fois la config chargee : son etat initial
  // vient des props, sans effet de synchronisation.
  return <SettingsForm configs={configs} />;
}

function SettingsForm({ configs }: { configs: ConfigRow[] }) {
  const utils = trpc.useUtils();
  const setConfig = trpc.config.set.useMutation({
    onSuccess: () => {
      utils.config.list.invalidate();
      utils.config.homeImages.invalidate();
      utils.config.siteContent.invalidate();
    },
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}${Paths.stripeWebhook}` : "";

  const { data: sendcloudStatus } = trpc.sendcloud.status.useQuery(undefined, { retry: false });
  const testSendcloud = trpc.sendcloud.testConnection.useMutation({
    onSuccess: () => utils.sendcloud.status.invalidate(),
  });

  const { data: storageStatus } = trpc.upload.status.useQuery(undefined, { retry: false });
  const { data: collections } = trpc.collection.list.useQuery();
  const { data: emailStatus } = trpc.email.status.useQuery(undefined, { retry: false });
  const seedTemplates = trpc.email.seedDefaults.useMutation({
    onSuccess: () => utils.email.listTemplates.invalidate(),
  });

  const [form, setForm] = useState(() => initialForm(configs));

  const handleSave = (key: string, value: string) => {
    setConfig.mutate({ key, value }, {
      onSuccess: () => {
        setSaved(key);
        setTimeout(() => setSaved(null), 1500);
      },
    });
  };

  const handleSaveTexts = async () => {
    try {
      await Promise.all(TEXT_KEYS.map((key) => setConfig.mutateAsync({ key, value: form[key] })));
      setSaved("texts");
    } catch {
      setSaved("texts-error");
    }
    setTimeout(() => setSaved(null), 1500);
  };

  const handleSaveAll = () => {
    Object.entries(form).forEach(([key, value]) => {
      setConfig.mutate({ key, value });
    });
    setSaved("all");
    setTimeout(() => setSaved(null), 1500);
  };

  const redirectUri =
    typeof window !== "undefined" ? `${window.location.origin}${Paths.googleAuthCallback}` : "";

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
                <Field label="Seuil livraison offerte (€)" value={form.shipping_threshold} onChange={(v) => setForm({ ...form, shipping_threshold: v })} placeholder="100" />
                <Field label="Frais de livraison" value={form.shipping_cost} onChange={(v) => setForm({ ...form, shipping_cost: v })} placeholder="5.90" />
                <Field label="Devise" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} placeholder="EUR" />
              </div>
              <p className="text-[0.6875rem] text-[#999999]">
                Livraison offerte a partir de {form.shipping_threshold || Shipping.freeThreshold}€ en {Shipping.zone}.
              </p>
            </div>
          </div>

          {/* Page d'accueil */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader icon={LayoutTemplate} title="Page d'accueil" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SingleImageUploader
                label="Image du bandeau principal"
                hint="Affichee en fond, assombrie, derriere le message d'accueil. Format paysage conseille."
                value={form.home_hero_image}
                defaultUrl={HomeImageDefaults.hero}
                storageReady={Boolean(storageStatus?.configured)}
                aspect="aspect-[16/9]"
                onChange={(v) => setForm({ ...form, home_hero_image: v })}
                onCommit={(v) => {
                  setForm((f) => ({ ...f, home_hero_image: v }));
                  handleSave("home_hero_image", v);
                }}
              />
              <SingleImageUploader
                label="Image « Look du moment »"
                hint="Affichee au format 16/9 sous les produits, avec le bouton vers la collection."
                value={form.home_look_image}
                defaultUrl={HomeImageDefaults.look}
                storageReady={Boolean(storageStatus?.configured)}
                aspect="aspect-[16/9]"
                onChange={(v) => setForm({ ...form, home_look_image: v })}
                onCommit={(v) => {
                  setForm((f) => ({ ...f, home_look_image: v }));
                  handleSave("home_look_image", v);
                }}
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center mt-4">
              <button
                onClick={() => {
                  handleSave("home_hero_image", form.home_hero_image);
                  handleSave("home_look_image", form.home_look_image);
                }}
                className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]"
              >
                {saved === "home_hero_image" || saved === "home_look_image" ? "OK" : "Enregistrer les visuels"}
              </button>
              <p className="text-[0.6875rem] text-[#999999]">
                Une image envoyee est enregistree aussitot. Une URL collee a la main s&apos;enregistre avec ce bouton.
              </p>
            </div>
          </div>

          {/* Textes du site */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader icon={Type} title="Textes du site" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bouton du bandeau principal" value={form.home_hero_button} onChange={(v) => setForm({ ...form, home_hero_button: v })} placeholder={HomeTextDefaults.heroButton} />
                <CollectionSelect label="Il mene vers" value={form.home_hero_collection} onChange={(v) => setForm({ ...form, home_hero_collection: v })} collections={collections ?? []} />
              </div>
              <div>
                <Field label="Phrase de la marque" value={form.home_brand_text} onChange={(v) => setForm({ ...form, home_brand_text: v })} placeholder={HomeTextDefaults.brandText} />
                <p className="text-[0.625rem] text-[#999999] mt-1">Les mots entre *etoiles* s&apos;affichent en italique, par exemple : votre *style* notre *identite*.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lien sous les produits" value={form.home_products_link} onChange={(v) => setForm({ ...form, home_products_link: v })} placeholder={HomeTextDefaults.productsLink} />
                <CollectionSelect label="Il mene vers" value={form.home_products_collection} onChange={(v) => setForm({ ...form, home_products_collection: v })} collections={collections ?? []} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Bouton « Look du moment »" value={form.home_look_button} onChange={(v) => setForm({ ...form, home_look_button: v })} placeholder={HomeTextDefaults.lookButton} />
                <CollectionSelect label="Il mene vers" value={form.home_look_collection} onChange={(v) => setForm({ ...form, home_look_collection: v })} collections={collections ?? []} />
              </div>
              <Field label="Titre des avis clients" value={form.home_reviews_title} onChange={(v) => setForm({ ...form, home_reviews_title: v })} placeholder={HomeTextDefaults.reviewsTitle} />
              <div>
                <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block mb-1.5">Messages du bandeau defilant</label>
                <textarea
                  value={form.banner_messages}
                  onChange={(e) => setForm({ ...form, banner_messages: e.target.value })}
                  rows={3}
                  className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] resize-y"
                />
                <p className="text-[0.625rem] text-[#999999] mt-1">
                  Un message par ligne. Ils suivent le message de livraison offerte, qui se regle avec le seuil ci-dessus.
                </p>
              </div>
              <button
                onClick={handleSaveTexts}
                disabled={setConfig.isPending}
                className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222] disabled:opacity-50"
              >
                {saved === "texts" ? "OK" : saved === "texts-error" ? "Erreur, reessayer" : "Enregistrer les textes"}
              </button>
              <p className="text-[0.625rem] text-[#999999]">Un champ vide remet le texte par defaut.</p>
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
              <Field label="Webhook Signing Secret (whsec_...)" value={form.stripe_webhook_secret} onChange={(v) => setForm({ ...form, stripe_webhook_secret: v })} type="password" placeholder="whsec_..." />
              <button onClick={() => handleSave("stripe_webhook_secret", form.stripe_webhook_secret)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                {saved === "stripe_webhook_secret" ? "OK" : "Enregistrer Webhook"}
              </button>
              <div className="bg-[#f4f4f4] p-3 text-[0.6875rem] text-[#666666]">
                <p className="font-medium mb-1">URL du webhook :</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-[0.625rem] bg-white px-2 py-1 border border-[#e0e0e0] break-all">{webhookUrl}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(webhookUrl);
                      setWebhookCopied(true);
                      setTimeout(() => setWebhookCopied(false), 1500);
                    }}
                    className="flex items-center gap-1 text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-2 py-1 hover:border-[#222222] bg-white"
                  >
                    {webhookCopied ? <Check size={11} /> : <Copy size={11} />}
                    {webhookCopied ? "Copie" : "Copier"}
                  </button>
                </div>
                <p className="mt-2 text-[#999999]">
                  Dans Stripe : Developpeurs &gt; Webhooks &gt; Ajouter une destination. Collez cette URL,
                  choisissez les evenements payment_intent.succeeded et payment_intent.payment_failed,
                  puis copiez ici le secret de signature (whsec_...). Il confirme les commandes meme si
                  le client ferme son navigateur apres avoir paye.
                </p>
              </div>
            </div>
          </div>

          {/* Sendcloud Settings */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader
              icon={Truck}
              title="Livraison Sendcloud"
              badge={{
                label: sendcloudStatus?.configured ? "Connecte" : "Mode demo",
                ok: Boolean(sendcloudStatus?.configured),
              }}
            />
            <div className="space-y-4">
              <Field label="Sendcloud Public Key" value={form.sendcloud_public_key} onChange={(v) => setForm({ ...form, sendcloud_public_key: v })} placeholder="Cle publique API" />
              <Field label="Sendcloud Secret Key" value={form.sendcloud_secret_key} onChange={(v) => setForm({ ...form, sendcloud_secret_key: v })} type="password" placeholder="Cle secrete API" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="ID adresse d'expedition" value={form.sendcloud_sender_address_id} onChange={(v) => setForm({ ...form, sendcloud_sender_address_id: v })} placeholder="123456" />
                <Field label="Poids par defaut (kg)" value={form.sendcloud_default_weight} onChange={(v) => setForm({ ...form, sendcloud_default_weight: v })} placeholder="1" />
              </div>
              <Field label="Poids de l'emballage (g)" value={form.sendcloud_packaging_weight} onChange={(v) => setForm({ ...form, sendcloud_packaging_weight: v })} placeholder="100" />
              <p className="text-[0.6875rem] text-[#999999]">
                Le poids du colis est la somme des poids saisis sur les produits, plus l&apos;emballage.
                Le poids par defaut ne s&apos;applique qu&apos;aux produits dont le poids n&apos;est pas renseigne.
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => handleSave("sendcloud_public_key", form.sendcloud_public_key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "sendcloud_public_key" ? "OK" : "Enregistrer cle publique"}
                </button>
                <button onClick={() => handleSave("sendcloud_secret_key", form.sendcloud_secret_key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "sendcloud_secret_key" ? "OK" : "Enregistrer cle secrete"}
                </button>
                <button
                  onClick={() => testSendcloud.mutate()}
                  disabled={testSendcloud.isPending}
                  className="text-[0.625rem] uppercase tracking-[1px] bg-[#222222] text-white px-3 py-1.5 hover:bg-[#333333] disabled:opacity-50"
                >
                  {testSendcloud.isPending ? "Test..." : "Tester la connexion"}
                </button>
              </div>
              {testSendcloud.data && (
                <p className={`text-[0.6875rem] ${testSendcloud.data.ok ? "text-green-700" : "text-red-600"}`}>
                  {testSendcloud.data.message}
                </p>
              )}
              <p className="text-[0.6875rem] text-[#999999]">
                Colissimo, Chronopost et Mondial Relay passent par Sendcloud. Sans cles, la boutique
                fonctionne en mode demo (methodes et points relais fictifs).
              </p>
            </div>
          </div>

          {/* Stockage des images */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader
              icon={Image}
              title="Stockage des images"
              badge={{
                label: storageStatus?.configured ? "Actif" : "Non configure",
                ok: Boolean(storageStatus?.configured),
              }}
            />
            <div className="space-y-4">
              <Field label="Endpoint S3" value={form.storage_endpoint} onChange={(v) => setForm({ ...form, storage_endpoint: v })} placeholder="https://storage.googleapis.com" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bucket" value={form.storage_bucket} onChange={(v) => setForm({ ...form, storage_bucket: v })} placeholder="dnmode-images" />
                <Field label="Region" value={form.storage_region} onChange={(v) => setForm({ ...form, storage_region: v })} placeholder="auto" />
              </div>
              <Field label="Access Key" value={form.storage_access_key} onChange={(v) => setForm({ ...form, storage_access_key: v })} placeholder="GOOG1E..." />
              <Field label="Secret Key" value={form.storage_secret_key} onChange={(v) => setForm({ ...form, storage_secret_key: v })} type="password" placeholder="..." />
              <Field label="URL publique (optionnel)" value={form.storage_public_url} onChange={(v) => setForm({ ...form, storage_public_url: v })} placeholder="https://images.dnmode.fr" />
              <p className="text-[0.6875rem] text-[#999999]">
                Compatible Google Cloud Storage (mode interoperabilite S3), Cloudflare R2, Scaleway
                Object Storage. Le bucket doit etre accessible en lecture publique pour que les
                photos s&apos;affichent sur la boutique. Sans configuration, les images s&apos;ajoutent
                uniquement par URL.
              </p>
            </div>
          </div>

          {/* Emails transactionnels */}
          <div className="bg-white shadow-sm border border-[#e8e8e8] p-6">
            <SectionHeader
              icon={Mail}
              title="Emails transactionnels"
              badge={{
                label: emailStatus?.provider === "resend" ? "Resend" : "Mode demo",
                ok: emailStatus?.provider === "resend",
              }}
            />
            <div className="space-y-4">
              <Field label="Resend API Key" value={form.resend_api_key} onChange={(v) => setForm({ ...form, resend_api_key: v })} type="password" placeholder="re_..." />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email expediteur" value={form.from_email} onChange={(v) => setForm({ ...form, from_email: v })} placeholder="DN MODE <contact@dnmode.fr>" />
                <Field label="Email SAV" value={form.support_email} onChange={(v) => setForm({ ...form, support_email: v })} placeholder="sav@dnmode.fr" />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => handleSave("resend_api_key", form.resend_api_key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222]">
                  {saved === "resend_api_key" ? "OK" : "Enregistrer la cle"}
                </button>
                <button
                  onClick={() => seedTemplates.mutate()}
                  disabled={seedTemplates.isPending}
                  className="text-[0.625rem] uppercase tracking-[1px] bg-[#222222] text-white px-3 py-1.5 hover:bg-[#333333] disabled:opacity-50"
                >
                  {seedTemplates.isPending ? "Creation..." : "Creer les templates par defaut"}
                </button>
                {seedTemplates.data && (
                  <span className="text-[0.6875rem] text-green-700">
                    {seedTemplates.data.created} template(s) crees ({seedTemplates.data.total} au total)
                  </span>
                )}
              </div>
              <p className="text-[0.6875rem] text-[#999999]">
                Confirmation de commande, expedition et reponses SAV. Sans cle Resend, les emails sont
                journalises sans etre envoyes.
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
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-[0.625rem] bg-white px-2 py-1 border border-[#e0e0e0] break-all">
                    {redirectUri}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(redirectUri);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center gap-1 text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-2 py-1 hover:border-[#222222] bg-white"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "Copie" : "Copier"}
                  </button>
                </div>
                <p className="mt-2 text-[#999999]">
                  Declarez exactement cette URI dans votre console Google Cloud (Identifiants &gt; ID
                  client OAuth &gt; URI de redirection autorises).
                </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
