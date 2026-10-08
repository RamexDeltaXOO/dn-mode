import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { HomeImageDefaults } from "@contracts/constants";
import gsap from "gsap";

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const hasTracked = useRef(false);

  const { data: featuredProducts } = trpc.product.list.useQuery({ featured: true, page: 1, limit: 8 });
  const { data: allProducts } = trpc.product.list.useQuery({ page: 1, limit: 6 });

  // Visuels choisis dans le CRM. Rien n'est affiche pendant le chargement pour
  // eviter de montrer l'ancienne image puis la nouvelle.
  const { data: homeImages, isError: homeImagesError } = trpc.config.homeImages.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const heroImage = homeImages?.hero ?? (homeImagesError ? HomeImageDefaults.hero : undefined);
  const lookImage = homeImages?.look ?? (homeImagesError ? HomeImageDefaults.look : undefined);

  // Track page view
  const trackView = trpc.analytics.trackPageView.useMutation();
  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      const sessionId = localStorage.getItem("dnmode_session_id");
      trackView.mutate({ page: "/", sessionId: sessionId || undefined });
    }
  }, [trackView]);

  // Hero animation
  useEffect(() => {
    if (heroRef.current) {
      const tl = gsap.timeline({ delay: 0.4 });
      tl.to(".hero-headline", { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
        .to(".hero-subline", { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.5");
    }
  }, []);

  // Scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            gsap.to(el.querySelectorAll(".animate-in"), {
              opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power2.out",
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.2 }
    );
    [brandRef, productsRef, lookRef].forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, [featuredProducts, allProducts]);

  const displayProducts = featuredProducts?.products || allProducts?.products || [];

  return (
    <div>
      {/* Hero Banner */}
      <section
        ref={heroRef}
        className="relative w-full min-h-[500px] h-[60vh] sm:h-[70vh] bg-[#121212] overflow-hidden flex items-center justify-center"
      >
        {heroImage && (
          <img
            src={heroImage}
            alt="DN MODE"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 text-center px-6">
          <Link
            to="/collections/all"
            className="hero-headline opacity-0 translate-y-4 inline-block bg-white text-[#121212] text-[0.75rem] sm:text-[0.8125rem] uppercase tracking-[3px] font-medium px-8 py-4 hover:bg-[#121212] hover:text-white border border-white transition-colors duration-300"
          >
            Nouvelle collection
          </Link>
          {/* <p
            className="hero-subline opacity-0 translate-y-4 text-white/60 text-base sm:text-lg mt-3 tracking-[0.5px]"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
          >
            Remise automatique au panier**
          </p> */}
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="w-[1px] h-10 bg-white/30 animate-bounce" />
        </div>
      </section>

      {/* Brand Statement */}
      <section ref={brandRef} className="bg-[#f4f4f4] py-16 sm:py-24">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          {/* <div className="animate-in opacity-0 translate-y-5 mb-6">
            <img src="/logo-dnmode.png" alt="DN MODE" className="h-24 sm:h-28 w-auto mx-auto" />
          </div> */}
          <p className="animate-in opacity-0 translate-y-5 text-[0.9375rem] text-black font-bold leading-[1.6]">
            DN MODE votre{" "}
            <em className="font-['Playfair_Display'] italic">style</em> notre{" "}
            <em className="font-['Playfair_Display'] italic">identité</em>.
          </p>
          {/* <p className="animate-in opacity-0 translate-y-5 text-[0.8125rem] text-[#999999] tracking-[3px] uppercase mt-8">
            Production <strong className="text-[#222222] font-medium">Ethique</strong>
          </p> */}
        </div>
      </section>

      {/* Featured Products */}
      <section ref={productsRef} className="bg-[#f4f4f4] pb-16 sm:pb-24">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* <p className="animate-in opacity-0 translate-y-5 section-label text-center mb-10">
            Les premiers essentiels du printemps
          </p> */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.slug}`}
                className="animate-in opacity-0 translate-y-10 group cursor-pointer"
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
                <div className="pt-3 text-center">
                  <h3 className="product-title">{product.name}</h3>
                  <p className="text-[0.8125rem] text-[#666666] mt-1 tracking-[0.5px]">
                    €{parseFloat(String(product.price)).toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="animate-in opacity-0 translate-y-5 text-center mt-10">
            <Link
              to="/collections/ensembles"
              className="text-[0.6875rem] uppercase tracking-[2px] text-[#222222] border-b border-[#222222] pb-0.5 hover:opacity-60 transition-opacity"
            >
              TOUT
            </Link>
          </div>
        </div>
      </section>

      {/* Look du Moment */}
      <section ref={lookRef} className="bg-[#f4f4f4] pb-16 sm:pb-24">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-in opacity-0 translate-y-5 relative aspect-[16/9] overflow-hidden bg-[#eaeaea]">
            {lookImage && (
              <img
                src={lookImage}
                alt="Look du Moment"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <Link
                to="/collections/look-du-moment"
                className="bg-white text-[#222222] px-7 py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#222222] hover:text-white transition-colors"
              >
                LOOK DU MOMENT
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
