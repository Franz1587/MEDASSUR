import { useEffect, useRef, useState } from "react";
import {
  Reply, ReplyAll, Forward, MoreHorizontal, Archive, Trash2, Flag, MailOpen, Mail, FileText, Download,
  ExternalLink, Inbox, Pencil, MessageSquare, Phone, ArrowLeft, CornerDownRight, Maximize2, X,
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { nomPieceJointe, pieceJointeCommunicationUrl } from "@/services/communications.service";
import type { Communication } from "@/types/communications";

export type ModeReponse = "repondre" | "repondreTous" | "transferer";

export function expediteur(c: Communication): { nom: string; contact: string } {
  if (c.statut === "Reçu") return { nom: c.destinataireNom, contact: c.destinataireContact };
  return { nom: c.declencheur === "ARIANA" ? "Ariana — MEDASSUR+" : c.declencheur === "Manuel" ? "Vous" : `MEDASSUR+ (${c.declencheur})`, contact: "" };
}

export function initiales(nom: string): string {
  const mots = nom.replace(/[<>@.]/g, " ").trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? "?") + (mots[1]?.[0] ?? "")).toUpperCase();
}

export function dateLongue(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ICONES_CANAL = { Email: Mail, SMS: MessageSquare, WhatsApp: Phone };

function CorpsMessage({ c }: { c: Communication }) {
  if (!c.contenuHtml) {
    return <div className="px-6 py-5 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap break-words">{c.contenu}</div>;
  }
  // Cadre isolé sans scripts : le HTML d'un email externe ne peut ni exécuter de code
  // ni lire la session de l'application. Les liens s'ouvrent dans un nouvel onglet.
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a2e;margin:20px 24px;word-wrap:break-word}
img{max-width:100%;height:auto} table{max-width:100%} blockquote{border-left:2px solid #d1d5db;margin:0;padding-left:12px;color:#4b5563}
</style></head><body>${sanitizeHtml(c.contenuHtml)}</body></html>`;
  return <iframe title={`Contenu : ${c.objet ?? "message"}`} sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="w-full flex-1 min-h-[360px] bg-white rounded-b-xl border-0" />;
}

interface Props {
  c: Communication;
  fil: Communication[];
  onRetour?: () => void;
  onRepondre: (mode: ModeReponse) => void;
  onMaj: (maj: Partial<Pick<Communication, "lu" | "archive" | "supprime" | "suivi">>) => void;
  onSupprimerDefinitif: () => void;
  onModifierBrouillon: () => void;
  onOuvrir: (id: string) => void;
  onAgrandir?: () => void;
  enFenetre?: boolean;
}

export function LecteurMessage({ c, fil, onRetour, onRepondre, onMaj, onSupprimerDefinitif, onModifierBrouillon, onOuvrir, onAgrandir, enFenetre }: Props) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const clic = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, []);

  const exp = expediteur(c);
  const pieces = c.piecesJointes?.length ? c.piecesJointes : c.pieceJointe ? [c.pieceJointe] : [];
  const IconeCanal = ICONES_CANAL[c.canal];
  const brouillon = c.statut === "Brouillon";
  const contactReponse = c.destinataireContact.split(";")[0].trim();
  const sujetRe = /^re\s*:/i.test(c.objet ?? "") ? c.objet ?? "" : `Re: ${c.objet ?? ""}`;
  const autres = fil.filter((m) => m.id !== c.id);

  const actionBtn = "h-9 px-3 items-center gap-1.5 text-[13px] text-foreground hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const itemMenu = "w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-secondary/50 inline-flex items-center gap-2";

  return (
    <article className="h-full flex flex-col min-h-0" aria-label="Message">
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-2">
          {onRetour && !enFenetre && (
            <button type="button" onClick={onRetour} aria-label="Retour à la liste" className="lg:hidden h-9 w-9 -ml-2 rounded-lg inline-flex items-center justify-center text-foreground hover:bg-secondary/50">
              <ArrowLeft className="w-4 h-4" aria-hidden />
            </button>
          )}
          <h2 className={`${enFenetre ? "text-[22px]" : "text-[19px]"} font-semibold text-foreground leading-snug break-words flex-1`}>{c.objet || (c.canal === "Email" ? "(sans objet)" : `Message ${c.canal}`)}</h2>
          {onAgrandir && (
            <button type="button" onClick={onAgrandir} aria-label="Ouvrir dans une fenêtre" title="Ouvrir dans une fenêtre"
              className="hidden sm:inline-flex h-9 w-9 rounded-lg items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground">
              <Maximize2 className="w-4 h-4" aria-hidden />
            </button>
          )}
          {enFenetre && onRetour && (
            <button type="button" onClick={onRetour} aria-label="Fermer la fenêtre" title="Fermer (Échap)"
              className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground">
              <X className="w-5 h-5" aria-hidden />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground text-[16px] font-semibold flex items-center justify-center flex-shrink-0" aria-hidden>
            {initiales(exp.nom)}
          </div>
          <div className="flex-1 min-w-[200px] text-[13px]">
            <p className="text-foreground">
              <span className="text-[15px]">{exp.nom}</span>
              {exp.contact && <span className="text-muted-foreground"> &lt;{exp.contact}&gt;</span>}
            </p>
            {c.statut !== "Reçu" && (
              <p className="text-muted-foreground mt-0.5 break-words"><span className="mr-1.5">À</span><span className="text-foreground">{c.destinataireContact}</span></p>
            )}
            {c.cc && <p className="text-muted-foreground mt-0.5 break-words"><span className="mr-1.5">Cc</span><span className="text-foreground">{c.cc}</span></p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><IconeCanal className="w-3.5 h-3.5" aria-hidden />{c.canal}</span>
              {c.statut !== "Reçu" && c.statut !== "Envoyé" && <Badge variant={c.statut === "Simulé" ? "warning" : c.statut === "Brouillon" ? "neutral" : "danger"}>{c.statut === "Simulé" ? "Non transmis (simulé)" : c.statut}</Badge>}
              {c.suivi && <span className="inline-flex items-center gap-1 text-[11.5px] text-red-600 dark:text-red-400"><Flag className="w-3.5 h-3.5" aria-hidden />Suivi</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {brouillon ? (
              <div className="flex gap-2">
                <button type="button" onClick={onModifierBrouillon} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" aria-hidden />Continuer</button>
                <button type="button" onClick={onSupprimerDefinitif} className="h-9 px-3 rounded-lg border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/50"><Trash2 className="w-4 h-4" aria-hidden />Supprimer</button>
              </div>
            ) : (
              <div className="flex items-stretch rounded-lg border border-border overflow-visible">
                <button type="button" onClick={() => onRepondre("repondre")} className={`${actionBtn} inline-flex rounded-l-lg`}><Reply className="w-4 h-4 text-primary" aria-hidden />Répondre</button>
                {c.canal === "Email" && (
                  <button type="button" onClick={() => onRepondre("repondreTous")} className={`${actionBtn} border-l border-border hidden sm:inline-flex`}><ReplyAll className="w-4 h-4 text-primary" aria-hidden />Répondre à tous</button>
                )}
                <button type="button" onClick={() => onRepondre("transferer")} className={`${actionBtn} inline-flex border-l border-border`}><Forward className="w-4 h-4 text-primary" aria-hidden />Transférer</button>
                <div className="relative border-l border-border" ref={menuRef}>
                  <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Plus d'actions" aria-expanded={menu} aria-haspopup="menu" className={`${actionBtn} inline-flex h-full rounded-r-lg`}>
                    <MoreHorizontal className="w-4 h-4" aria-hidden />
                  </button>
                  {menu && (
                    <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-64 rounded-lg border border-border bg-card shadow-xl py-1" onClick={() => setMenu(false)}>
                      {c.canal === "Email" && (
                        <button role="menuitem" type="button" onClick={() => onRepondre("repondreTous")} className={`${itemMenu} sm:hidden`}><ReplyAll className="w-4 h-4" aria-hidden />Répondre à tous</button>
                      )}
                      <button role="menuitem" type="button" onClick={() => onMaj({ lu: !c.lu })} className={itemMenu}>{c.lu ? <Mail className="w-4 h-4" aria-hidden /> : <MailOpen className="w-4 h-4" aria-hidden />}{c.lu ? "Marquer comme non lu" : "Marquer comme lu"}</button>
                      <button role="menuitem" type="button" onClick={() => onMaj({ suivi: !c.suivi })} className={itemMenu}><Flag className="w-4 h-4" aria-hidden />{c.suivi ? "Retirer le suivi" : "Assurer un suivi"}</button>
                      {c.supprime || c.archive ? (
                        <button role="menuitem" type="button" onClick={() => onMaj({ supprime: false, archive: false })} className={itemMenu}><Inbox className="w-4 h-4" aria-hidden />Restaurer dans son dossier</button>
                      ) : (
                        <button role="menuitem" type="button" onClick={() => onMaj({ archive: true })} className={itemMenu}><Archive className="w-4 h-4" aria-hidden />Archiver</button>
                      )}
                      {c.supprime ? (
                        <button role="menuitem" type="button" onClick={onSupprimerDefinitif} className={`${itemMenu} text-red-600 dark:text-red-400`}><Trash2 className="w-4 h-4" aria-hidden />Supprimer définitivement</button>
                      ) : (
                        <button role="menuitem" type="button" onClick={() => onMaj({ supprime: true })} className={itemMenu}><Trash2 className="w-4 h-4" aria-hidden />Supprimer</button>
                      )}
                      {c.canal === "Email" && contactReponse.includes("@") && (
                        <>
                          <div className="my-1 border-t border-border" />
                          <a role="menuitem" href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contactReponse)}&su=${encodeURIComponent(sujetRe)}`} target="_blank" rel="noreferrer" className={itemMenu}><ExternalLink className="w-4 h-4" aria-hidden />Répondre depuis Gmail</a>
                          <a role="menuitem" href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(contactReponse)}&subject=${encodeURIComponent(sujetRe)}`} target="_blank" rel="noreferrer" className={itemMenu}><ExternalLink className="w-4 h-4" aria-hidden />Répondre depuis Outlook</a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <time dateTime={c.createdAt} className="text-[12px] text-muted-foreground">{dateLongue(c.createdAt)}</time>
          </div>
        </div>

        {pieces.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Pièces jointes">
            {pieces.map((p) => (
              <li key={p}>
                <a href={pieceJointeCommunicationUrl(p)} target="_blank" rel="noreferrer"
                  className="group inline-flex items-center gap-2.5 rounded-lg border border-border bg-background pl-2.5 pr-3 py-2 max-w-[300px] hover:border-primary/50 hover:bg-primary/5">
                  <FileText className="w-5 h-5 text-red-600 flex-shrink-0" aria-hidden />
                  <span className="text-[12.5px] text-foreground truncate">{nomPieceJointe(p)}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-secondary/20 p-4">
        <div className={`${enFenetre ? "max-w-[1080px]" : "max-w-[880px]"} mx-auto bg-card rounded-xl border border-border shadow-sm flex flex-col min-h-full`}>
          <CorpsMessage c={c} />
          {c.retour && (
            <div className="mx-6 mb-5 mt-1 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
              <p className="text-[12px] font-semibold text-green-700 dark:text-green-400 mb-1">Réponse reçue{c.retourDate ? ` le ${new Date(c.retourDate).toLocaleDateString("fr-FR")}` : ""}</p>
              <p className="text-[13px] text-foreground whitespace-pre-wrap">{c.retour}</p>
            </div>
          )}
        </div>

        {autres.length > 0 && (
          <section className="max-w-[880px] mx-auto mt-4" aria-label="Conversation">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dans cette conversation ({autres.length + 1} messages)</h3>
            <ul className="space-y-1.5">
              {autres.map((m) => {
                const e = expediteur(m);
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => onOuvrir(m.id)}
                      className="w-full text-left rounded-lg border border-border bg-card px-3.5 py-2.5 hover:border-primary/40 flex items-start gap-2.5">
                      <CornerDownRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground truncate">{e.nom}</span>
                          <span className="text-[11.5px] text-muted-foreground flex-shrink-0">{dateLongue(m.createdAt)}</span>
                        </span>
                        <span className="block text-[12.5px] text-muted-foreground truncate">{m.contenu}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
