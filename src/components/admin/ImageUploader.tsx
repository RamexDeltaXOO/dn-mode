import { useRef, useState } from "react";
import { Upload, X, Link2, GripVertical, AlertCircle } from "lucide-react";
import { UPLOAD_ALLOWED_TYPES } from "@contracts/constants";
import { trpc } from "@/providers/trpc";
import { uploadImage, UPLOAD_MAX_MB } from "@/lib/upload";

interface ImageUploaderProps {
  value: string[];
  onChange: (images: string[]) => void;
}

const ACCEPT = UPLOAD_ALLOWED_TYPES.join(",");

/**
 * Gestion des images d'un produit : envoi de fichiers vers le stockage,
 * ajout d'URL manuelle, retrait et reordonnancement. La premiere image
 * est celle affichee en vignette sur la boutique.
 */
export default function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const { data: status } = trpc.upload.status.useQuery(undefined, { retry: false });
  const storageReady = status?.configured ?? false;

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setError("");
    setUploading(true);
    const uploaded: string[] = [];

    for (const file of list) {
      try {
        uploaded.push(await uploadImage(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : `Echec de l'envoi de ${file.name}.`);
      }
    }

    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    onChange([...value, url]);
    setManualUrl("");
  };

  return (
    <div className="space-y-3">
      <label className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] block">
        Images du produit
      </label>

      {/* Vignettes */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative w-24 group">
              <div className="w-24 h-32 bg-[#f4f4f4] border border-[#e0e0e0] overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-[#222222] text-white text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5">
                  Principale
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAt(index)}
                title="Retirer"
                className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-[#e0e0e0] flex items-center justify-center hover:border-[#222222]"
              >
                <X size={11} />
              </button>
              <div className="flex items-center justify-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="text-[0.625rem] text-[#999999] hover:text-[#222222] disabled:opacity-30 px-1"
                  title="Vers la gauche"
                >
                  ←
                </button>
                <GripVertical size={10} className="text-[#cccccc]" />
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === value.length - 1}
                  className="text-[0.625rem] text-[#999999] hover:text-[#222222] disabled:opacity-30 px-1"
                  title="Vers la droite"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone de depot */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (storageReady && e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
        }}
        className={`border border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? "border-[#222222] bg-[#fafafa]" : "border-[#e0e0e0]"
        } ${storageReady ? "" : "opacity-60"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={!storageReady || uploading}
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-[0.8125rem] text-[#666666]">
            <div className="w-4 h-4 border border-[#222222] border-t-transparent animate-spin" />
            Envoi en cours...
          </div>
        ) : (
          <>
            <Upload size={18} className="text-[#999999] mx-auto mb-2" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!storageReady}
              className="text-[0.75rem] uppercase tracking-[1.5px] border border-[#e0e0e0] px-4 py-2 hover:border-[#222222] disabled:cursor-not-allowed"
            >
              Choisir des images
            </button>
            <p className="text-[0.6875rem] text-[#999999] mt-2">
              ou glissez-deposez (JPEG, PNG, WebP, AVIF, {UPLOAD_MAX_MB} Mo max)
            </p>
          </>
        )}
      </div>

      {!storageReady && (
        <p className="flex items-start gap-2 text-[0.6875rem] text-[#666666] bg-[#f4f4f4] p-3">
          <AlertCircle size={13} className="text-[#999999] flex-shrink-0 mt-0.5" />
          <span>
            Stockage non configure. Renseignez vos identifiants dans{" "}
            <strong>Parametres &gt; Stockage des images</strong>, ou ajoutez une URL a la main
            ci-dessous.
          </span>
        </p>
      )}

      {error && (
        <p className="text-[0.6875rem] text-red-600">{error}</p>
      )}

      {/* Ajout manuel */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center border border-[#e0e0e0] px-2">
          <Link2 size={13} className="text-[#999999] flex-shrink-0" />
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addManual(); }
            }}
            placeholder="/product-1.jpg ou https://..."
            className="flex-1 px-2 py-2 text-[0.8125rem] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={addManual}
          disabled={!manualUrl.trim()}
          className="text-[0.6875rem] uppercase tracking-[1px] border border-[#e0e0e0] px-3 hover:border-[#222222] disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}
