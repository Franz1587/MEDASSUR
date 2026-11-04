import { useEffect, useMemo, useState } from "react";
import { Send, Plus, Mail, MessageSquare, Phone, Paperclip, Info, Reply, RotateCcw, List, Layers, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import {
  getCommunications, getCommunicationsConfig, envoyerCommunication, enregistrerRetourCommunication, pieceJointeCommunicationUrl,
  type EnvoyerCommunicationInput,
} from "@/services/communications.service";
import type { Communication } from "@/types/communications";

const CANAUX: { valeur: "Email" | "SMS" | "WhatsApp"; label: string; icon: typeof Mail }[] = [
  { valeur: "Email", label: "Email", icon: Mail },
  { valeur: "SMS", label: "SMS", icon: MessageSquare },
  { valeur: "WhatsApp", label: "WhatsApp", icon: Phone },
];
const TYPES_DESTINATAIRE = ["Prestataire", "Client", "AssureSante", "Prospect", "Libre"] as const;
const LABEL_TYPE: Record<string, string> = { Prestataire: "Prestataire", Client: "Souscripteur", AssureSante: "Assuré", Prospect: "Prospect", Libre: "Libre" };
const STATUT_BADGE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  Envoyé: "success", Reçu: "info", Simulé: "warning", Échec: "danger",
};

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): EnvoyerCommunicationInput {
  return { canal: "SMS", destinataireType: "Libre", destinataireNom: "", destinataireContact: "", objet: "", contenu: "" };
}

function normaliserObjet(objet?: string): string {
  return (objet ?? "").replace(/^(Re|Fwd?|TR|Réf)\s*:\s*/gi, "").trim().toLowerCase();
}

function gmailUrl(to: string, sujet: string): string {
  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(sujet)}`;
}
function outlookUrl(to: string, sujet: string): string {
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(sujet)}`;
}

interface FilDiscussion {
  cle: string;
  contact: string;
  nom: string;
  objet: string;
  messages: Communication[];
  derniere: Communication;
  nbNonLus: number;
}

