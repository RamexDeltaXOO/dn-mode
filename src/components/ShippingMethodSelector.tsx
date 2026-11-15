import { Check, Home, MapPin, Truck } from "lucide-react";
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
  weightGrams: number;
}

const euro = (amount: number) => amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Options de livraison sous forme de choix explicite, jamais preselectionne. */
export default function ShippingMethodSelector({
  value,
  onChange,
  subtotal,
  weightGrams,
}: ShippingMethodSelectorProps) {
  const { data: methods, isLoading, isError } = trpc.shipping.list.useQuery({ weightGrams });
  const { data: settings } = trpc.shipping.settings.useQuery();
  const isFree = settings ? subtotal >= settings.threshold : false;

  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 py-6 text-[0.8125rem] text-[#666666]">
        <div className="w-5 h-5 border-2 border-[#222222] border-t-transparent rounded-full animate-spin" />
        Chargement des modes de livraison...
      </div>
    );
  }

  if (isError) {
    return <p role="alert" className="text-[0.8125rem] text-red-700">Impossible de charger les offres de livraison.</p>;
  }

  const options: ShippingMethodOption[] = (methods ?? []).map((method) => ({
    id: method.id,
    name: method.name,
    carrier: method.carrier,
    price: Number.parseFloat(String(method.price)) || 0,
    estimatedDays: method.estimatedDays,
    requiresServicePoint: Boolean(method.requiresServicePoint),
  }));

  if (!options.length) {
    return <p className="text-[0.8125rem] text-[#777777] py-4">Aucun mode de livraison disponible actuellement.</p>;
  }

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Choisissez votre mode de livraison">
      {options.map((option) => {
        const selected = option.id === value;
        const Icon = option.requiresServicePoint ? MapPin : Home;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={"w-full flex items-center gap-3 border p-4 sm:p-5 text-left transition-colors " +
              (selected ? "border-[#222222] bg-[#f8f8f8]" : "border-[#e5e5e5] bg-white hover:border-[#888888]")}
          >
            <span aria-hidden="true"
              className={"w-5 h-5 border rounded-full flex items-center justify-center shrink-0 " +
                (selected ? "border-[#222222] bg-[#222222] text-white" : "border-[#c3c3c3]")}>
              {selected && <Check size={12} />}
            </span>
            <Icon size={20} className="text-[#666666] shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[0.875rem] text-[#222222] font-medium">{option.name}</span>
              <span className="block mt-1 text-[0.75rem] text-[#777777]">
                {option.requiresServicePoint ? "Retrait dans un commerce partenaire" : "Livraison a l'adresse renseignee"}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 mt-1 text-[0.6875rem] text-[#888888]">
                <Truck size={12} /> {carrierLabel(option.carrier)}
                {option.estimatedDays && <span> · {option.estimatedDays}</span>}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {isFree ? (
                <>
                  <span className="block text-[0.6875rem] text-[#999999] line-through">{euro(option.price)}</span>
                  <span className="block text-[0.8125rem] text-green-700 font-medium">Offerte</span>
                </>
              ) : (
                <span className="block text-[0.8125rem] font-medium">{euro(option.price)}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
