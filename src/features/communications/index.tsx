import { useEffect, useState } from "react";
import { Send, Plus, Mail, MessageSquare, Phone, Paperclip, Info, Reply } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import {
  getCommunications, envoyerCommunication, enregistrerRetourCommunication, pieceJointeCommunicationUrl,
  type EnvoyerCommunicationInput,
} from "@/services/communications.service";
import type { Communication } from "@/types/communications";

// Communications externes (2026-08) — voir demande utilisateur : "l'application
// doit pouvoir rendre possible l'envoi des mails, sms et whatsapp. et
// recevoir des retours sous forme de notification et message interne."
// AUCUN fournisseur SMS/Email/WhatsApp n'est branché sur ce projet (voir
// CommunicationsService, backend) — chaque envoi ci-dessous est SIMULÉ et
// journalisé, jamais réellement transmis ; le journal reste néanmoins réel
// et exploitable (relances, automatisation "nouveau contrat", etc.),
// prêt à devenir un vrai envoi le jour où un fournisseur est connecté.
const CANAUX: { valeur: "Email" | "SMS" | "WhatsApp"; label: string; icon: typeof Mail }[] = [
  { valeur: "Email", label: "Email", icon: Mail },
  { valeur: "SMS", label: "SMS", icon: MessageSquare },
  { valeur: "WhatsApp", label: "WhatsApp", icon: Phone },
];
const TYPES_DESTINATAIRE = ["Prestataire", "Client", "AssureSante", "Prospect", "Libre"] as const;
const LABEL_TYPE: Record<string, string> = { Prestataire: "Prestataire", Client: "Souscripteur", AssureSante: "Assuré", Prospect: "Prospect", Libre: "Libre" };

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): EnvoyerCommunicationInput {
  return { canal: "SMS", destinataireType: "Libre", destinataireNom: "", destinataireContact: "", objet: "", contenu: "" };
}

