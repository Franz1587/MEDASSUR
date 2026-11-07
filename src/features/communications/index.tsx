import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mail, MailPlus, MessageSquarePlus, Trash2, Archive, Reply, ReplyAll, Forward, MailOpen, Flag, PenLine, RefreshCw,
  Inbox, Send, FileEdit, ChevronLeft, ChevronRight, Search, ArrowDown, ArrowUp, Paperclip, MessageSquare, Phone, Layers, X,
} from "lucide-react";
import { toast } from "sonner";
import { runSilently } from "@/lib/http";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { getClients } from "@/services/clients.service";
import { getPrestataires } from "@/services/prestataires.service";
import {
  getCommunications, getCommunicationsConfig, getCompteursCommunications, majCommunication, supprimerCommunication,
  getSignature, enregistrerSignature,
} from "@/services/communications.service";
import type { Communication, CompteursCommunications, DossierCommunication } from "@/types/communications";
import { Composer, type BrouillonInitial, type Canal, type Contact } from "./Composer";
import { EditeurRiche } from "./EditeurRiche";
import { LecteurMessage, expediteur, initiales, dateLongue, type ModeReponse } from "./LecteurMessage";

const DOSSIERS: { id: DossierCommunication; label: string; icon: typeof Inbox }[] = [
  { id: "reception", label: "Boîte de réception", icon: Inbox },
  { id: "envoyes", label: "Éléments envoyés", icon: Send },
  { id: "brouillons", label: "Brouillons", icon: FileEdit },
  { id: "suivi", label: "Suivis", icon: Flag },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "corbeille", label: "Corbeille", icon: Trash2 },
  { id: "tous", label: "Tous les messages", icon: Layers },
];
const CANAUX: { id: "" | Canal; label: string; icon: typeof Mail }[] = [
  { id: "", label: "Tous les canaux", icon: Layers },
  { id: "Email", label: "Email", icon: Mail },
  { id: "SMS", label: "SMS", icon: MessageSquare },
  { id: "WhatsApp", label: "WhatsApp", icon: Phone },
];

