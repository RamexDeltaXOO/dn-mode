import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Mail, MailOpen, Reply, Clock } from "lucide-react";

const statusConfig = {
  new: { label: "Nouveau", color: "bg-orange-100 text-orange-800", icon: Mail },
  read: { label: "Lu", color: "bg-blue-100 text-blue-800", icon: MailOpen },
  replied: { label: "Repondu", color: "bg-green-100 text-green-800", icon: Reply },
};

export default function AdminMessages() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<number | null>(null);

  const { data: contactsData, isLoading } = trpc.contact.list.useQuery(
    statusFilter ? { status: statusFilter, page: 1, limit: 50 } : { page: 1, limit: 50 }
  );
  const utils = trpc.useUtils();
  const updateStatus = trpc.contact.updateStatus.useMutation({
    onSuccess: () => {
      utils.contact.list.invalidate();
    },
  });

  const contacts = contactsData?.contacts || [];

  const selected = contacts.find((c) => c.id === selectedMessage);

  return (
    <div>
      <h1 className="text-2xl font-light text-[#222222] mb-6">Messages</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        {["", "new", "read", "replied"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-[0.75rem] uppercase tracking-[1px] border transition-colors ${
              statusFilter === s
                ? "bg-[#222222] text-white border-[#222222]"
                : "bg-white text-[#666666] border-[#e0e0e0] hover:border-[#222222]"
            }`}
          >
            {s === "" ? "Tous" : statusConfig[s as keyof typeof statusConfig]?.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-1 bg-white shadow-sm border border-[#e8e8e8]">
          <div className="p-4 border-b border-[#f0f0f0]">
            <p className="text-[0.6875rem] text-[#999999] uppercase tracking-[1px]">
              {contactsData?.total || 0} message{contactsData?.total !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-[#f0f0f0] max-h-[600px] overflow-auto">
            {isLoading ? (
              <p className="p-4 text-[0.8125rem] text-[#999999]">Chargement...</p>
            ) : contacts.length === 0 ? (
              <p className="p-4 text-[0.8125rem] text-[#999999]">Aucun message</p>
            ) : (
              contacts.map((contact) => {
                const config = statusConfig[contact.status as keyof typeof statusConfig];
                return (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSelectedMessage(contact.id);
                      if (contact.status === "new") {
                        updateStatus.mutate({ id: contact.id, status: "read" });
                      }
                    }}
                    className={`w-full text-left p-4 hover:bg-[#fafafa] transition-colors ${
                      selectedMessage === contact.id ? "bg-[#fafafa] border-l-2 border-[#222222]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[0.8125rem] font-medium truncate">{contact.name}</span>
                      <span
                        className={`text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 flex-shrink-0 ${config?.color}`}
                      >
                        {config?.label}
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-[#666666] truncate">{contact.message}</p>
                    <p className="text-[0.625rem] text-[#999999] mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(contact.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-white shadow-sm border border-[#e8e8e8] p-6">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-light text-[#222222]">{selected.name}</h2>
                  <p className="text-[0.8125rem] text-[#666666]">{selected.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus.mutate({ id: selected.id, status: "replied" })}
                    className={`px-3 py-1.5 text-[0.6875rem] uppercase tracking-[1px] border transition-colors ${
                      selected.status === "replied"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-white text-[#666666] border-[#e0e0e0] hover:border-[#222222]"
                    }`}
                  >
                    Marquer comme repondu
                  </button>
                  <a
                    href={`mailto:${selected.email}`}
                    className="px-3 py-1.5 text-[0.6875rem] uppercase tracking-[1px] bg-[#222222] text-white hover:bg-[#333333]"
                  >
                    Repondre
                  </a>
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] pt-4">
                <p className="text-[0.75rem] text-[#999999] uppercase tracking-[1px] mb-2">Message</p>
                <p className="text-[0.9375rem] text-[#222222] leading-[1.6] whitespace-pre-wrap">
                  {selected.message}
                </p>
              </div>

              <div className="border-t border-[#f0f0f0] pt-4 mt-6">
                <p className="text-[0.6875rem] text-[#999999]">
                  Recu le {new Date(selected.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <Mail size={40} className="text-[#e0e0e0] mb-4" />
              <p className="text-[0.9375rem] text-[#999999]">
                Selectionnez un message pour voir les details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
