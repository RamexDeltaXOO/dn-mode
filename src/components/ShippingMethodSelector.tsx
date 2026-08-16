import { useEffect } from "react";
import { Truck } from "lucide-react";
import { carrierLabel } from "@contracts/constants";
import { trpc } from "@/providers/trpc";

export type ShippingMethodOption = {
  id: number;
  name: string;
  carrier: string;
  price: number;
  estimatedDays: string | null;
  requiresServicePoint: boolean;
};

interface ShippingMethodSelectorProps {
  value: number | null;
  onChange: (method: ShippingMethodOption | null) => void;
  subtotal: number;
  /** Poids du colis en grammes, emballage compris. */
  weightGrams: number;
}

/** Liste des modes de livraison (Colissimo / Chronopost / Mondial Relay). */
export default function ShippingMethodSelector({
  value,
  onChange,
  subtotal,
  weightGrams,
}: ShippingMethodSelectorProps) {
  // Le serveur ne renvoie que les methodes dont la tranche couvre ce poids.
  const { data: methods, isLoading } = trpc.shipping.list.useQuery({ weightGrams });
  const { data: settings } = trpc.shipping.settings.useQuery();

  const isFree = settings ? subtotal >= settings.threshold : false;

  const options: ShippingMethodOption[] = (methods ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    carrier: m.carrier,
    price: Number.parseFloat(String(m.price)) || 0,
    estimatedDays: m.estimatedDays,
    requiresServicePoint: Boolean(m.requiresServicePoint),
  }));

  // Preselection du premier mode disponible.
  useEffect(() => {
    if (value === null && options.length > 0) {
      onChange(options[0]);
    }
  }, [value, options, onChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[#999999] py-4">
        Aucune methode de livraison disponible pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option)}
            className={`w-full flex items-center gap-3 border px-4 py-3 text-left transition-colors ${
              selected ? "border-[#222222]" : "border-[#e0e0e0] hover:border-[#999999]"
            }`}
          >
            <span
              className={`w-3.5 h-3.5 border flex-shrink-0 ${
                selected ? "border-[#222222] bg-[#222222]" : "border-[#999999]"
              }`}
            />
            <Truck size={16} className="text-[#999999] flex-shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[0.8125rem] text-[#222222]">{option.name}</span>
              <span className="block text-[0.6875rem] text-[#999999] uppercase tracking-[1px]">
                {carrierLabel(option.carrier)}
                {option.estimatedDays ? ` — ${option.estimatedDays}` : ""}
                {option.requiresServicePoint ? " — Point relais" : ""}
              </span>
            </span>
            <span className="text-[0.8125rem] whitespace-nowrap">
              {isFree ? (
                <>
                  <span className="text-[#999999] line-through mr-2">
                    €{option.price.toFixed(2)}
                  </span>
                  <span className="text-[#222222]">Offerte</span>
                </>
              ) : (
                <span className="text-[#222222]">€{option.price.toFixed(2)}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
