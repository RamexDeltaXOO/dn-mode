import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { Search, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = trpc.product.list.useQuery(
    { search: query, page: 1, limit: 6 },
    { enabled: query.length > 1 }
  );

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 bg-white/95 backdrop-blur-sm z-[200] transition-opacity duration-300 ${
        open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
      }`}
    >
      <div className="max-w-[800px] mx-auto px-6 pt-20">
        <div className="flex items-center border-b-2 border-[#222222] pb-2">
          <Search size={24} strokeWidth={1.5} className="text-[#999999] mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 text-2xl font-light outline-none bg-transparent placeholder:text-[#cccccc]"
          />
          <button onClick={onClose} className="p-2 hover:opacity-60">
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        {query.length > 1 && searchResults?.products && (
          <div className="mt-8">
            {searchResults.products.length === 0 ? (
              <p className="text-[0.9375rem] text-[#999999]">Aucun resultat trouve</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {searchResults.products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.slug}`}
                    onClick={() => { setQuery(""); onClose(); }}
                    className="group"
                  >
                    <div className="aspect-[3/4] bg-[#f4f4f4] overflow-hidden mb-2">
                      <img
                        src={product.images?.[0] || "/placeholder.png"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    </div>
                    <p className="text-[0.75rem] uppercase tracking-[1px] group-hover:opacity-60 transition-opacity">
                      {product.name}
                    </p>
                    <p className="text-[0.8125rem] text-[#666666]">
                      €{parseFloat(product.price as string).toFixed(2)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
