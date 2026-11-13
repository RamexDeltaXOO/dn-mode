import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { pageTitle } from "@contracts/seo";
import { useSeo } from "@/hooks/useSeo";
import { Check } from "lucide-react";

/** Déclaration de rétractation en ligne, sans compte requis. */
export default function RetractionPage() {
  useSeo((site) => ({
    title: pageTitle("Exercer mon droit de rétractation", site.siteName),
    description: "Envoyer une déclaration de rétractation à DN MODE pour une commande en ligne.",
  }));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [products, setProducts] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [details, setDetails] = useState("");

  const create = trpc.contact.create.useMutation();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate({
      name: name.trim(),
      email: email.trim(),
      orderNumber: orderNumber.trim() || undefined,
      subject: "Déclaration de rétractation",
      message: [
        "Je vous notifie ma décision de me rétracter de la vente conclue sur DN MODE.",
        `Nom : ${name.trim()}`,
        `Email : ${email.trim()}`,
        `Commande : ${orderNumber.trim() || "Non renseignée"}`,
        `Produits concernés : ${products.trim() || "À préciser"}`,
        `Date de réception : ${receivedDate || "Non renseignée"}`,
        `Précisions : ${details.trim() || "Aucune"}`,
      ].join("\n"),
    });
  };
  const fieldClass = "w-full border border-[#dedede] px-3 py-2.5 bg-white text-[0.875rem] outline-none focus:border-[#222222]";

  return (
    <div className="pt-[92px] min-h-[100dvh] bg-white">
      <div className="max-w-[700px] mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <Link to="/cgv" className="text-[0.75rem] text-[#777777] underline underline-offset-4 hover:text-black">Consulter les CGV</Link>
        <h1 className="text-2xl sm:text-3xl font-light text-[#222222] mt-6 mb-5">Exercer mon droit de rétractation</h1>
        <p className="text-[0.875rem] text-[#555555] leading-relaxed mb-8">
          Pour une commande en ligne, vous pouvez en principe vous rétracter dans les 14 jours
          suivant la réception des articles, sous réserve des exceptions légales. Ce formulaire
          enregistre votre déclaration directement auprès du service client, sans avoir à vous connecter.
          Vous pouvez aussi écrire à <a className="underline" href="mailto:sav.dnmode@gmail.com">sav.dnmode@gmail.com</a>.
        </p>

        {create.isSuccess ? (
          <div role="status" className="border border-[#dedede] p-7">
            <Check size={28} className="mb-4 text-[#222222]" />
            <h2 className="text-xl font-medium mb-3">Déclaration enregistrée</h2>
            <p className="text-[0.875rem] text-[#555555] leading-relaxed">
              Votre demande de rétractation a été enregistrée sous la référence
              {" "}SAV-{String(create.data?.id ?? "").padStart(6, "0")}.
              Conservez cette référence comme preuve de votre démarche. Le service client
              vous précisera les modalités de retour.
            </p>
            <Link to="/cgv" className="inline-block mt-5 underline text-[0.8125rem]">Voir les conditions de retour</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="withdrawal-name" className="text-[0.75rem] block mb-2">Nom et prénom *</label>
              <input id="withdrawal-name" className={fieldClass} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="withdrawal-email" className="text-[0.75rem] block mb-2">Adresse email utilisée pour commander *</label>
              <input id="withdrawal-email" type="email" className={fieldClass} required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="withdrawal-order" className="text-[0.75rem] block mb-2">Numéro de commande (si connu)</label>
              <input id="withdrawal-order" className={fieldClass} maxLength={50} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="withdrawal-products" className="text-[0.75rem] block mb-2">Article(s) concerné(s)</label>
              <input id="withdrawal-products" className={fieldClass} maxLength={300} value={products} onChange={(e) => setProducts(e.target.value)} />
            </div>
            <div>
              <label htmlFor="withdrawal-date" className="text-[0.75rem] block mb-2">Date de réception (si connue)</label>
              <input id="withdrawal-date" type="date" className={fieldClass} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="withdrawal-details" className="text-[0.75rem] block mb-2">Précisions éventuelles (facultatif)</label>
              <textarea id="withdrawal-details" className={fieldClass} rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            {create.isError && <p className="text-[0.8125rem] text-red-700" role="alert">La demande n'a pas pu être enregistrée : {create.error.message}</p>}
            <button
              type="submit"
              disabled={create.isPending}
              className="w-full bg-[#222222] text-white px-6 py-3.5 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-[#333333] disabled:opacity-50"
            >
              {create.isPending ? "Envoi..." : "Envoyer ma déclaration de rétractation"}
            </button>
            <p className="text-[0.6875rem] text-[#777777]">L'envoi constitue la notification de votre décision de vous rétracter. Aucun motif n'est demandé.</p>
          </form>
        )}
      </div>
    </div>
  );
}
