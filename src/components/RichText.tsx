/** Affiche un texte du CRM : les passages entre *etoiles* passent en italique. */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={i} className="font-['Playfair_Display'] italic">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </>
  );
}
