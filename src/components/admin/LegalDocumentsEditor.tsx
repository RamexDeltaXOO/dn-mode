import { useState } from "react";
import { Check, ExternalLink, FileText, Save, RotateCcw } from "lucide-react";
import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_TYPES, type LegalDocumentType } from "@contracts/legal";
import LegalDocumentContent from "@/components/LegalDocumentContent";

type Props = {
  values: Record<LegalDocumentType, string>;
  onChange: (type: LegalDocumentType, value: string) => void;
  onSave: (type: LegalDocumentType) => void;
  isSaving: boolean;
  saved: string | null;
};

export default function LegalDocumentsEditor({ values, onChange, onSave, isSaving, saved }: Props) {
  const [selected, setSelected] = useState<LegalDocumentType>("cgv");
  const [showPreview, setShowPreview] = useState(false);
  const document = LEGAL_DOCUMENTS[selected];
  const value = values[selected];
  const hasMissingDetails = value.includes("[À compléter");

  return (
    <section className="bg-white shadow-sm border border-[#e8e8e8] p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#f0f0f0]">
        <FileText size={16} className="text-[#999999]" />
        <h2 className="text-[0.875rem] font-medium">Pages juridiques</h2>
      </div>
      <p className="text-[0.8125rem] text-[#666666] leading-relaxed mb-5">
        Modifiez les CGV, CGU et mentions légales depuis ce CRM. Chaque texte est enregistré
        en base et apparaît sur le site sans nouveau déploiement. Utilisez « ## Titre » pour
        créer une section et une ligne vide pour séparer les paragraphes.
      </p>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Document juridique">
        {LEGAL_DOCUMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={selected === type}
            onClick={() => setSelected(type)}
            className={`text-[0.6875rem] px-4 py-2 uppercase tracking-[1px] border transition-colors ${selected === type
              ? "border-[#222222] bg-[#222222] text-white"
              : "border-[#dedede] text-[#555555] hover:border-[#222222]"}`}
          >
            {type === "mentions-legales" ? "Mentions légales" : type.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <label htmlFor="legal-document-text" className="text-[0.8125rem] font-medium text-[#222222]">
          {document.title}
        </label>
        <a
          href={document.path}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[0.75rem] text-[#555555] underline underline-offset-4 hover:text-black"
        >
          Voir la page <ExternalLink size={12} />
        </a>
      </div>
      <textarea
        id="legal-document-text"
        value={value}
        onChange={(event) => onChange(selected, event.target.value)}
        rows={22}
        spellCheck
        className="w-full min-h-[340px] border border-[#dedede] bg-white px-4 py-3 text-[0.8125rem] leading-relaxed outline-none focus:border-[#222222] resize-y"
      />
      {hasMissingDetails && (
        <p className="mt-3 text-[0.75rem] text-amber-800">
          Des informations obligatoires restent à compléter (identité, hébergeur, médiateur, selon la page).
          Ne les remplacez pas par des informations supposées.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          disabled={isSaving || !value.trim()}
          onClick={() => onSave(selected)}
          className="inline-flex items-center gap-2 bg-[#222222] text-white px-4 py-2 text-[0.6875rem] uppercase tracking-[1px] hover:bg-[#333333] disabled:opacity-50"
        >
          {saved === document.configKey ? <Check size={14} /> : <Save size={14} />}
          {saved === document.configKey ? "Enregistré" : "Publier les modifications"}
        </button>
        <button
          type="button"
          onClick={() => onChange(selected, document.defaultContent)}
          className="inline-flex items-center gap-2 border border-[#dedede] px-3 py-2 text-[0.6875rem] text-[#555555] hover:border-[#222222]"
        >
          <RotateCcw size={13} /> Restaurer le texte initial
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((open) => !open)}
          className="text-[0.75rem] text-[#555555] underline underline-offset-4 ml-auto"
        >
          {showPreview ? "Masquer l'aperçu" : "Prévisualiser"}
        </button>
      </div>
      {saved === `${document.configKey}-error` && <p className="mt-2 text-[0.75rem] text-red-600">Enregistrement impossible. Réessayez.</p>}
      {showPreview && (
        <div className="mt-6 border-t border-[#e8e8e8] pt-6">
          <h3 className="text-lg font-light mb-6">{document.title} — aperçu</h3>
          <LegalDocumentContent content={value} />
        </div>
      )}
      <p className="mt-4 text-[0.6875rem] text-[#999999]">
        Les changements prennent effet à l'enregistrement. Vérifiez les informations juridiques
        et assurez-vous de leur conformité avant publication.
      </p>
    </section>
  );
}
