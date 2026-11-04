import { useMemo, useRef, useState } from "react";
import { Send, Paperclip, X, Mail, MessageSquare, Phone, Save, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EditeurRiche } from "./EditeurRiche";
import {
  envoyerCommunication, enregistrerBrouillon, supprimerCommunication, nomPieceJointe, pieceJointeCommunicationUrl,
  type EnvoyerCommunicationInput,
} from "@/services/communications.service";

export type Canal = "Email" | "SMS" | "WhatsApp";
export type TypeDestinataire = EnvoyerCommunicationInput["destinataireType"];
export interface Contact { contact: string; nom: string; type: TypeDestinataire; id?: string; sous?: string }

export interface BrouillonInitial {
  titre: string;
  canal: Canal;
  a: Contact[];
  cc: Contact[];
  objet: string;
  html: string;
  texte: string;
  pieces: string[];
  brouillonId?: string;
}

const CANAUX: { valeur: Canal; icon: typeof Mail }[] = [
  { valeur: "Email", icon: Mail }, { valeur: "SMS", icon: MessageSquare }, { valeur: "WhatsApp", icon: Phone },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^\+?[\d\s.()-]{6,}$/;
const LIMITE_FICHIER = 25 * 1024 * 1024;

function taille(o: number) {
  return o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1)} Mo`;
}

// Champ destinataires à puces avec recherche à la frappe.
function ChampDestinataires({ label, valeur, onChange, suggestions, canal, autoFocus }: {
  label: string; valeur: Contact[]; onChange: (v: Contact[]) => void; suggestions: Contact[]; canal: Canal; autoFocus?: boolean;
}) {
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [surbrillance, setSurbrillance] = useState(0);
  const valide = (c: string) => (canal === "Email" ? EMAIL_RE.test(c) : TEL_RE.test(c));

  const filtres = useMemo(() => {
    const q = saisie.trim().toLowerCase();
    if (!q) return [];
    const deja = new Set(valeur.map((v) => v.contact.toLowerCase()));
    return suggestions
      .filter((s) => !deja.has(s.contact.toLowerCase()) && (s.nom.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [saisie, suggestions, valeur]);

  const ajouter = (c: Contact) => { onChange([...valeur, c]); setSaisie(""); setOuvert(false); };
  const ajouterSaisie = () => {
    const t = saisie.trim().replace(/[;,]$/, "");
    if (t) ajouter({ contact: t, nom: t, type: "Libre" });
  };

  return (
    <div className="relative flex items-start gap-2 border-b border-border py-1.5">
      <span className="text-[13px] text-muted-foreground w-10 flex-shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
        {valeur.map((v, i) => (
          <span key={`${v.contact}-${i}`} title={v.contact}
            className={`inline-flex items-center gap-1 max-w-full rounded-full px-2.5 py-0.5 text-[12.5px] border ${valide(v.contact) ? "bg-primary/10 border-primary/20 text-foreground" : "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300"}`}>
            <span className="truncate">{v.nom !== v.contact ? `${v.nom} <${v.contact}>` : v.contact}</span>
            <button type="button" aria-label={`Retirer ${v.contact}`} onClick={() => onChange(valeur.filter((_, j) => j !== i))}
              className="rounded-full hover:bg-secondary p-0.5"><X className="w-3 h-3" aria-hidden /></button>
          </span>
        ))}
        <input
          value={saisie} autoFocus={autoFocus} aria-label={`Destinataires ${label}`}
          onChange={(e) => { setSaisie(e.target.value); setOuvert(true); setSurbrillance(0); }}
          onBlur={() => setTimeout(() => { setOuvert(false); ajouterSaisie(); }, 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSurbrillance((h) => Math.min(h + 1, filtres.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSurbrillance((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" || e.key === ";" || e.key === "," || e.key === "Tab") {
              if (!saisie.trim()) return;
              e.preventDefault();
              if (ouvert && filtres[surbrillance]) ajouter(filtres[surbrillance]); else ajouterSaisie();
            } else if (e.key === "Backspace" && !saisie && valeur.length) onChange(valeur.slice(0, -1));
          }}
          placeholder={valeur.length ? "" : canal === "Email" ? "Nom ou adresse email" : "Nom ou numéro de téléphone"}
          className="flex-1 min-w-[160px] h-8 bg-transparent text-[13px] text-foreground outline-none"
        />
      </div>
      {ouvert && filtres.length > 0 && (
        <ul role="listbox" className="absolute left-12 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {filtres.map((s, i) => (
            <li key={`${s.contact}-${i}`} role="option" aria-selected={i === surbrillance}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ajouter(s)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 ${i === surbrillance ? "bg-primary/10" : "hover:bg-secondary/50"}`}>
                <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{s.nom.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-foreground truncate">{s.nom}</span>
                  <span className="block text-[11.5px] text-muted-foreground truncate">{s.contact}{s.sous ? ` · ${s.sous}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Composer({ initial, suggestions, signature, onFerme }: {
  initial: BrouillonInitial;
  suggestions: Contact[];
  signature: { email: string; sms: string };
  onFerme: (actualiser: boolean) => void;
}) {
  const [canal, setCanal] = useState<Canal>(initial.canal);
  const [a, setA] = useState<Contact[]>(initial.a);
  const [cc, setCc] = useState<Contact[]>(initial.cc);
  const [afficherCc, setAfficherCc] = useState(initial.cc.length > 0);
  const [objet, setObjet] = useState(initial.objet);
  const [html, setHtml] = useState(initial.html);
  const [texteEmail, setTexteEmail] = useState("");
  const [texte, setTexte] = useState(initial.texte);
  const [pieces, setPieces] = useState<string[]>(initial.pieces);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [brouillonId, setBrouillonId] = useState(initial.brouillonId);
  const [occupe, setOccupe] = useState<"envoi" | "brouillon" | null>(null);
  const [survol, setSurvol] = useState(false);
  const modifie = useRef(false);
  const inputFichier = useRef<HTMLInputElement>(null);
  // Signature insérée une seule fois à l'ouverture, modifiable ensuite comme dans Outlook.
  const htmlInitial = useRef(initial.html);
  const editeurPret = useRef(false);
  const touche = <T,>(set: (v: T) => void) => (v: T) => { modifie.current = true; set(v); };

  const suggestionsCanal = useMemo(
    () => suggestions.filter((s) => (canal === "Email" ? EMAIL_RE.test(s.contact) : TEL_RE.test(s.contact))),
    [suggestions, canal],
  );
  const segmentsSms = useMemo(() => {
    const unicode = /[^\x00-\x7F]/.test(texte);
    const par = unicode ? 70 : 160;
    return { n: Math.max(1, Math.ceil(texte.length / par)), par };
  }, [texte]);

  const ajouterFichiers = (liste: FileList | File[]) => {
    const ok: File[] = [];
    for (const f of Array.from(liste)) {
      if (f.size > LIMITE_FICHIER) toast.error(`« ${f.name} » dépasse 25 Mo.`);
      else ok.push(f);
    }
    if (ok.length) { modifie.current = true; setFichiers((v) => [...v, ...ok]); }
  };

  const changerCanal = (c: Canal) => {
    if (c === canal) return;
    // Conserver le texte saisi en passant de l'email au SMS/WhatsApp.
    if (canal === "Email" && c !== "Email" && !texte.trim()) setTexte(texteEmail.trim());
    if (canal === "Email") { htmlInitial.current = html; editeurPret.current = false; }
    setCanal(c);
  };

  const charge = (): EnvoyerCommunicationInput => {
    const seul = a.length === 1 ? a[0] : null;
    return {
      canal,
      destinataireType: seul?.type ?? "Libre",
      destinataireId: seul?.id,
      destinataireNom: a.map((x) => x.nom).join(", "),
      destinataireContact: a.map((x) => x.contact).join("; "),
      cc: canal === "Email" ? cc.map((x) => x.contact).join("; ") : undefined,
      objet: canal === "Email" ? objet : undefined,
      contenu: canal === "Email" ? texteEmail.trim() : texte.trim(),
      contenuHtml: canal === "Email" ? html : undefined,
      piecesJointesExistantes: pieces,
      brouillonId,
    };
  };

  const enregistrer = async (silencieux = false) => {
    setOccupe("brouillon");
    try {
      const r = await enregistrerBrouillon(charge(), fichiers, brouillonId);
      setBrouillonId(r.id);
      setPieces(r.piecesJointes);
      setFichiers([]);
      modifie.current = false;
      if (!silencieux) toast.success("Brouillon enregistré.");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
      return false;
    } finally {
      setOccupe(null);
    }
  };

  const fermer = async () => {
    const contenu = a.length || objet.trim() || texte.trim() || texteEmail.trim() || fichiers.length;
    if (modifie.current && contenu) {
      if (await enregistrer(true)) { toast.success("Message enregistré dans Brouillons."); onFerme(true); }
      return;
    }
    onFerme(!!brouillonId);
  };

  const ignorer = async () => {
    if (brouillonId) await supprimerCommunication(brouillonId).catch(() => undefined);
    onFerme(!!brouillonId);
  };

  const envoyer = async () => {
    if (!a.length) { toast.error("Ajoutez au moins un destinataire."); return; }
    const invalides = [...a, ...(canal === "Email" ? cc : [])].filter((x) => !(canal === "Email" ? EMAIL_RE.test(x.contact) : TEL_RE.test(x.contact)));
    if (invalides.length) { toast.error(`Destinataire invalide : ${invalides.map((x) => x.contact).join(", ")}`); return; }
    const c = charge();
    if (!c.contenu && !(c.piecesJointesExistantes?.length || fichiers.length)) { toast.error("Le message est vide."); return; }
    if (canal === "Email" && !objet.trim() && !window.confirm("Envoyer ce message sans objet ?")) return;
    if (!c.contenu) c.contenu = "(voir pièces jointes)";
    setOccupe("envoi");
    try {
      const r = await envoyerCommunication(c, fichiers);
      toast.success(r.statut === "Envoyé" ? "Message envoyé." : "Message journalisé (fournisseur inactif — non transmis).");
      onFerme(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setOccupe(null);
    }
  };

  return (
    <div
      className={`h-full flex flex-col min-h-0 bg-card relative ${survol ? "ring-2 ring-primary ring-inset" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setSurvol(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setSurvol(false); }}
      onDrop={(e) => { e.preventDefault(); setSurvol(false); if (e.dataTransfer.files.length) ajouterFichiers(e.dataTransfer.files); }}
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); envoyer(); } }}
    >
      {/* Barre d'actions du message */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border">
        <button type="button" onClick={envoyer} disabled={!!occupe} title="Envoyer (Ctrl+Entrée)"
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60">
          {occupe === "envoi" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}Envoyer
        </button>
        <button type="button" onClick={() => inputFichier.current?.click()} aria-label="Joindre un fichier" title="Joindre un fichier"
          className="h-9 px-3 rounded-lg border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/40">
          <Paperclip className="w-4 h-4" aria-hidden /><span className="hidden sm:inline">Joindre un fichier</span>
        </button>
        <input ref={inputFichier} type="file" multiple hidden onChange={(e) => { if (e.target.files) ajouterFichiers(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => enregistrer()} disabled={!!occupe} aria-label="Enregistrer le brouillon" title="Enregistrer le brouillon"
          className="h-9 px-3 rounded-lg border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/40 disabled:opacity-60">
          {occupe === "brouillon" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}<span className="hidden sm:inline">Enregistrer</span>
        </button>
        <button type="button" onClick={ignorer} aria-label="Ignorer le message" title="Ignorer le message"
          className="h-9 px-3 rounded-lg border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/40">
          <Trash2 className="w-4 h-4" aria-hidden /><span className="hidden sm:inline">Ignorer</span>
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Canal d'envoi">
          {CANAUX.map((c) => (
            <button key={c.valeur} type="button" role="radio" aria-checked={canal === c.valeur} onClick={() => changerCanal(c.valeur)}
              className={`h-8 px-2.5 rounded-md text-[12.5px] inline-flex items-center gap-1.5 ${canal === c.valeur ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40"}`}>
              <c.icon className="w-3.5 h-3.5" aria-hidden />{c.valeur}
            </button>
          ))}
        </div>
        <button type="button" onClick={fermer} aria-label="Fermer (le message est conservé dans Brouillons)" title="Fermer"
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-secondary/40">
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 flex flex-col">
        <h2 className="text-[15px] font-semibold text-foreground pt-3 pb-1">{initial.titre}</h2>
        <div className="flex items-start">
          <div className="flex-1 min-w-0">
            <ChampDestinataires label="À" valeur={a} onChange={touche(setA)} suggestions={suggestionsCanal} canal={canal} autoFocus={!initial.a.length} />
          </div>
          {canal === "Email" && !afficherCc && (
            <button type="button" onClick={() => setAfficherCc(true)} className="text-[12.5px] text-primary hover:underline px-2 pt-3">Cc</button>
          )}
        </div>
        {canal === "Email" && afficherCc && <ChampDestinataires label="Cc" valeur={cc} onChange={touche(setCc)} suggestions={suggestionsCanal} canal={canal} />}
        {canal === "Email" && (
          <label className="flex items-center gap-2 border-b border-border py-1.5">
            <span className="text-[13px] text-muted-foreground w-10 flex-shrink-0">Objet</span>
            <input value={objet} onChange={(e) => touche(setObjet)(e.target.value)} className="flex-1 h-8 bg-transparent text-[13px] text-foreground outline-none" />
          </label>
        )}

        {(pieces.length > 0 || fichiers.length > 0) && (
          <ul className="flex flex-wrap gap-2 py-2.5" aria-label="Pièces jointes">
            {pieces.map((p) => (
              <li key={p} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background pl-2.5 pr-1 py-1.5 max-w-[260px]">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" aria-hidden />
                <a href={pieceJointeCommunicationUrl(p)} target="_blank" rel="noreferrer" className="text-[12.5px] text-foreground truncate hover:underline">{nomPieceJointe(p)}</a>
                <button type="button" aria-label={`Retirer ${nomPieceJointe(p)}`} onClick={() => { modifie.current = true; setPieces((v) => v.filter((x) => x !== p)); }}
                  className="p-1 rounded hover:bg-secondary"><X className="w-3.5 h-3.5" aria-hidden /></button>
              </li>
            ))}
            {fichiers.map((f, i) => (
              <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background pl-2.5 pr-1 py-1.5 max-w-[260px]">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" aria-hidden />
                <span className="text-[12.5px] text-foreground truncate">{f.name}</span>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{taille(f.size)}</span>
                <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setFichiers((v) => v.filter((_, j) => j !== i))}
                  className="p-1 rounded hover:bg-secondary"><X className="w-3.5 h-3.5" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        {canal !== "Email" && (pieces.length > 0 || fichiers.length > 0) && (
          <p className="text-[11.5px] text-muted-foreground -mt-1 mb-2">En {canal}, chaque pièce jointe est envoyée sous forme de lien de téléchargement.</p>
        )}

        <div className="flex-1 flex flex-col min-h-[280px] pt-3">
          {canal === "Email" ? (
            <EditeurRiche initialHtml={htmlInitial.current || (signature.email ? `<p><br></p><p><br></p><div>${signature.email}</div>` : "")}
              onChange={(h, t) => { if (editeurPret.current && h !== html) modifie.current = true; editeurPret.current = true; setHtml(h); setTexteEmail(t); }} />
          ) : (
            <>
              <textarea value={texte} onChange={(e) => touche(setTexte)(e.target.value)} aria-label="Message"
                placeholder="Votre message…" className="flex-1 min-h-[240px] w-full rounded-lg border border-border bg-background px-4 py-3 text-[14px] leading-relaxed text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
              <div className="flex items-center justify-between pt-1.5 text-[11.5px] text-muted-foreground">
                <span>{texte.length} caractère{texte.length > 1 ? "s" : ""}{canal === "SMS" ? ` · ${segmentsSms.n} SMS (${segmentsSms.par} car./SMS)` : ""}</span>
                {signature.sms && !texte.includes(signature.sms) && (
                  <button type="button" onClick={() => touche(setTexte)(`${texte.trimEnd()}\n\n${signature.sms}`)} className="text-primary hover:underline">Insérer la signature</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {survol && (
        <div className="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none">
          <p className="text-[14px] font-medium text-primary">Déposez les fichiers pour les joindre</p>
        </div>
      )}
    </div>
  );
}