function echapper(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// HTML d'un email externe repris dans l'éditeur (même origine que l'app) :
// assaini par liste blanche (voir sanitizeHtml).
function nettoyerHtml(html: string): string {
  return sanitizeHtml(html);
}

function normaliserObjet(o?: string) {
  return (o ?? "").replace(/^((re|tr|fwd?|réf)\s*:\s*)+/gi, "").trim().toLowerCase();
}

function heureCourte(iso: string) {
  const d = new Date(iso);
  const auj = new Date();
  if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const ecart = (auj.getTime() - d.getTime()) / 86_400_000;
  if (ecart < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR");
}

function groupeDate(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const jours = Math.round((auj.getTime() - d.getTime()) / 86_400_000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 7) return "Cette semaine";
  if (jours < 31) return "Ce mois-ci";
  return "Plus ancien";
}

function contactsDe(liste: string): Contact[] {
  return liste.split(/[;,]/).map((s) => s.trim()).filter(Boolean).map((c) => ({ contact: c, nom: c, type: "Libre" as const }));
}

export default function CommunicationsView() {
  const [dossier, setDossier] = useState<DossierCommunication>("reception");
  const [canal, setCanal] = useState<"" | Canal>("");
  const [onglet, setOnglet] = useState<"tous" | "nonLus">("tous");
  const [tri, setTri] = useState<"desc" | "asc">("desc");
  const [saisieRecherche, setSaisieRecherche] = useState("");
  const [recherche, setRecherche] = useState("");
  const [messages, setMessages] = useState<Communication[]>([]);
  const [chargement, setChargement] = useState(true);
  const [compteurs, setCompteurs] = useState<CompteursCommunications | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [fil, setFil] = useState<Communication[]>([]);
  const [composer, setComposer] = useState<{ cle: number; initial: BrouillonInitial } | null>(null);
  const [fenetreLecture, setFenetreLecture] = useState(false);
  const [signature, setSignature] = useState({ email: "", sms: "" });
  const [editionSignature, setEditionSignature] = useState(false);
  const [voletReplie, setVoletReplie] = useState(false);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [config, setConfig] = useState<{ smsWhatsappActif: boolean; emailActif: boolean } | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  const selection = messages.find((m) => m.id === selectionId) ?? fil.find((m) => m.id === selectionId) ?? null;

  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisieRecherche.trim()), 300);
    return () => clearTimeout(t);
  }, [saisieRecherche]);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setChargement(true);
    try {
      const [liste, c] = await Promise.all([
        getCommunications({ dossier, canal: canal || undefined, q: recherche || undefined }, silencieux),
        getCompteursCommunications(),
      ]);
      setMessages(liste);
      setCompteurs(c);
    } catch (err) {
      if (!silencieux) toast.error(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, [dossier, canal, recherche]);

  useEffect(() => { charger(); }, [charger]);
  // Relève automatique des nouveaux messages.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") charger(true); }, 30_000);
    return () => clearInterval(t);
  }, [charger]);

  useEffect(() => {
    getCommunicationsConfig().then(setConfig).catch(() => setConfig(null));
    getSignature().then((s) => setSignature({ email: nettoyerHtml(s.signatureEmail ?? ""), sms: s.signatureSms ?? "" })).catch(() => undefined);
    // Carnet d'adresses : souscripteurs, prestataires et contacts déjà utilisés.
    runSilently(async () => {
      const [clients, prestataires, historique] = await Promise.all([
        getClients().catch(() => []), getPrestataires().catch(() => []), getCommunications({ dossier: "tous" }, true).catch(() => []),
      ]);
      const liste: Contact[] = [];
      for (const c of clients) {
        if (c.email) liste.push({ contact: c.email, nom: c.nom, type: "Client", id: c.id, sous: "Souscripteur" });
        if (c.tel) liste.push({ contact: c.tel, nom: c.nom, type: "Client", id: c.id, sous: "Souscripteur" });
      }
      for (const p of prestataires) {
        const tel = p.telephone?.split("·")[0]?.trim();
        if (tel) liste.push({ contact: tel, nom: p.nom, type: "Prestataire", id: p.id, sous: "Prestataire" });
      }
      const vus = new Set(liste.map((x) => x.contact.toLowerCase()));
      for (const m of historique) {
        for (const contact of m.destinataireContact.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
          if (vus.has(contact.toLowerCase())) continue;
          vus.add(contact.toLowerCase());
          liste.push({ contact, nom: m.destinataireContact.includes(";") ? contact : m.destinataireNom, type: "Libre", sous: "Contact récent" });
        }
      }
      setSuggestions(liste);
    });
  }, []);

  const visibles = useMemo(() => {
    const l = onglet === "nonLus" ? messages.filter((m) => !m.lu) : messages;
    return tri === "asc" ? [...l].reverse() : l;
  }, [messages, onglet, tri]);

  const ouvrir = async (id: string) => {
    setComposer(null);
    setSelectionId(id);
    const m = messages.find((x) => x.id === id) ?? fil.find((x) => x.id === id);
    if (!m) return;
    if (!m.lu) {
      setMessages((l) => l.map((x) => (x.id === id ? { ...x, lu: true } : x)));
      setCompteurs((c) => (c ? { ...c, nonLus: Math.max(0, c.nonLus - 1) } : c));
      majCommunication(id, { lu: true }).catch(() => undefined);
    }
    const sujet = normaliserObjet(m.objet);
    if (!sujet || m.canal !== "Email") { setFil([]); return; }
    const contacts = new Set(m.destinataireContact.toLowerCase().split(/[;,]/).map((s) => s.trim()));
    const candidats = await getCommunications({ dossier: "tous", q: sujet }, true).catch(() => []);
    setFil(candidats
      .filter((x) => normaliserObjet(x.objet) === sujet && x.destinataireContact.toLowerCase().split(/[;,]/).some((s) => contacts.has(s.trim())))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  };

  const majSelection = async (maj: Partial<Pick<Communication, "lu" | "archive" | "supprime" | "suivi">>, cible = selection) => {
    if (!cible) return;
    try {
      await majCommunication(cible.id, maj);
      const quitteDossier = maj.supprime !== undefined || maj.archive !== undefined || (maj.suivi === false && dossier === "suivi");
      if (quitteDossier) {
        const index = visibles.findIndex((m) => m.id === cible.id);
        const suivant = visibles[index + 1] ?? visibles[index - 1];
        setMessages((l) => l.filter((m) => m.id !== cible.id));
        setSelectionId(suivant?.id ?? null);
        if (maj.supprime) toast.success("Message déplacé dans la corbeille.");
        else if (maj.archive) toast.success("Message archivé.");
        else toast.success("Message restauré.");
      } else {
        setMessages((l) => l.map((m) => (m.id === cible.id ? { ...m, ...maj } : m)));
      }
      getCompteursCommunications().then(setCompteurs).catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const supprimer = async (cible = selection) => {
    if (!cible) return;
    if (cible.supprime || cible.statut === "Brouillon") {
      if (!window.confirm(cible.statut === "Brouillon" ? "Supprimer ce brouillon ?" : "Supprimer définitivement ce message ?")) return;
      try {
        await supprimerCommunication(cible.id);
        setMessages((l) => l.filter((m) => m.id !== cible.id));
        setSelectionId(null);
        getCompteursCommunications().then(setCompteurs).catch(() => undefined);
        toast.success("Message supprimé.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Suppression impossible.");
      }
      return;
    }
    majSelection({ supprime: true }, cible);
  };

  const nouveau = (c: Canal = "Email") => {
    setSelectionId(null);
    setComposer({
      cle: Date.now(),
      initial: { titre: c === "Email" ? "Nouveau message" : `Nouveau ${c === "SMS" ? "SMS" : "message WhatsApp"}`, canal: c, a: [], cc: [], objet: "", html: "", texte: signature.sms ? `\n\n${signature.sms}` : "", pieces: [] },
    });
  };

  const repondre = (mode: ModeReponse, m = selection) => {
    if (!m) return;
    const exp = expediteur(m);
    const sujet = m.objet ?? "";
    const prefixe = mode === "transferer" ? "TR: " : "Re: ";
    const objet = new RegExp(`^${prefixe.trim()}`, "i").test(sujet) ? sujet : `${prefixe}${sujet}`;
    const a = mode === "transferer" ? [] : m.statut === "Reçu"
      ? [{ contact: m.destinataireContact, nom: m.destinataireNom, type: m.destinataireType, id: m.destinataireId }]
      : contactsDe(m.destinataireContact).map((x, _i, t) => (t.length === 1 ? { ...x, nom: m.destinataireNom, type: m.destinataireType, id: m.destinataireId } : x));
    const cc = mode === "repondreTous" && m.cc ? contactsDe(m.cc) : [];
    const sig = signature.email ? `<div>${signature.email}</div>` : "";
    const entete = `<b>De :</b> ${echapper(exp.contact ? `${exp.nom} <${exp.contact}>` : exp.nom)}<br><b>Envoyé :</b> ${echapper(dateLongue(m.createdAt))}<br>`
      + (m.statut !== "Reçu" ? `<b>À :</b> ${echapper(m.destinataireContact)}<br>` : "")
      + (m.cc ? `<b>Cc :</b> ${echapper(m.cc)}<br>` : "") + `<b>Objet :</b> ${echapper(sujet)}`;
    const cite = m.contenuHtml ? nettoyerHtml(m.contenuHtml) : echapper(m.contenu).replace(/\n/g, "<br>");
    setComposer({
      cle: Date.now(),
      initial: {
        titre: mode === "transferer" ? "Transférer" : mode === "repondreTous" ? "Répondre à tous" : "Répondre",
        canal: m.canal, a, cc, objet,
        html: `<p><br></p><p><br></p>${sig}<hr><div style="font-size:13px;color:#4b5563">${entete}</div><blockquote>${cite}</blockquote>`,
        texte: m.canal === "Email" ? "" : `${signature.sms ? `\n\n${signature.sms}` : ""}${mode === "transferer" ? `\n\n— Message transféré —\n${m.contenu}` : ""}`,
        pieces: mode === "transferer" ? m.piecesJointes : [],
      },
    });
  };

  const continuerBrouillon = (m = selection) => {
    if (!m) return;
    setComposer({
      cle: Date.now(),
      initial: {
        titre: "Brouillon", canal: m.canal,
        a: contactsDe(m.destinataireContact).map((x, _i, t) => (t.length === 1 ? { ...x, nom: m.destinataireNom || x.contact, type: m.destinataireType, id: m.destinataireId } : x)),
        cc: m.cc ? contactsDe(m.cc) : [], objet: m.objet ?? "",
        html: m.contenuHtml ? nettoyerHtml(m.contenuHtml) : echapper(m.contenu).replace(/\n/g, "<br>"),
        texte: m.contenu, pieces: m.piecesJointes, brouillonId: m.id,
      },
    });
  };

  // Toute rédaction s'ouvre dans la grande fenêtre ; la fenêtre de lecture lui cède la place.
  useEffect(() => { if (composer) setFenetreLecture(false); }, [composer]);

  const fermerComposer = (actualiser: boolean) => {
    setComposer(null);
    if (actualiser) charger(true);
  };

  const clavierListe = (e: React.KeyboardEvent) => {
    if (!visibles.length) return;
    const i = visibles.findIndex((m) => m.id === selectionId);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const cible = visibles[e.key === "ArrowDown" ? Math.min(i + 1, visibles.length - 1) : Math.max(i - 1, 0)];
      if (cible) {
        ouvrir(cible.id);
        listeRef.current?.querySelector<HTMLElement>(`[data-id="${cible.id}"]`)?.focus();
      }
    } else if (e.key === "Delete" && selection) {
      e.preventDefault();
      supprimer();
    }
  };

  // ── Ruban ──────────────────────────────────────────────────────────────
  const sansSel = !selection || selection.statut === "Brouillon";
  const grosBouton = (label: string, Icon: typeof Mail, action: () => void, desactive = false, accent = false) => (
    <button type="button" onClick={action} disabled={desactive} title={label} aria-label={label}
      className={`flex flex-col items-center justify-center gap-1 min-w-[44px] h-11 md:min-w-[64px] md:h-[60px] px-1.5 md:px-2 rounded-lg text-[11.5px] leading-tight text-foreground hover:bg-secondary/60 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
      <Icon className={`w-5 h-5 ${accent ? "text-primary" : "text-foreground/80"}`} aria-hidden />
      <span className="hidden md:block text-center" aria-hidden>{label}</span>
    </button>
  );
  const groupe = (titre: string, contenu: React.ReactNode) => (
    <div className="flex flex-col items-center px-0.5 md:px-1.5 border-r border-border last:border-r-0">
      <div className="flex items-center gap-0.5">{contenu}</div>
      <span className="hidden md:block text-[10.5px] text-muted-foreground pt-0.5">{titre}</span>
    </div>
  );

  const libelleDossier = DOSSIERS.find((d) => d.id === dossier)?.label ?? "";
  const compte = (id: DossierCommunication) => {
    if (!compteurs) return null;
    if (id === "reception") return compteurs.nonLus || null;
    if (id === "brouillons") return compteurs.brouillons ? `[${compteurs.brouillons}]` : null;
    if (id === "suivi") return compteurs.suivi || null;
    if (id === "corbeille") return compteurs.corbeille || null;
    return null;
  };

  let dernierGroupe = "";

  return (
    <div className="h-[calc(100dvh-112px)] min-h-[560px] flex flex-col p-3 md:p-4 gap-3">
      <h1 className="sr-only">Communications</h1>
      {/* Ruban d'actions */}
      <div role="toolbar" aria-label="Actions de messagerie" className="bg-card border border-border rounded-xl px-2 py-1.5 flex flex-wrap items-stretch gap-y-1">
        {groupe("Nouveau", <>
          {grosBouton("Nouveau courrier", MailPlus, () => nouveau("Email"), false, true)}
          {grosBouton("SMS / WhatsApp", MessageSquarePlus, () => nouveau("WhatsApp"), false, true)}
        </>)}
        {groupe("Supprimer", <>
          {grosBouton("Supprimer", Trash2, () => supprimer(), !selection)}
          {grosBouton("Archiver", Archive, () => majSelection({ archive: true }), sansSel || !!selection?.archive)}
        </>)}
        {groupe("Répondre", <>
          {grosBouton("Répondre", Reply, () => repondre("repondre"), sansSel)}
          {grosBouton("Répondre à tous", ReplyAll, () => repondre("repondreTous"), sansSel || selection?.canal !== "Email")}
          {grosBouton("Transférer", Forward, () => repondre("transferer"), sansSel)}
        </>)}
        {groupe("Indicateurs", <>
          {grosBouton(selection && !selection.lu ? "Lu" : "Non lu", MailOpen, () => majSelection({ lu: !selection?.lu }), sansSel)}
          {grosBouton(selection?.suivi ? "Retirer suivi" : "Assurer un suivi", Flag, () => majSelection({ suivi: !selection?.suivi }), sansSel)}
        </>)}
        {groupe("Outils", <>
          {grosBouton("Signature", PenLine, () => setEditionSignature(true))}
          {grosBouton("Envoyer / Recevoir", RefreshCw, () => { charger(); toast.success("Boîte relevée."); })}
        </>)}
      </div>

      <div className={`flex-1 min-h-0 grid gap-3 grid-cols-1 [grid-template-rows:minmax(0,1fr)] ${voletReplie ? "lg:grid-cols-[48px_380px_1fr]" : "lg:grid-cols-[230px_380px_1fr]"}`}>
        {/* Volet des dossiers */}
        <nav aria-label="Dossiers" className="hidden lg:flex flex-col bg-card border border-border rounded-xl overflow-hidden min-h-0">
          <div className="flex items-center justify-end px-1.5 pt-1.5">
            <button type="button" onClick={() => setVoletReplie((v) => !v)} aria-label={voletReplie ? "Déplier le volet des dossiers" : "Replier le volet des dossiers"}
              className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary/50">
              {voletReplie ? <ChevronRight className="w-4 h-4" aria-hidden /> : <ChevronLeft className="w-4 h-4" aria-hidden />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pb-2">
            {!voletReplie && <p className="px-4 pt-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Dossiers</p>}
            <ul>
              {DOSSIERS.map((d) => {
                const actif = dossier === d.id;
                const n = compte(d.id);
                return (
                  <li key={d.id}>
                    <button type="button" onClick={() => { setDossier(d.id); setSelectionId(null); setOnglet("tous"); }}
                      aria-current={actif ? "page" : undefined} title={d.label}
                      className={`w-full flex items-center gap-2.5 ${voletReplie ? "justify-center px-0" : "px-4"} h-9 text-[13px] ${actif ? "bg-primary/10 text-primary font-semibold border-l-[3px] border-primary" : "text-foreground hover:bg-secondary/40 border-l-[3px] border-transparent"}`}>
                      <d.icon className="w-4 h-4 flex-shrink-0" aria-hidden />
                      {!voletReplie && <span className="flex-1 text-left truncate">{d.label}</span>}
                      {!voletReplie && n !== null && <span className={`text-[12px] ${d.id === "reception" ? "font-bold text-primary" : "text-muted-foreground"}`}>{n}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!voletReplie && (
              <>
                <p className="px-4 pt-4 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Canaux</p>
                <ul>
                  {CANAUX.map((c) => (
                    <li key={c.id || "tous"}>
                      <button type="button" onClick={() => setCanal(c.id)} aria-pressed={canal === c.id}
                        className={`w-full flex items-center gap-2.5 px-4 h-9 text-[13px] ${canal === c.id ? "text-primary font-semibold" : "text-foreground hover:bg-secondary/40"}`}>
                        <c.icon className="w-4 h-4" aria-hidden />{c.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {!voletReplie && config && (
            <p className="px-4 py-2.5 border-t border-border text-[11px] leading-snug text-muted-foreground">
              Email {config.emailActif ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">actif</span> : <span className="text-amber-700 dark:text-amber-400 font-medium">simulé</span>}
              {" · "}SMS/WhatsApp {config.smsWhatsappActif ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">actifs</span> : <span className="text-amber-700 dark:text-amber-400 font-medium">simulés</span>}
            </p>
          )}
        </nav>

        {/* Liste des messages */}
        <section aria-label={`Liste : ${libelleDossier}`} className={`${selection ? "hidden lg:flex" : "flex"} flex-col bg-card border border-border rounded-xl overflow-hidden min-h-0`}>
          <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
            <div className="lg:hidden grid grid-cols-2 gap-2">
              <select aria-label="Dossier" value={dossier} onChange={(e) => { setDossier(e.target.value as DossierCommunication); setSelectionId(null); }}
                className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                {DOSSIERS.map((d) => <option key={d.id} value={d.id}>{d.label}{d.id === "reception" && compteurs?.nonLus ? ` (${compteurs.nonLus})` : ""}</option>)}
              </select>
              <select aria-label="Canal" value={canal} onChange={(e) => setCanal(e.target.value as "" | Canal)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                {CANAUX.map((c) => <option key={c.id || "tous"} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
              <input value={saisieRecherche} onChange={(e) => setSaisieRecherche(e.target.value)} type="search" aria-label="Rechercher dans les messages"
                placeholder={`Rechercher dans ${libelleDossier.toLowerCase()}`}
                className="w-full h-9 pl-8 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              {saisieRecherche && (
                <button type="button" onClick={() => setSaisieRecherche("")} aria-label="Effacer la recherche" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary/50">
                  <X className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3" role="tablist" aria-label="Filtre de lecture">
                {(["tous", "nonLus"] as const).map((o) => (
                  <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
                    className={`h-8 text-[13px] border-b-2 ${onglet === o ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {o === "tous" ? "Tous" : "Non lus"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setTri((t) => (t === "desc" ? "asc" : "desc"))} className="h-8 px-2 rounded-md text-[12.5px] text-muted-foreground hover:bg-secondary/50 inline-flex items-center gap-1"
                aria-label={tri === "desc" ? "Trier du plus ancien au plus récent" : "Trier du plus récent au plus ancien"}>
                Par date {tri === "desc" ? <ArrowDown className="w-3.5 h-3.5" aria-hidden /> : <ArrowUp className="w-3.5 h-3.5" aria-hidden />}
              </button>
            </div>
          </div>

          <div ref={listeRef} className="flex-1 overflow-y-auto" onKeyDown={clavierListe}>
            {chargement && !messages.length ? (
              <ul aria-busy="true" className="divide-y divide-border/60">
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="px-4 py-3 space-y-2 animate-pulse"><div className="h-3 w-2/5 bg-secondary rounded" /><div className="h-3 w-4/5 bg-secondary rounded" /><div className="h-3 w-3/5 bg-secondary/70 rounded" /></li>
                ))}
              </ul>
            ) : visibles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16 gap-2">
                <Inbox className="w-10 h-10 text-muted-foreground/50" aria-hidden />
                <p className="text-[13px] text-muted-foreground">{recherche ? "Aucun message ne correspond à la recherche." : onglet === "nonLus" ? "Aucun message non lu." : "Ce dossier est vide."}</p>
              </div>
            ) : (
              <ul>
                {visibles.map((m) => {
                  const groupeCourant = tri === "desc" ? groupeDate(m.createdAt) : "";
                  const entete = groupeCourant && groupeCourant !== dernierGroupe ? groupeCourant : null;
                  if (groupeCourant) dernierGroupe = groupeCourant;
                  const exp = expediteur(m);
                  const nom = m.statut === "Reçu" ? exp.nom : m.statut === "Brouillon" ? (m.destinataireContact ? `À : ${m.destinataireNom || m.destinataireContact}` : "(aucun destinataire)") : `À : ${m.destinataireNom}`;
                  const actif = m.id === selectionId;
                  const nonLu = !m.lu;
                  const IconeCanal = m.canal === "Email" ? Mail : m.canal === "SMS" ? MessageSquare : Phone;
                  return (
                    <li key={m.id}>
                      {entete && <p className="px-4 pt-3 pb-1 text-[11.5px] font-semibold text-muted-foreground bg-secondary/20">{entete}</p>}
                      <button type="button" data-id={m.id} onClick={() => (m.statut === "Brouillon" ? (setSelectionId(m.id), continuerBrouillon(m)) : ouvrir(m.id))}
                        onDoubleClick={() => { if (m.statut !== "Brouillon") setFenetreLecture(true); }}
                        title={m.statut === "Brouillon" ? undefined : "Double-cliquez pour ouvrir dans une fenêtre"}
                        aria-current={actif ? "true" : undefined}
                        className={`w-full text-left flex gap-3 px-3 py-2.5 border-b border-border/60 border-l-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary
                          ${actif ? "bg-primary/10 border-l-primary" : nonLu ? "border-l-primary hover:bg-secondary/40" : "border-l-transparent hover:bg-secondary/40"}`}>
                        <span className="w-9 h-9 rounded-full bg-primary/15 text-primary text-[12px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden>
                          {initiales(m.statut === "Reçu" ? exp.nom : m.destinataireNom || m.destinataireContact || "?")}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-[13.5px] truncate ${nonLu ? "font-bold text-foreground" : "text-foreground"}`}>{nom}</span>
                            <span className="flex items-center gap-1.5 flex-shrink-0">
                              {m.piecesJointes?.length > 0 && <Paperclip className="w-3.5 h-3.5 text-muted-foreground" aria-label="Pièce jointe" />}
                              {m.suivi && <Flag className="w-3.5 h-3.5 text-red-600 dark:text-red-400" aria-label="Suivi" />}
                            </span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-[12.5px] truncate ${nonLu ? "font-semibold text-primary" : "text-foreground/90"}`}>
                              {m.objet || (m.canal === "Email" ? "(sans objet)" : m.canal)}
                            </span>
                            <time dateTime={m.createdAt} className={`text-[11.5px] flex-shrink-0 ${nonLu ? "font-semibold text-primary" : "text-muted-foreground"}`}>{heureCourte(m.createdAt)}</time>
                          </span>
                          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <IconeCanal className="w-3 h-3 flex-shrink-0" aria-label={m.canal} />
                            <span className="truncate">{m.statut === "Brouillon" ? <span className="text-red-600 dark:text-red-400 mr-1">[Brouillon]</span> : null}{m.contenu.replace(/\s+/g, " ").slice(0, 140)}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="px-3 py-1.5 border-t border-border text-[11.5px] text-muted-foreground">
            {visibles.length} message{visibles.length > 1 ? "s" : ""}{messages.length >= 500 ? " (500 plus récents — affinez la recherche)" : ""}
          </p>
        </section>

        {/* Volet de lecture / rédaction */}
        <section aria-label="Lecture" className={`${selection ? "flex" : "hidden lg:flex"} flex-col bg-card border border-border rounded-xl overflow-hidden min-h-[520px] lg:min-h-0`}>
          {selection && selection.statut !== "Brouillon" ? (
            <LecteurMessage
              c={selection} fil={fil}
              onRetour={() => setSelectionId(null)}
              onAgrandir={() => setFenetreLecture(true)}
              onRepondre={(mode) => repondre(mode)}
              onMaj={(maj) => majSelection(maj)}
              onSupprimerDefinitif={() => supprimer()}
              onModifierBrouillon={() => continuerBrouillon()}
              onOuvrir={ouvrir}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <Mail className="w-12 h-12 text-muted-foreground/40" aria-hidden />
              <p className="text-[14px] text-muted-foreground">Sélectionnez un message pour le lire</p>
              <button type="button" onClick={() => nouveau("Email")} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] inline-flex items-center gap-1.5 hover:opacity-90">
                <MailPlus className="w-4 h-4" aria-hidden />Nouveau courrier
              </button>
            </div>
          )}
        </section>
      </div>

      {fenetreLecture && selection && selection.statut !== "Brouillon" && !composer && (
        <Fenetre titre={selection.objet || "Message"} onFerme={() => setFenetreLecture(false)} fermerSurFond>
          <LecteurMessage
            c={selection} fil={fil} enFenetre
            onRetour={() => setFenetreLecture(false)}
            onRepondre={(mode) => repondre(mode)}
            onMaj={(maj) => majSelection(maj)}
            onSupprimerDefinitif={() => supprimer()}
            onModifierBrouillon={() => continuerBrouillon()}
            onOuvrir={ouvrir}
          />
        </Fenetre>
      )}

      {composer && (
        // Pas de fermeture sur le fond ni Échap : le bouton Fermer enregistre le brouillon.
        <Fenetre titre={composer.initial.titre}>
          <Composer key={composer.cle} initial={composer.initial} suggestions={suggestions} signature={signature} onFerme={fermerComposer} />
        </Fenetre>
      )}

      {editionSignature && (
        <EditionSignature
          initiale={signature}
          onFerme={() => setEditionSignature(false)}
          onEnregistre={(s) => { setSignature({ email: nettoyerHtml(s.email), sms: s.sms }); setEditionSignature(false); }}
        />
      )}
    </div>
  );
}

// Grande fenêtre « bulle » pour lire ou rédiger confortablement (plein écran sur mobile).
function Fenetre({ titre, onFerme, fermerSurFond, children }: { titre: string; onFerme?: () => void; fermerSurFond?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (!onFerme) return;
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFerme(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFerme]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center sm:p-4 md:p-6"
      onMouseDown={(e) => { if (fermerSurFond && onFerme && e.target === e.currentTarget) onFerme(); }}>
      <div role="dialog" aria-modal="true" aria-label={titre}
        className="w-full h-[100dvh] sm:h-[94vh] max-w-[1200px] bg-card sm:border border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150">
        {children}
      </div>
    </div>
  );
}

function EditionSignature({ initiale, onFerme, onEnregistre }: {
  initiale: { email: string; sms: string };
  onFerme: () => void;
  onEnregistre: (s: { email: string; sms: string }) => void;
}) {
  const [email, setEmail] = useState(initiale.email);
  const [sms, setSms] = useState(initiale.sms);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFerme(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFerme]);

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      // Une signature vide (seulement des balises) est enregistrée comme absente.
      const emailPropre = email.replace(/<[^>]*>|&nbsp;/g, "").trim() ? email : "";
      const s = await enregistrerSignature({ signatureEmail: emailPropre, signatureSms: sms.trim() });
      onEnregistre({ email: s.signatureEmail ?? "", sms: s.signatureSms ?? "" });
      toast.success("Signatures enregistrées.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="titre-signature" className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 id="titre-signature" className="text-[15px] font-semibold text-foreground">Signatures</h2>
          <button type="button" onClick={onFerme} aria-label="Fermer" className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-secondary/50"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1">Signature email</p>
            <p className="text-[12px] text-muted-foreground mb-2">Ajoutée automatiquement à chaque nouveau message, réponse et transfert. Modifiable dans le message avant l'envoi.</p>
            <EditeurRiche initialHtml={initiale.email} onChange={(h) => setEmail(h)} minHeight={140} ariaLabel="Signature email" />
          </div>
          <div>
            <label htmlFor="signature-sms" className="text-[13px] font-medium text-foreground">Signature SMS / WhatsApp</label>
            <p className="text-[12px] text-muted-foreground mb-2">Texte simple ajouté en fin de message.</p>
            <textarea id="signature-sms" value={sms} onChange={(e) => setSms(e.target.value)} rows={3}
              placeholder="Ex. : Service Santé — La Ruche Excellence · +241 …"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onFerme} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <button type="button" onClick={enregistrer} disabled={envoi} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
