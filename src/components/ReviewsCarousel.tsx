import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * Avis clients saisis dans le CRM, en carrousel horizontal : glisser au doigt
 * sur mobile, fleches et points sur desktop. Rien n'est affiche sans avis.
 */
export default function ReviewsCarousel({ title }: { title: string }) {
  const { data: reviews } = trpc.review.list.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const count = reviews?.length ?? 0;

  // Carte la plus a gauche visible, pour les points.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const card = track.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
      setActive(Math.min(count - 1, Math.round(track.scrollLeft / step)));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [count]);

  if (!count) return null;

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (track && card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-label text-center mb-10">{title}</h2>

        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {reviews!.map((review) => (
              <article
                key={review.id}
                className="snap-start shrink-0 w-[85%] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] bg-[#f8f8f8] rounded-2xl px-8 py-12 sm:px-10 flex flex-col items-center text-center"
              >
                <p className="text-[1.0625rem] sm:text-[1.125rem] leading-[1.6] text-[#121212] flex-1">
                  {review.content}
                </p>
                <div className="flex gap-1.5 mt-10" aria-label={`${review.rating} sur 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={30}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      className={i < review.rating ? "fill-black text-black" : "fill-[#dddddd] text-[#dddddd]"}
                    />
                  ))}
                </div>
                <p className="mt-6 text-[1.125rem] font-bold tracking-[0.5px] text-black">{review.authorName}</p>
                {/* Ligne gardee meme vide pour aligner les cartes entre elles. */}
                <p className="mt-3 min-h-[1.5em] text-[0.9375rem] text-[#8a8a8a]">{review.subtitle}</p>
              </article>
            ))}
          </div>

          {count > 1 && (
            <>
              <button
                onClick={() => scrollTo(Math.max(0, active - 1))}
                disabled={active === 0}
                aria-label="Avis precedent"
                className="hidden sm:flex absolute -left-4 lg:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-white border border-[#e0e0e0] rounded-full shadow-sm hover:border-[#222222] disabled:opacity-0 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scrollTo(Math.min(count - 1, active + 1))}
                disabled={active >= count - 1}
                aria-label="Avis suivant"
                className="hidden sm:flex absolute -right-4 lg:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-white border border-[#e0e0e0] rounded-full shadow-sm hover:border-[#222222] disabled:opacity-0 transition"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {reviews!.map((review, i) => (
              <button
                key={review.id}
                onClick={() => scrollTo(i)}
                aria-label={`Voir l'avis ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-[#121212]" : "w-1.5 bg-[#cccccc]"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