export default function CommunicationsView() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [filtreCanal, setFiltreCanal] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [vue, setVue] = useState<"liste" | "fils">("liste");
  const [filOuvert, setFilOuvert] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<EnvoyerCommunicationInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [retourOuvert, setRetourOuvert] = useState<string | null>(null);
  const [retourSaisie, setRetourSaisie] = useState("");
  const [smsWhatsappActif, setSmsWhatsappActif] = useState<boolean | null>(null);
  const [emailActif, setEmailActif] = useState<boolean | null>(null);

  const refresh = () => getCommunications({ canal: filtreCanal || undefined, destinataireType: filtreType || undefined }).then(setCommunications);
  useEffect(() => { refresh(); }, [filtreCanal, filtreType]);
  useEffect(() => {
    getCommunicationsConfig()
      .then((c) => { setSmsWhatsappActif(c.smsWhatsappActif); setEmailActif(c.emailActif); })
      .catch(() => { setSmsWhatsappActif(false); setEmailActif(false); });
  }, []);

  // Filtrage local par statut
  const filtrees = useMemo(
    () => filtreStatut ? communications.filter((c) => c.statut === filtreStatut) : communications,
    [communications, filtreStatut],
  );

  const pagination = usePagination(filtrees);

  // Groupement en fils de discussion (email uniquement, par contact + sujet normalisé)
  const fils = useMemo<FilDiscussion[]>(() => {
    const map = new Map<string, Communication[]>();
    for (const c of communications.filter((x) => x.canal === "Email")) {
      const cle = `${c.destinataireContact}::${normaliserObjet(c.objet)}`;
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle)!.push(c);
    }
    return Array.from(map.entries())
      .map(([cle, msgs]) => {
        const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const derniere = sorted[sorted.length - 1];
        return {
          cle,
          contact: derniere.destinataireContact,
          nom: derniere.destinataireNom,
          objet: derniere.objet ?? "",
          messages: sorted,
          derniere,
          nbNonLus: sorted.filter((m) => m.statut === "Reçu" && !m.retour).length,
        };
      })
      .sort((a, b) => new Date(b.derniere.createdAt).getTime() - new Date(a.derniere.createdAt).getTime());
  }, [communications]);

  const handleEnvoyer = async () => {
    if (!form.destinataireNom.trim() || !form.destinataireContact.trim() || !form.contenu.trim()) {
      toast.error("Destinataire, contact et contenu sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      const result = await envoyerCommunication(form);
      setShowCreate(false);
      setForm(emptyForm());
      refresh();
      toast.success(result.statut === "Envoyé" ? "Message envoyé." : "Message journalisé (simulé — fournisseur inactif).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenvoyer = (c: Communication) => {
    setForm({ canal: c.canal, destinataireType: c.destinataireType, destinataireNom: c.destinataireNom, destinataireContact: c.destinataireContact, objet: c.objet ?? "", contenu: c.contenu });
    setShowCreate(true);
  };

  const handleRepondre = (c: Communication) => {
    setForm({
      canal: "Email",
      destinataireType: c.destinataireType,
      destinataireNom: c.destinataireNom,
      destinataireContact: c.destinataireContact,
      objet: c.objet ? (c.objet.startsWith("Re:") ? c.objet : `Re: ${c.objet}`) : "",
      contenu: "",
    });
    setShowCreate(true);
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
      <ModuleHeader title="Communications" subtitle="Email, SMS et WhatsApp — envois, réceptions et fils" icon={Send}
        actions={<Btn variant="primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); }}><Plus className="w-4 h-4" />Nouveau message</Btn>}
      />

      {(smsWhatsappActif !== null || emailActif !== null) && (
        <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-foreground">
            {emailActif ? <>Email actif via <span className="font-semibold">contacts@medassur.cloud</span>.</> : <>Email <span className="font-semibold">simulé</span> (SMTP non configuré).</>}
            {" "}
            {smsWhatsappActif ? <>SMS/WhatsApp actifs via Zavu.</> : <>SMS/WhatsApp <span className="font-semibold">simulés</span> (Zavu sans couverture Gabon).</>}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={filtreCanal} onChange={(e) => setFiltreCanal(e.target.value)} className={`${fieldCls} w-44`}>
          <option value="">Tous les canaux</option>
          {CANAUX.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className={`${fieldCls} w-52`}>
          <option value="">Tous les destinataires</option>
          {TYPES_DESTINATAIRE.map((t) => <option key={t} value={t}>{LABEL_TYPE[t]}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className={`${fieldCls} w-44`}>
          <option value="">Tous les statuts</option>
          <option value="Envoyé">Envoyé</option>
          <option value="Reçu">Reçu</option>
          <option value="Simulé">Simulé</option>
          <option value="Échec">Échec</option>
        </select>
        <div className="ml-auto flex items-center gap-1 border border-border rounded-lg p-1">
          <button type="button" onClick={() => setVue("liste")} title="Vue liste"
            className={`h-7 px-2.5 rounded-md text-[12px] inline-flex items-center gap-1.5 ${vue === "liste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40"}`}
          ><List className="w-3.5 h-3.5" />Liste</button>
          <button type="button" onClick={() => setVue("fils")} title="Vue fils de discussion"
            className={`h-7 px-2.5 rounded-md text-[12px] inline-flex items-center gap-1.5 ${vue === "fils" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40"}`}
          ><Layers className="w-3.5 h-3.5" />Fils</button>
        </div>
      </div>

      {/* ── VUE LISTE ── */}
      {vue === "liste" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Journal ({filtrees.length})</h3></div>
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
                          <Badge variant={STATUT_BADGE[c.statut] ?? "neutral"}>{c.statut}</Badge>
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
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => handleRenvoyer(c)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"><RotateCcw className="w-3.5 h-3.5" />Renvoyer</button>
                      {!c.retour && (
                        retourOuvert === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <input value={retourSaisie} onChange={(e) => setRetourSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEnregistrerRetour(c.id); }} placeholder="Réponse reçue…" className="h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground w-48" autoFocus />
                            <button type="button" onClick={() => handleEnregistrerRetour(c.id)} className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-[11.5px]">OK</button>
                            <button type="button" onClick={() => { setRetourOuvert(null); setRetourSaisie(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Annuler</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setRetourOuvert(c.id); setRetourSaisie(""); }} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"><Reply className="w-3.5 h-3.5" />Enregistrer un retour</button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtrees.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">Aucune communication.</p>}
          </div>
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}

      {/* ── VUE FILS ── */}
      {vue === "fils" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Fils de discussion — email ({fils.length})</h3></div>
          <div className="divide-y divide-border/50">
            {fils.map((fil) => {
              const ouvert = filOuvert === fil.cle;
              const sujetReponse = fil.objet.startsWith("Re:") ? fil.objet : `Re: ${fil.objet}`;
              return (
                <div key={fil.cle} className="overflow-hidden">
                  {/* En-tête du fil */}
                  <button type="button" onClick={() => setFilOuvert(ouvert ? null : fil.cle)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[13px] font-semibold text-foreground ${fil.nbNonLus > 0 ? "font-bold" : ""}`}>{fil.nom}</span>
                        <span className="text-[11.5px] text-muted-foreground">{fil.contact}</span>
                        {fil.nbNonLus > 0 && <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">{fil.nbNonLus}</span>}
                      </div>
                      <p className="text-[12.5px] text-foreground truncate">{fil.objet || "(sans objet)"}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate">{fil.derniere.contenu}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground">{new Date(fil.derniere.createdAt).toLocaleDateString("fr-FR")}</span>
                      <span className="text-[11px] text-muted-foreground">{fil.messages.length} msg{fil.messages.length > 1 ? "s" : ""}</span>
                    </div>
                    {ouvert ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {/* Conversation dépliée */}
                  {ouvert && (
                    <div className="bg-background border-t border-border/50">
                      {/* Messages */}
                      <div className="px-4 py-3 space-y-3 max-h-[480px] overflow-y-auto">
                        {fil.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.statut === "Reçu" ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${m.statut === "Reçu" ? "bg-secondary/50 text-foreground" : "bg-primary/10 text-foreground"}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-semibold">{m.statut === "Reçu" ? m.destinataireNom : "Moi"}</span>
                                <Badge variant={STATUT_BADGE[m.statut] ?? "neutral"}>{m.statut}</Badge>
                                <span className="text-[10.5px] text-muted-foreground ml-auto">{new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                              </div>
                              <p className="text-[12.5px] leading-snug">{m.contenu}</p>
                              {m.pieceJointe && (
                                <a href={pieceJointeCommunicationUrl(m.pieceJointe)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5">
                                  <Paperclip className="w-3 h-3" />{m.pieceJointe}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Actions du fil */}
                      <div className="px-4 py-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => handleRepondre(fil.derniere)}
                          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] inline-flex items-center gap-1.5 hover:opacity-90"
                        ><Reply className="w-3.5 h-3.5" />Répondre via MEDASSUR+</button>
                        {fil.contact.includes("@") && (
                          <>
                            <a href={gmailUrl(fil.contact, sujetReponse)} target="_blank" rel="noreferrer"
                              className="h-8 px-3 rounded-lg border border-border text-[12px] inline-flex items-center gap-1.5 hover:bg-secondary/40 text-foreground"
                            ><ExternalLink className="w-3.5 h-3.5" />Ouvrir dans Gmail</a>
                            <a href={outlookUrl(fil.contact, sujetReponse)} target="_blank" rel="noreferrer"
                              className="h-8 px-3 rounded-lg border border-border text-[12px] inline-flex items-center gap-1.5 hover:bg-secondary/40 text-foreground"
                            ><ExternalLink className="w-3.5 h-3.5" />Ouvrir dans Outlook</a>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {fils.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">Aucun fil de discussion — les emails envoyés et reçus apparaissent ici.</p>}
          </div>
        </div>
      )}

      {/* ── MODAL COMPOSER ── */}
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
