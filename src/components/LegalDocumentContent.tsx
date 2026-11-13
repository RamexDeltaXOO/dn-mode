/**
 * Affichage de documents juridiques saisis en texte brut dans le CRM.
 * Les lignes "## Titre" deviennent des sous-titres, sans injection HTML.
 */
export default function LegalDocumentContent({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const sectionTitle = lines[0].startsWith("## ") ? lines[0].slice(3).trim() : null;
        if (sectionTitle) {
          return (
            <section key={index} className="space-y-3">
              <h2 className="text-[1rem] sm:text-[1.0625rem] font-medium text-[#222222]">
                {sectionTitle}
              </h2>
              {lines.length > 1 && (
                <p className="text-[0.875rem] sm:text-[0.9375rem] leading-[1.9] text-[#555555] whitespace-pre-line">
                  {lines.slice(1).join("\n")}
                </p>
              )}
            </section>
          );
        }
        return (
          <p key={index} className="text-[0.875rem] sm:text-[0.9375rem] leading-[1.9] text-[#555555] whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
