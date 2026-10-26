import { useRef, useState } from "react";

/**
 * Selection multiple dans les tableaux du CRM : une case par ligne, une case
 * "tout selectionner", Maj+clic pour cocher toute une plage, et une barre
 * d'actions pour supprimer d'un coup.
 *
 * `ids` est la liste des lignes affichees, dans l'ordre. Une ligne masquee
 * par un filtre n'est jamais concernee par l'action, meme cochee avant.
 */
export function useBulkSelection(ids: number[]) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  // Derniere ligne cliquee, point de depart d'un Maj+clic.
  const anchor = useRef<number | null>(null);

  const selectedIds = ids.filter((id) => selected.has(id));
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;

  const toggle = (id: number, range: boolean) => {
    const next = new Set(selected);
    const checked = !selected.has(id);
    const from = anchor.current === null ? -1 : ids.indexOf(anchor.current);
    const to = ids.indexOf(id);
    const span =
      range && from !== -1 && to !== -1
        ? ids.slice(Math.min(from, to), Math.max(from, to) + 1)
        : [id];
    for (const rowId of span) {
      if (checked) next.add(rowId);
      else next.delete(rowId);
    }
    anchor.current = id;
    setSelected(next);
  };

  return {
    selectedIds,
    allSelected,
    someSelected: selectedIds.length > 0 && !allSelected,
    isSelected: (id: number) => selected.has(id),
    toggle,
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
  };
}

export type BulkSelection = ReturnType<typeof useBulkSelection>;
