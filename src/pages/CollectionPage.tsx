import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: collections, isLoading: collectionsLoading } = trpc.collection.list.useQuery();

  const isAll = !slug || slug === "all";
  const currentCollection = collections?.find(c => c.slug === slug);
  const collectionId = currentCollection?.id;
  // Collection supprimee ou renommee dans le CRM : on ne montre pas tout le
  // catalogue sous son nom.
  const notFound = !isAll && !collectionsLoading && !currentCollection;

  // On attend de connaitre la collection pour ne pas afficher tout le
  // catalogue le temps du chargement.
  const { data: productsData } = trpc.product.list.useQuery(
    collectionId ? { collectionId, page: 1, limit: 100 } : { page: 1, limit: 100 },
    { enabled: isAll || !!collectionId },
  );

  const products = useMemo(() => (notFound ? [] : productsData?.products ?? []), [notFound, productsData]);

  useEffect(() => {
    if (gridRef.current && products.length > 0) {
      gsap.fromTo(
        gridRef.current.querySelectorAll(".product-card"),
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power2.out" }
      );
    }
  }, [products, slug]);

  const title = currentCollection?.name || (isAll ? "Tous les articles" : notFound ? "Collection introuvable" : "");

  return (
    <div className="pt-[92px] min-h-[100dvh]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-[220px] flex-shrink-0">
            <h2 className="text-[0.6875rem] uppercase tracking-[2px] text-[#999999] mb-4">Collections</h2>
            <nav className="space-y-0">
              <Link
                to="/collections/all"
                className={`block py-2 text-[0.8125rem] transition-colors ${
                  !slug || slug === "all" ? "text-[#222222] font-medium" : "text-[#666666] hover:text-[#222222]"
                }`}
              >
                Tous les articles
              </Link>
              {collections?.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/collections/${collection.slug}`}
                  className={`block py-2 text-[0.8125rem] transition-colors ${
                    slug === collection.slug ? "text-[#222222] font-medium" : "text-[#666666] hover:text-[#222222]"
                  }`}
                >
                  {collection.name}
                </Link>
              ))}
            </nav>

          </aside>

          {/* Products */}
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-light text-[#222222] mb-2 capitalize">{title}</h1>
            {!notFound && (
              <p className="text-[0.8125rem] text-[#666666] mb-6">{products.length} article{products.length !== 1 ? "s" : ""}</p>
            )}

            <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {products.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="product-card group cursor-pointer"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#eaeaea]">
                    <img
                      src={product.images?.[0] || "/placeholder.png"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    {(!product.inventoryQuantity || product.inventoryQuantity <= 0) && (
                      <span className="absolute top-2 right-2 bg-white text-[#222222] text-[0.625rem] uppercase tracking-[1px] px-2 py-1">
                        Epuise
                      </span>
                    )}
                  </div>
                  <div className="pt-3">
                    <h3 className="product-title">{product.name}</h3>
                    <p className="text-[0.8125rem] text-[#666666] mt-1 tracking-[0.5px]">
                      €{parseFloat(String(product.price)).toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {(notFound || (productsData && products.length === 0)) && (
              <div className="text-center py-20">
                <p className="text-[0.9375rem] text-[#999999]">
                  {notFound ? "Cette collection n'existe pas ou plus." : "Aucun article dans cette collection"}
                </p>
                {notFound && (
                  <Link to="/collections/all" className="inline-block mt-4 text-[0.75rem] uppercase tracking-[2px] underline">
                    Voir tous les articles
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
