import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pencil, Eye, Send, Save, X, Mail, Check } from "lucide-react";

export default function AdminEmails() {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.email.listTemplates.useQuery();
  const updateTemplate = trpc.email.updateTemplate.useMutation({
    onSuccess: () => { utils.email.listTemplates.invalidate(); setEditingKey(null); },
  });
  const sendEmail = trpc.email.send.useMutation();
  const sendBulk = trpc.email.sendBulk.useMutation();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ subject: "", htmlBody: "", textBody: "" });
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [testEmail, setTestEmail] = useState("");
  const [sentMsg, setSentMsg] = useState("");

  const previewTemplate = trpc.email.previewTemplate.useQuery(
    { key: previewKey!, variables: previewVars },
    { enabled: !!previewKey }
  );

  const openEdit = (t: any) => {
    setEditingKey(t.key);
    setEditForm({ subject: t.subject, htmlBody: t.htmlBody, textBody: t.textBody || "" });
    setPreviewKey(null);
  };

  const openPreview = (t: any) => {
    setPreviewKey(t.key);
    setEditingKey(null);
    try {
      const vars: Record<string, string> = {};
      const parsed = JSON.parse(t.variables || "[]");
      parsed.forEach((v: string) => { vars[v] = v === "email" ? "test@example.com" : v === "total" ? "49.90" : v === "orderNumber" ? "DNM-0001" : `{{${v}}}`; });
      setPreviewVars(vars);
    } catch { setPreviewVars({}); }
  };

  const handleSendTest = (key: string) => {
    if (!testEmail) return;
    sendEmail.mutate({ to: testEmail, templateKey: key, variables: {} }, {
      onSuccess: () => { setSentMsg("Email de test envoye !"); setTimeout(() => setSentMsg(""), 3000); },
    });
  };

  const handleSendBulk = (key: string) => {
    sendBulk.mutate({ templateKey: key }, {
      onSuccess: (data) => { setSentMsg(`${data.sent} emails envoyes !`); setTimeout(() => setSentMsg(""), 3000); },
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[400px]"><div className="w-6 h-6 border-2 border-[#222222] border-t-transparent animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-light text-[#222222]">Templates d&apos;Emails</h1>
        {sentMsg && <span className="text-[0.8125rem] text-green-600 flex items-center gap-1"><Check size={14} />{sentMsg}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates List */}
        <div className="space-y-3">
          {templates?.map((t) => (
            <div key={t.key} className="bg-white border border-[#e8e8e8] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-[#999999]" />
                  <span className="text-[0.8125rem] font-medium">{t.key}</span>
                  {!t.isActive && <span className="text-[0.5rem] uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5">Inactif</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openPreview(t)} className="p-1.5 hover:bg-[#f4f4f4]" title="Apercu"><Eye size={13} /></button>
                  <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-[#f4f4f4]" title="Modifier"><Pencil size={13} /></button>
                </div>
              </div>
              <p className="text-[0.75rem] text-[#666666]">{t.subject}</p>
              <p className="text-[0.625rem] text-[#999999] mt-1">{t.description}</p>

              <div className="flex gap-2 mt-3 pt-2 border-t border-[#f0f0f0]">
                <input
                  type="email"
                  placeholder="Email de test"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 text-[0.6875rem] border border-[#e0e0e0] px-2 py-1 outline-none"
                />
                <button onClick={() => handleSendTest(t.key)} className="text-[0.625rem] uppercase tracking-[1px] bg-[#222222] text-white px-2 py-1 hover:bg-[#333333]">
                  <Send size={10} className="inline mr-1" />Test
                </button>
                <button onClick={() => handleSendBulk(t.key)} className="text-[0.625rem] uppercase tracking-[1px] border border-[#e0e0e0] px-2 py-1 hover:border-[#222222]">
                  Envoi masse
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Preview / Edit Panel */}
        <div>
          {editingKey && (
            <div className="bg-white border border-[#e8e8e8] p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[0.875rem] font-medium">Modifier : {editingKey}</h3>
                <button onClick={() => setEditingKey(null)}><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">Sujet</label>
                  <input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.8125rem] outline-none focus:border-[#222222]" />
                </div>
                <div>
                  <label className="text-[0.625rem] uppercase tracking-[1px] text-[#999999] block mb-1">HTML</label>
                  <textarea value={editForm.htmlBody} onChange={(e) => setEditForm({ ...editForm, htmlBody: e.target.value })}
                    rows={12} className="w-full border border-[#e0e0e0] px-3 py-2 text-[0.75rem] outline-none focus:border-[#222222] resize-none font-mono" />
                </div>
                <button
                  onClick={() => updateTemplate.mutate({ key: editingKey, subject: editForm.subject, htmlBody: editForm.htmlBody, textBody: editForm.textBody })}
                  disabled={updateTemplate.isPending}
                  className="w-full bg-[#222222] text-white py-2 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333333] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={14} /> {updateTemplate.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {previewKey && !editingKey && (
            <div className="bg-white border border-[#e8e8e8]">
              <div className="p-4 border-b border-[#f0f0f0] flex items-center justify-between">
                <h3 className="text-[0.875rem] font-medium">Apercu : {previewKey}</h3>
                <button onClick={() => setPreviewKey(null)}><X size={16} /></button>
              </div>
              {previewTemplate.data ? (
                <>
                  <div className="p-3 bg-[#f4f4f4] border-b border-[#e0e0e0]">
                    <p className="text-[0.75rem] text-[#666666]"><strong>Sujet :</strong> {previewTemplate.data.subject}</p>
                  </div>
                  <iframe srcDoc={previewTemplate.data.html} className="w-full h-[500px] border-0" title="Email preview" />
                </>
              ) : (
                <div className="p-8 text-center text-[0.8125rem] text-[#999999]">Chargement...</div>
              )}
            </div>
          )}

          {!editingKey && !previewKey && (
            <div className="bg-white border border-[#e8e8e8] p-8 text-center">
              <Mail size={40} className="text-[#e0e0e0] mx-auto mb-4" />
              <p className="text-[0.9375rem] text-[#999999]">Selectionnez un template pour le previsualiser ou le modifier</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
