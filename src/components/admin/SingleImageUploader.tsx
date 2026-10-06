import { useRef, useState } from "react";
import { Upload, RotateCcw, AlertCircle } from "lucide-react";
import { UPLOAD_ALLOWED_TYPES } from "@contracts/constants";
import { uploadImage, UPLOAD_MAX_MB } from "@/lib/upload";

interface SingleImageUploaderProps {
  label: string;
  hint?: string;
  /** URL choisie dans le CRM ; vide quand l'image par defaut est utilisee. */
  value: string;
  /** Image livree avec le site, affichee quand `value` est vide. */
  defaultUrl: string;
  storageReady: boolean;
  /** Format de l'apercu, aligne sur celui de la boutique. */
  aspect: string;
  /** Saisie de l'URL a la main (enregistree avec le reste du formulaire). */
  onChange: (url: string) => void;
  /** Envoi d'un fichier ou retour au defaut : a enregistrer aussitot. */
  onCommit: (url: string) => void;
}

const ACCEPT = UPLOAD_ALLOWED_TYPES.join(",");

/**
 * Choix d'une image unique (visuels de la page d'accueil) : envoi d'un
 * fichier vers le stockage, saisie d'URL ou retour a l'image par defaut.
 */
export default function SingleImageUploader({
  label,
  hint,
  value,
  defaultUrl,
  storageReady,
  aspect,
  onChange,
  onCommit,
}: SingleImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const preview = value || defaultUrl;
  const isDefault = !value;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      onCommit(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Echec de l'envoi de ${file.name}.`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999]">{label}</label>
        <span className="text-[0.5625rem] uppercase tracking-[1px] text-[#999999]">
          {isDefault ? "Image par defaut" : "Personnalisee"}
        </span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (storageReady) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (storageReady && !uploading) upload(e.dataTransfer.files?.[0]);
        }}
        className={`relative ${aspect} overflow-hidden bg-[#121212] border ${
          dragOver ? "border-[#222222]" : "border-[#e0e0e0]"
        }`}
      >
        <img src={preview} alt={label} className="w-full h-full object-cover" />
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2 text-[0.8125rem] text-[#666666]">
            <div className="w-4 h-4 border border-[#222222] border-t-transparent animate-spin" />
            Envoi en cours...
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        disabled={!storageReady || uploading}
        onChange={(e) => upload(e.target.files?.[0])}
        className="hidden"
      />

      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!storageReady || uploading}
          className="flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[1px] bg-[#222222] text-white px-3 py-1.5 hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={11} />
          Changer l&apos;image
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={() => { setError(""); onCommit(""); }}
            disabled={uploading}
            className="flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 py-1.5 hover:border-[#222222] disabled:opacity-50"
          >
            <RotateCcw size={11} />
            Image par defaut
          </button>
        )}
        <span className="text-[0.6875rem] text-[#999999]">
          JPEG, PNG, WebP, AVIF ({UPLOAD_MAX_MB} Mo max)
        </span>
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={`${defaultUrl} ou https://...`}
        className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]"
      />

      {hint && <p className="text-[0.6875rem] text-[#999999]">{hint}</p>}

      {!storageReady && (
        <p className="flex items-start gap-2 text-[0.6875rem] text-[#666666] bg-[#f4f4f4] p-3">
          <AlertCircle size={13} className="text-[#999999] flex-shrink-0 mt-0.5" />
          <span>
            Stockage non configure : renseignez vos identifiants dans{" "}
            <strong>Stockage des images</strong> ci-dessous, ou collez une URL dans le champ.
          </span>
        </p>
      )}

      {error && <p className="text-[0.6875rem] text-red-600">{error}</p>}
    </div>
  );
}
