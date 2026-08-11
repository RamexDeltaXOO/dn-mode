import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ChevronLeft, ShoppingBag, Check } from "lucide-react";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [added, setAdded] = useState(false);
  const [mainImage, setMainImage] = useState<string>("");

  const { data: product, isLoading } = trpc.product.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  // Set main image when product loads
  if (product && product.images && mainImage === "") {
    setMainImage(product.images[0] || "/placeholder.png");
  }

  // Track product view
  const trackProductView = trpc.analytics.trackProductView.useMutation();
  useEffect(() => {
    if (product?.id) {
      const sessionId = localStorage.getItem("dnmode_session_id");
      trackProductView.mutate({ productId: product.id, sessionId: sessionId || undefined });
    }
  }, [product?.id]);

  const utils = trpc.useUtils();
  const addToCart = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    },
  });

  if (isLoading) {
    return (
      <div className="pt-[92px] min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-[92px] min-h-[100dvh] flex flex-col items-center justify-center">
        <p className="text-[0.9375rem] text-[#999999]">Produit introuvable</p>
        <Link to="/" className="mt-4 text-[0.75rem] uppercase tracking-[2px] underline">
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  const colors = product.colors || [];
  const sizes = product.sizes || [];
  const isOutOfStock = !product.inventoryQuantity || product.inventoryQuantity <= 0;
  const images = product.images || [];

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart.mutate({
      productId: product.id,
      quantity: 1,
      color: selectedColor || undefined,
      size: selectedSize || undefined,
    });
  };

  return (
    <div className="pt-[92px] min-h-[100dvh]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[0.75rem] text-[#666666] hover:text-[#222222] mb-6"
        >
          <ChevronLeft size={14} />
          Retour
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="flex gap-3">
            {images.length > 1 && (
              <div className="flex flex-col gap-2 w-16 sm:w-20">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setMainImage(img)}
                    className={`aspect-[3/4] overflow-hidden border ${
                      mainImage === img ? "border-[#222222]" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 aspect-[3/4] bg-[#eaeaea] overflow-hidden">
              <img src={mainImage || "/placeholder.png"} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:py-6">
            <h1 className="text-xl sm:text-2xl font-light text-[#222222] mb-2">{product.name}</h1>
            <p className="text-[0.9375rem] text-[#666666] mb-1">
              €{parseFloat(String(product.price)).toFixed(2)}
            </p>
            <p className="text-[0.6875rem] text-[#999999] mb-6">Taxes incluses.</p>

            {colors.length > 0 && (
              <div className="mb-6">
                <label className="section-label block mb-2">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1.5 text-[0.75rem] border transition-colors ${
                        selectedColor === color
                          ? "border-[#222222] bg-[#222222] text-white"
                          : "border-[#e0e0e0] text-[#666666] hover:border-[#222222]"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="mb-6">
                <label className="section-label block mb-2">Taille</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 text-[0.75rem] border transition-colors ${
                        selectedSize === size
                          ? "border-[#222222] bg-[#222222] text-white"
                          : "border-[#e0e0e0] text-[#666666] hover:border-[#222222]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || addToCart.isPending}
              className={`w-full py-3.5 text-[0.75rem] uppercase tracking-[2px] flex items-center justify-center gap-2 transition-colors ${
                isOutOfStock
                  ? "bg-[#f0f0f0] text-[#999999] cursor-not-allowed"
                  : added
                  ? "bg-green-600 text-white"
                  : "bg-[#222222] text-white hover:bg-[#333333]"
              }`}
            >
              {isOutOfStock ? (
                "EPUISE"
              ) : added ? (
                <>
                  <Check size={16} />
                  AJOUTE AU PANIER
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  AJOUTER AU PANIER
                </>
              )}
            </button>

            <div className="mt-4 space-y-1">
              <p className="text-[0.75rem] text-[#666666]">Expedition sous 2-3 jours ouvres</p>
              <p className="text-[0.75rem] text-[#666666]">Livraison offerte a partir de 120€</p>
            </div>

            {product.description && (
              <div className="mt-8 pt-6 border-t border-[#e0e0e0]">
                <h3 className="section-label mb-3">Description</h3>
                <p className="text-[0.8125rem] text-[#666666] leading-[1.6] whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
