import { Link } from "react-router";
import { LEGAL_DOCUMENTS, type LegalDocumentType } from "@contracts/legal";
import { pageTitle } from "@contracts/seo";
import { useSeo } from "@/hooks/useSeo";
import { trpc } from "@/providers/trpc";
import LegalDocumentContent from "@/components/LegalDocumentContent";

export default function LegalPage({ type }: { type: LegalDocumentType }) {
  const document = LEGAL_DOCUMENTS[type];
  const { data } = trpc.config.legalDocument.useQuery({ type }, {
    staleTime: 30_000,
    retry: false,
  });
  useSeo((site) => ({
    title: pageTitle(document.title, site.siteName),
    description: document.description,
  }));

  return (
    <div className="pt-[92px] min-h-[100dvh] bg-white">
      <div className="max-w-[860px] mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <nav className="mb-9 text-[0.75rem] text-[#888888]">
          <Link to="/" className="hover:text-[#222222]">Accueil</Link>
          <span className="mx-2">/</span>
          <span className="text-[#333333]">{document.title}</span>
        </nav>
        <header className="pb-9 mb-10 border-b border-[#e8e8e8]">
          <p className="text-[0.6875rem] uppercase tracking-[2px] text-[#999999] mb-4">Informations légales</p>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-[#222222]">{document.title}</h1>
          <p className="mt-4 text-[0.8125rem] text-[#777777]">{document.description}</p>
        </header>
        <LegalDocumentContent content={data?.content ?? document.defaultContent} />
        <div className="mt-12 pt-8 border-t border-[#e8e8e8] flex flex-wrap gap-x-6 gap-y-3 text-[0.8125rem] text-[#555555]">
          <Link to="/cgv" className="hover:text-black underline underline-offset-4">CGV</Link>
          <Link to="/cgu" className="hover:text-black underline underline-offset-4">CGU</Link>
          <Link to="/mentions-legales" className="hover:text-black underline underline-offset-4">Mentions légales</Link>
          <Link to="/retractation" className="hover:text-black underline underline-offset-4">Exercer ma rétractation</Link>
        </div>
      </div>
    </div>
  );
}
