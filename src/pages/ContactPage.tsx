import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Check } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const createContact = trpc.contact.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setName("");
      setEmail("");
      setMessage("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email && message) {
      createContact.mutate({ name, email, message });
    }
  };

  return (
    <div className="pt-[92px] min-h-[100dvh]">
      <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-light text-[#222222] text-center mb-4">
          Get in touch
        </h1>
        <p className="text-[0.9375rem] text-[#666666] text-center mb-12 max-w-[500px] mx-auto leading-[1.6]">
          Nous sommes la pour vous aider. Envoyez-nous un message et nous vous repondrons dans les plus brefs delais.
        </p>

        {submitted ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg text-[#222222] mb-2">Message envoye !</h2>
            <p className="text-[0.8125rem] text-[#666666]">
              Merci de nous avoir contacte. Nous vous repondrons bientot.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 text-[0.75rem] uppercase tracking-[2px] underline"
            >
              Envoyer un autre message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="section-label block mb-2">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border-b border-[#e0e0e0] py-2 text-[0.9375rem] outline-none focus:border-[#222222] transition-colors bg-transparent"
                />
              </div>
              <div>
                <label className="section-label block mb-2">Courriel</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border-b border-[#e0e0e0] py-2 text-[0.9375rem] outline-none focus:border-[#222222] transition-colors bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="section-label block mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full border-b border-[#e0e0e0] py-2 text-[0.9375rem] outline-none focus:border-[#222222] transition-colors bg-transparent resize-none"
              />
            </div>

            <div className="text-center pt-4">
              <button
                type="submit"
                disabled={createContact.isPending}
                className="bg-[#222222] text-white px-10 py-3 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] transition-colors disabled:opacity-50"
              >
                {createContact.isPending ? "Envoi..." : "Envoyer"}
              </button>
            </div>

            <p className="text-[0.6875rem] text-[#999999] text-center mt-4">
              Ce site est protege par reCAPTCHA. La Politique de confidentialite et les Conditions de service s&apos;appliquent.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
