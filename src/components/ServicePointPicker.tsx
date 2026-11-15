import { useState } from "react";
import { Clock, LocateFixed, MapPin, Navigation, Search, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";

export type SelectedServicePoint = {
  id: string;
  name: string;
  address: string;
};

interface ServicePointPickerProps {
  carrier: string;
  address: string;
  postalCode: string;
  city: string;
  value: SelectedServicePoint | null;
  onChange: (point: SelectedServicePoint | null) => void;
}

type SearchOrigin =
  | { kind: "address"; address: string }
  | { kind: "gps"; latitude: number; longitude: number };

const moneylessDistance = (distance: number | null) =>
  distance === null ? null : distance >= 1000
    ? `${(distance / 1000).toFixed(1).replace(".", ",")} km`
    : `${Math.round(distance)} m`;

/** Selection depuis les vrais relais Sendcloud, par adresse ou position. */
export default function ServicePointPicker({
  carrier,
  address,
  postalCode,
  city,
  value,
  onChange,
}: ServicePointPickerProps) {
  const initialAddress = [address, [postalCode, city].filter(Boolean).join(" "), "France"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  const [search, setSearch] = useState(initialAddress);
  const [origin, setOrigin] = useState<SearchOrigin | null>(
    initialAddress ? { kind: "address", address: initialAddress } : null,
  );
  const [radius, setRadius] = useState(10000);
  const [openHours, setOpenHours] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const query = trpc.sendcloud.servicePoints.useQuery(
    {
      country: "FR",
      carrier,
      radius,
      ...(origin?.kind === "gps"
        ? { latitude: origin.latitude, longitude: origin.longitude }
        : origin?.kind === "address"
          ? { address: origin.address }
          : {}),
    },
    { enabled: origin !== null, retry: false, staleTime: 60_000 },
  );

  const points = query.data?.points ?? [];

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = search.trim();
    if (next.length < 5) return;
    setGeoError("");
    setOpenHours(null);
    onChange(null);
    setOrigin({ kind: "address", address: next });
  };

  const locateMe = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Votre navigateur ne propose pas la geolocalisation.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setOpenHours(null);
        onChange(null);
        setOrigin({ kind: "gps", latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === 1
            ? "Autorisez la localisation dans votre navigateur ou saisissez une adresse."
            : "Impossible d'obtenir votre position. Essayez avec une adresse.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-2">
        <MapPin size={18} className="text-[#222222] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-[0.875rem] font-medium text-[#222222]">Choisir votre point relais</h3>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-[#777777]">
            Nous recherchons les relais autour de votre adresse, meme dans les codes postaux voisins.
          </p>
        </div>
      </div>

      {value && (
        <div className="bg-white border border-[#222222] p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-green-700 mb-1">
              <ShieldCheck size={14} /> Relais selectionne
            </p>
            <p className="text-[0.875rem] font-medium text-[#222222]">{value.name}</p>
            <p className="text-[0.75rem] text-[#666666] mt-1">{value.address}</p>
          </div>
          <button type="button" className="text-[0.75rem] underline underline-offset-2 shrink-0"
            onClick={() => onChange(null)}>Modifier</button>
        </div>
      )}

      {!value && (
        <>
          <form onSubmit={handleSearch} className="space-y-2">
            <label htmlFor="relay-search" className="block text-[0.75rem] font-medium text-[#444444]">
              Adresse de recherche (rue, numero, ville)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input id="relay-search" autoComplete="street-address" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex. 12 rue de Paris, 93000 Bobigny"
                className="min-w-0 flex-1 border border-[#d9d9d9] bg-white px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#222222]" />
              <button type="submit" disabled={search.trim().length < 5}
                className="inline-flex items-center justify-center gap-2 bg-[#222222] text-white px-4 py-2.5 text-[0.75rem] font-medium disabled:opacity-40">
                <Search size={15} /> Rechercher
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={locating} onClick={locateMe}
              className="inline-flex items-center gap-2 text-[0.75rem] underline underline-offset-4 disabled:opacity-50">
              <LocateFixed size={15} /> {locating ? "Localisation en cours..." : "Utiliser ma position"}
            </button>
            <label className="inline-flex items-center gap-2 text-[0.75rem] text-[#666666]">
              Autour de
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}
                aria-label="Rayon de recherche"
                className="border border-[#d9d9d9] bg-white px-2 py-1.5 text-[#222222]">
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={20000}>20 km</option>
              </select>
            </label>
          </div>

          {origin?.kind === "gps" && (
            <p className="text-[0.75rem] text-[#666666]">Recherche autour de votre position actuelle.</p>
          )}
          {geoError && <p role="alert" className="text-[0.75rem] text-red-700">{geoError}</p>}
          {(query.isFetching || locating) && (
            <div className="flex items-center gap-2 py-3 text-[0.75rem] text-[#666666]" role="status">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#222222] border-t-transparent" />
              Recherche des relais les plus proches...
            </div>
          )}
          {query.isError && (
            <p role="alert" className="text-[0.75rem] text-red-700">
              Impossible de charger les points relais. Veuillez reessayer.
            </p>
          )}
          {query.data?.error && (
            <p role="alert" className="text-[0.75rem] text-red-700">{query.data.error}</p>
          )}
          {!query.isFetching && !query.isError && !query.data?.error && origin && points.length === 0 && (
            <p className="text-[0.75rem] text-[#666666] py-2">
              Aucun point relais trouve dans ce rayon. Essayez 20 km ou une autre adresse.
            </p>
          )}
          {!query.isFetching && points.length > 0 && (
            <div className="space-y-2">
              <p className="text-[0.75rem] text-[#555555]">
                {points.length} point{points.length > 1 ? "s" : ""} relais trouve{points.length > 1 ? "s" : ""}
                {points.some((p) => p.distance !== null) ? " · Les plus proches en premier" : ""}
              </p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" role="group" aria-label="Points relais disponibles">
                {points.map((point, index) => {
                  const label = [point.street, point.houseNumber].filter(Boolean).join(" ");
                  const location = [point.postalCode, point.city].filter(Boolean).join(" ");
                  const queryAddress = [label, location, "France"].filter(Boolean).join(", ");
                  return (
                    <div key={point.id} className="bg-white border border-[#dedede] hover:border-[#555555] transition-colors">
                      <button type="button"
                        onClick={() => onChange({ id: point.id, name: point.name, address: [label, location].filter(Boolean).join(", ") })}
                        className="w-full p-3 text-left flex gap-3 items-start"
                        aria-label={`Choisir ${point.name}, ${queryAddress}`}>
                        <span className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f1f1f1] text-[#444444] text-[0.75rem] font-medium shrink-0">{index + 1}</span>
                        <span className="flex-1 min-w-0">
                          <span className="text-[0.8125rem] font-medium text-[#222222] block">{point.name}</span>
                          <span className="text-[0.75rem] text-[#777777] block mt-0.5">{label}</span>
                          <span className="text-[0.75rem] text-[#777777] block">{location}</span>
                        </span>
                        <span className="text-right shrink-0">
                          {point.distance !== null && (
                            <span className="block text-[0.75rem] font-medium text-[#222222]">{moneylessDistance(point.distance)}</span>
                          )}
                          {index === 0 && point.distance !== null && (
                            <span className="block text-[0.625rem] text-green-700 mt-0.5">Plus proche</span>
                          )}
                          <span className="block text-[0.6875rem] underline mt-1">Choisir</span>
                        </span>
                      </button>
                      <div className="px-3 pb-3 pl-[3.25rem] flex flex-wrap gap-x-4 gap-y-2 items-center">
                        {point.openingHours.length > 0 && (
                          <button type="button" onClick={() => setOpenHours(openHours === point.id ? null : point.id)}
                            className="inline-flex gap-1 items-center text-[0.6875rem] text-[#666666] underline underline-offset-2">
                            <Clock size={13} /> Horaires
                          </button>
                        )}
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryAddress)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex gap-1 items-center text-[0.6875rem] text-[#666666] underline underline-offset-2">
                          <Navigation size={13} /> Voir sur la carte
                        </a>
                        {openHours === point.id && (
                          <ul className="w-full text-[0.6875rem] text-[#666666] space-y-1">
                            {point.openingHours.map((line) => <li key={line}>{line}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
