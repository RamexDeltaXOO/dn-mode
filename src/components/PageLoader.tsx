/** Affiche pendant le telechargement d'une page chargee a la demande. */
export default function PageLoader({ className = "pt-[92px] min-h-[100dvh]" }: { className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <div className="w-8 h-8 border-2 border-[#222222] border-t-transparent animate-spin" />
    </div>
  );
}