export default function CommunicationsView() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const pagination = usePagination(communications);
  const [filtreCanal, setFiltreCanal] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<EnvoyerCommunicationInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [retourOuvert, setRetourOuvert] = useState<string | null>(null);
  const [retourSaisie, setRetourSaisie] = useState("");

  const refresh = () => getCommunications({ canal: filtreCanal || undefined, destinataireType: filtreType || undefined }).then(setCommunications);

  useEffect(() => { refresh(); }, [filtreCanal, filtreType]);

  const handleEnvoyer = async () => {
    if (!form.destinataireNom.trim() || !form.destinataireContact.trim() || !form.contenu.trim()) {
      toast.error("Destinataire, contact et contenu sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await envoyerCommunication(form);
      setShowCreate(false);
      setForm(emptyForm());
      refresh();
      toast.success("Message envoyé (simulé) et journalisé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnregistrerRetour = async (id: string) => {
    if (!retourSaisie.trim()) return;
    try {
      await enregistrerRetourCommunication(id, retourSaisie.trim());
      setRetourOuvert(null);
      setRetourSaisie("");
      refresh();
      toast.success("Retour enregistré — notification interne envoyée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Communications" subtitle="Email, SMS et WhatsApp — envois et retours" icon={Send}
        actions={<Btn variant="primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); }}><Plus className="w-4 h-4" />Nouveau message</Btn>}
      />

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-foreground">Aucun fournisseur Email/SMS/WhatsApp n'est encore connecté à l'application — chaque envoi ci-dessous est <span className="font-semibold">simulé</span> et journalisé, prêt à devenir un envoi réel une fois un fournisseur branché. La présence d'un compte WhatsApp associé à un numéro n'est pas vérifiable sans un tel fournisseur.</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select value={filtreCanal} onChange={(e) => setFiltreCanal(e.target.value)} className={`${fieldCls} w-44`}>
          <option value="">Tous les canaux</option>
          {CANAUX.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className={`${fieldCls} w-52`}>
          <option value="">Tous les destinataires</option>
          {TYPES_DESTINATAIRE.map((t) => <option key={t} value={t}>{LABEL_TYPE[t]}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Journal des envois ({communications.length})</h3></div>
        <div className="divide-y divide-border/50">
          {pagination.pageItems.map((c) => {
            const Icon = CANAUX.find((k) => k.valeur === c.canal)?.icon ?? Mail;
            return (
              <div key={c.id} className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">{c.destinataireNom}</span>
                        <Badge variant="neutral">{LABEL_TYPE[c.destinataireType]}</Badge>
                        {c.declencheur !== "Manuel" && <Badge variant="info">{c.declencheur}</Badge>}
                        <Badge variant={c.statut === "Simulé" ? "warning" : "danger"}>{c.statut}</Badge>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">{c.destinataireContact} · {new Date(c.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
                      {c.objet && <p className="text-[12.5px] font-medium text-foreground mt-1.5">{c.objet}</p>}
                      <p className="text-[12.5px] text-muted-foreground mt-0.5">{c.contenu}</p>
                      {c.pieceJointe && (
                        <a href={pieceJointeCommunicationUrl(c.pieceJointe)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline mt-1.5">
                          <Paperclip className="w-3 h-3" />{c.pieceJointe}
                        </a>
                      )}
                      {c.retour && (
                        <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5">
                          <Reply className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[12px] text-foreground"><span className="font-semibold">Retour</span> ({c.retourDate && new Date(c.retourDate).toLocaleDateString("fr-FR")}) : {c.retour}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {!c.retour && (
                    retourOuvert === c.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input value={retourSaisie} onChange={(e) => setRetourSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEnregistrerRetour(c.id); }} placeholder="Réponse reçue…" className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground w-48" autoFocus />
                        <button type="button" onClick={() => handleEnregistrerRetour(c.id)} className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-[11.5px]">OK</button>
                        <button type="button" onClick={() => { setRetourOuvert(null); setRetourSaisie(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Annuler</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setRetourOuvert(c.id); setRetourSaisie(""); }} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 flex-shrink-0 whitespace-nowrap"><Reply className="w-3.5 h-3.5" />Enregistrer un retour</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
          {communications.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">Aucune communication — cliquez sur "Nouveau message" pour commencer.</p>}
        </div>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouveau message</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className={labelCls}>Canal</div>
                <div className="flex gap-2">
                  {CANAUX.map((c) => (
                    <button key={c.valeur} type="button" onClick={() => setForm((v) => ({ ...v, canal: c.valeur }))}
                      className={`h-9 flex-1 px-2 rounded-lg border text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5 ${form.canal === c.valeur ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                    ><c.icon className="w-3.5 h-3.5" />{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><div className={labelCls}>Type de destinataire</div>
                  <select value={form.destinataireType} onChange={(e) => setForm((v) => ({ ...v, destinataireType: e.target.value as EnvoyerCommunicationInput["destinataireType"] }))} className={fieldCls}>
                    {TYPES_DESTINATAIRE.map((t) => <option key={t} value={t}>{LABEL_TYPE[t]}</option>)}
                  </select>
                </label>
                <label className="block"><div className={labelCls}>Nom du destinataire</div><input value={form.destinataireNom} onChange={(e) => setForm((v) => ({ ...v, destinataireNom: e.target.value }))} className={fieldCls} /></label>
              </div>
              <label className="block"><div className={labelCls}>{form.canal === "Email" ? "Adresse email" : "Numéro de téléphone"}</div><input value={form.destinataireContact} onChange={(e) => setForm((v) => ({ ...v, destinataireContact: e.target.value }))} className={fieldCls} placeholder={form.canal === "Email" ? "nom@exemple.ga" : "+241 06 00 00 00"} /></label>
              {form.canal === "Email" && (
                <label className="block"><div className={labelCls}>Objet</div><input value={form.objet} onChange={(e) => setForm((v) => ({ ...v, objet: e.target.value }))} className={fieldCls} /></label>
              )}
              <label className="block"><div className={labelCls}>Message</div><textarea value={form.contenu} onChange={(e) => setForm((v) => ({ ...v, contenu: e.target.value }))} rows={4} className={fieldCls} placeholder="Prise en charge, note d'information…" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submitting} onClick={handleEnvoyer} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
