import { useState } from "react";
import { MapPin, Search, Clock } from "lucide-react";
import { trpc } from "@/providers/trpc";

export type SelectedServicePoint = {
  id: string;
  name: string;
  address: string;
};

interface ServicePointPickerProps {
  carrier: string;
  postalCode: string;
  city?: string;
  value: SelectedServicePoint | null;
  onChange: (point: SelectedServicePoint | null) => void;
}

function formatDistance(distance: number | null): string {
  if (distance === null) return "";
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
}

/** Selecteur de point relais (Mondial Relay via Sendcloud). */
export default function ServicePointPicker({
  carrier,
  postalCode,
  city,
  value,
  onChange,
}: ServicePointPickerProps) {
  const [search, setSearch] = useState(postalCode);
  const [submitted, setSubmitted] = useState("");
  const [openHours, setOpenHours] = useState<string | null>(null);

  const query = trpc.sendcloud.servicePoints.useQuery(
    { postalCode: submitted, city, country: "FR", carrier },
    { enabled: submitted.length >= 4, retry: false },
  );

  const points = query.data?.points ?? [];

  if (value) {
    return (
      <div className="border border-[#222222] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] mb-1">
              Point relais choisi
            </p>
            <p className="text-[0.8125rem] text-[#222222]">{value.name}</p>
            <p className="text-[0.75rem] text-[#666666]">{value.address}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[0.625rem] uppercase tracking-[1px] text-[#666666] hover:text-[#222222] underline flex-shrink-0"
          >
            Changer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#e0e0e0] p-4">
      <p className="text-[0.6875rem] uppercase tracking-[1px] text-[#999999] mb-2">
        Choisissez votre point relais
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Code postal"
          inputMode="numeric"
          className="flex-1 border border-[#e0e0e0] px-3 py-2 text-[0.875rem] outline-none focus:border-[#222222] bg-white"
        />
        <button
          type="button"
          onClick={() => setSubmitted(search.trim())}
          disabled={search.trim().length < 4}
          className="flex items-center gap-1.5 bg-[#222222] text-white px-4 py-2 text-[0.6875rem] uppercase tracking-[1.5px] hover:bg-[#333333] disabled:opacity-40"
        >
          <Search size={13} />
          Rechercher
        </button>
      </div>

      {query.isFetching && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-[#222222] border-t-transparent animate-spin" />
        </div>
      )}

      {!query.isFetching && submitted && points.length === 0 && (
        <p className="text-[0.75rem] text-[#999999] py-3">
          Aucun point relais trouve pour ce code postal.
        </p>
      )}

      {points.length > 0 && (
        <>
          {query.data?.source === "demo" && (
            <p className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] mb-2">
              Mode demo
            </p>
          )}
          <div className="max-h-[280px] overflow-auto space-y-2">
            {points.map((point) => (
              <div key={point.id} className="border border-[#e0e0e0] hover:border-[#999999]">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      id: point.id,
                      name: point.name,
                      address: `${point.street} ${point.houseNumber}, ${point.postalCode} ${point.city}`.trim(),
                    })
                  }
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
                >
                  <MapPin size={15} className="text-[#999999] flex-shrink-0 mt-0.5" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[0.8125rem] text-[#222222]">{point.name}</span>
                    <span className="block text-[0.75rem] text-[#666666]">
                      {point.street} {point.houseNumber}
                    </span>
                    <span className="block text-[0.75rem] text-[#666666]">
                      {point.postalCode} {point.city}
                    </span>
                  </span>
                  {point.distance !== null && (
                    <span className="text-[0.6875rem] text-[#999999] flex-shrink-0">
                      {formatDistance(point.distance)}
                    </span>
                  )}
                </button>
                {point.openingHours.length > 0 && (
                  <div className="px-3 pb-2">
                    <button
                      type="button"
                      onClick={() => setOpenHours(openHours === point.id ? null : point.id)}
                      className="flex items-center gap-1 text-[0.625rem] uppercase tracking-[1px] text-[#999999] hover:text-[#222222]"
                    >
                      <Clock size={11} />
                      Horaires
                    </button>
                    {openHours === point.id && (
                      <ul className="mt-1 space-y-0.5">
                        {point.openingHours.map((line) => (
                          <li key={line} className="text-[0.6875rem] text-[#666666]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
