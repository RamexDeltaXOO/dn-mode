import { Trash2 } from "lucide-react";
import type { BulkSelection } from "@/hooks/useBulkSelection";

/* Cases a cocher et barre d'actions de la selection multiple du CRM (voir useBulkSelection). */

const boxClass = "w-4 h-4 accent-[#222222] cursor-pointer align-middle";

/** En-tete de colonne : coche ou decoche toutes les lignes affichees. */
export function SelectAllCell({ selection }: { selection: BulkSelection }) {
  return (
    <th className="pl-4 pr-1 py-3 w-8">
      <input
        type="checkbox"
        aria-label="Tout selectionner"
        title="Tout selectionner"
        checked={selection.allSelected}
        ref={(el) => {
          if (el) el.indeterminate = selection.someSelected;
        }}
        onChange={selection.toggleAll}
        className={boxClass}
      />
    </th>
  );
}

/** Case d'une ligne. Toute la cellule est cliquable ; Maj+clic coche une plage. */
export function SelectCell({ selection, id }: { selection: BulkSelection; id: number }) {
  return (
    <td
      className="pl-4 pr-1 py-3 w-8 cursor-pointer"
      onClick={(e) => {
        // Les lignes depliables (commandes) ne doivent pas s'ouvrir.
        e.stopPropagation();
        selection.toggle(id, e.shiftKey);
      }}
      onMouseDown={(e) => {
        // Evite de surligner le texte du tableau pendant un Maj+clic.
        if (e.shiftKey) e.preventDefault();
      }}
    >
      <input
        type="checkbox"
        aria-label="Selectionner"
        checked={selection.isSelected(id)}
        readOnly
        tabIndex={-1}
        className={`${boxClass} pointer-events-none`}
      />
    </td>
  );
}

/** Barre d'actions, affichee des qu'une ligne est cochee. A placer apres le tableau. */
export function BulkActionBar({
  selection,
  noun,
  onDelete,
  pending,
  confirmMessage,
}: {
  selection: BulkSelection;
  /** Ce qui est supprime, au pluriel eventuel : "produit(s)". */
  noun: string;
  onDelete: (ids: number[]) => void;
  pending?: boolean;
  confirmMessage?: string;
}) {
  const count = selection.selectedIds.length;
  if (count === 0) return null;

  const remove = () => {
    const message = confirmMessage ?? `Supprimer ${count} ${noun} ? Cette action est irreversible.`;
    if (confirm(message)) onDelete(selection.selectedIds);
  };

  return (
    <>
      {/* Reserve la place de la barre sous le tableau : la derniere ligne reste visible. */}
      <div aria-hidden className="h-20" />
      {/* Barre flottante : le tableau ne bouge pas quand on coche, pas de clic qui tombe a cote. */}
      <div className="fixed bottom-6 left-[calc(250px+1.5rem)] right-6 sm:left-[calc(250px+2rem)] sm:right-8 z-[50] flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#222222] text-white px-4 py-3 shadow-lg">
        <span className="text-[0.8125rem]">
          {count} {noun} selectionne(s)
        </span>
        <button
          type="button"
          onClick={selection.clear}
          className="text-[0.625rem] uppercase tracking-[1px] text-white/70 hover:text-white"
        >
          Deselectionner
        </button>
        <span className="hidden sm:inline text-[0.6875rem] text-white/50">Maj+clic : selectionner une plage</span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="ml-auto flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-1.5 text-[0.625rem] uppercase tracking-[1px] disabled:opacity-50"
        >
          <Trash2 size={12} />
          {pending ? "Suppression..." : `Supprimer (${count})`}
        </button>
      </div>
    </>
  );
}
