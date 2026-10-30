import { useEffect, useMemo, useState } from "react";
import { Archive, FileSignature, Brain, CheckCircle, Trash2, RefreshCw, BarChart2, X, CheckCheck, AlertTriangle, Clock, Eye, Search, Pencil, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { Combobox } from "@/components/shared/Combobox";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getDocuments, uploadDocument, deleteDocument, rapprocherDocument, updateDocument, ouvrirDocumentGed, getRapportLiaison, type RapportLiaisonGed } from "@/services/ged.service";
import { getPrestataires } from "@/services/prestataires.service";
import { fmt, fmtM } from "@/lib/format";
import { messageErreur } from "@/lib/http";
import type { GedDocument } from "@/types/ged";
import type { Prestataire } from "@/types/prestataires";

const statutOcrVariant: Record<string, BadgeVariant> = {
  "Analysé": "success", "En attente": "warning", "Échec": "danger",
};
const statutSignatureVariant: Record<string, BadgeVariant> = {
  "Signé": "success", "En attente": "warning", "N/A": "neutral",
};
const statutTraitementVariant: Record<string, BadgeVariant> = {
  "Sans objet": "neutral", "Non traité": "warning", "Traité partiellement": "info", "Traité totalement": "success",
};

// "30/10/2026" → "2026-10-30" pour comparer avec les inputs type="date"
function dateVersISO(d: string): string {
  const [j, m, a] = d.split("/");
  return `${a}-${m?.padStart(2, "0")}-${j?.padStart(2, "0")}`;
}

function RapportLiaisonModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [rapport, setRapport] = useState<RapportLiaisonGed | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getRapportLiaison(docId)
      .then(setRapport)
      .catch((e) => setErreur(messageErreur(e, "Impossible de charger le rapport.")))
      .finally(() => setLoading(false));
  }, [docId]);

  const iconeStatut = (s: string) => {
    if (s === "Traité totalement") return <CheckCheck className="w-4 h-4 text-green-600" />;
    if (s === "Traité partiellement") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    if (s === "Non traité") return <Clock className="w-4 h-4 text-muted-foreground" />;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg space-y-4 p-6 relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 h-7 w-7 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground"><X className="w-4 h-4" /></button>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground text-base">Rapport de liaison GED</h2>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        {rapport && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {iconeStatut(rapport.statutTraitement)}
              <Badge variant={statutTraitementVariant[rapport.statutTraitement] ?? "neutral"}>{rapport.statutTraitement}</Badge>
              <span className="text-xs text-muted-foreground">{rapport.type}</span>
            </div>
            {rapport.facture ? (
              <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Facture liée</p>
                <p className="text-sm text-foreground font-mono">{rapport.facture.referenceFacture}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Reçue le {rapport.facture.dateReception}</span>
                  <Badge variant={rapport.facture.statut === "Payée" ? "gold" : rapport.facture.statut === "Soumise" ? "success" : "neutral"}>{rapport.facture.statut}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground med-num">
                  <span>Montant saisi : <strong className="text-foreground">{fmt(rapport.facture.montantSaisi)}</strong></span>
                  {rapport.facture.montantExtrait != null && (
                    <span>Montant lu sur doc. : <strong className="text-foreground">{fmt(rapport.facture.montantExtrait)}</strong></span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune facture liée dans le système.</p>
            )}
            {rapport.bordereaux.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Règlement maladie (bordereaux)</p>
                {rapport.bordereaux.map((b) => (
                  <div key={b.id} className="bg-secondary/30 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-mono text-foreground">{b.numero}</p>
                      {b.datePaiement && <p className="text-xs text-muted-foreground">Payé le {b.datePaiement}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm med-num text-foreground">{fmt(b.montantTotal)}</span>
                      <Badge variant={b.statut === "Payé" ? "success" : b.statut === "Validé" ? "info" : "warning"}>{b.statut}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rapport.lettresCheque.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Règlement comptable (chèques)</p>
                {rapport.lettresCheque.map((lc) => (
                  <div key={lc.id} className="bg-green-500/8 border border-green-500/20 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-mono text-foreground">{lc.numero}</p>
                      <p className="text-xs text-muted-foreground">Chèque n°{lc.numeroCheque} · émis le {lc.dateEmission}</p>
                    </div>
                    <span className="text-sm med-num text-foreground">{fmt(lc.montantTotal)}</span>
                  </div>
                ))}
              </div>
            )}
            {rapport.bordereaux.length === 0 && rapport.facture && (
              <p className="text-xs text-muted-foreground">Aucun bordereau de règlement trouvé pour cette facture.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// "DD/MM/YYYY" → "YYYY-MM-DD" pour un input type="date"
function dateFRversISO(d: string | null | undefined): string {
  if (!d) return "";
  const [j, m, a] = d.split("/");
  return a && m && j ? `${a}-${m.padStart(2, "0")}-${j.padStart(2, "0")}` : "";
}

function DetailDocumentModal({ doc: docInitial, onClose, onRapport, onRapprocher, prestataires, onUpdated }: {
  doc: GedDocument; onClose: () => void;
  onRapport: () => void; onRapprocher: () => void;
  prestataires: Prestataire[];
  onUpdated: (doc: GedDocument) => void;
}) {
  const [doc, setDoc] = useState(docInitial);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [prestataireEdit, setPrestataireEdit] = useState<Prestataire | null>(
    () => prestataires.find((p) => p.id === docInitial.prestataireId) ?? null
  );
  const [entiteLieeEdit, setEntiteLieeEdit] = useState(docInitial.entiteLiee || "");
  const [dateCachetEdit, setDateCachetEdit] = useState(() => dateFRversISO(docInitial.dateCachet));

  const handleOuvrir = async () => {
    if (!doc.fichier) return;
    setOpening(true);
    try {
      await ouvrirDocumentGed(doc.id, doc.nom);
    } catch {
      toast.error("Impossible d'ouvrir le document — vérifiez que le fichier est disponible.");
    } finally {
      setOpening(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cachet = dateCachetEdit ? dateCachetEdit.split("-").reverse().join("/") : null;
      const updated = await updateDocument(doc.id, {
        prestataireId: prestataireEdit?.id ?? null,
        entiteLiee: entiteLieeEdit.trim(),
        dateCachet: cachet,
      });
      setDoc(updated);
      onUpdated(updated);
      setEditMode(false);
      toast.success("Document mis à jour.");
    } catch (err) {
      toast.error(messageErreur(err, "Mise à jour impossible."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPrestataireEdit(prestataires.find((p) => p.id === doc.prestataireId) ?? null);
    setEntiteLieeEdit(doc.entiteLiee || "");
    setDateCachetEdit(dateFRversISO(doc.dateCachet));
    setEditMode(false);
  };

  const inputCls = "w-full border border-border rounded-lg px-3 py-1.5 bg-background text-[13px] text-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="gold">{doc.type}</Badge>
              <Badge variant={doc.sens === "Entrant" ? "info" : "neutral"}>{doc.sens}</Badge>
              <Badge variant={statutOcrVariant[doc.statutOcr] ?? "neutral"}>{doc.statutOcr}</Badge>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{doc.nom}</p>
            <p className="text-xs text-muted-foreground med-num">ID : {doc.id} · Archivé le {doc.date}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!editMode && (
              <button type="button" onClick={() => setEditMode(true)} title="Modifier"
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground hover:text-primary">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Signature ARIANA */}
          {doc.statutOcr !== "En attente" && (
            <div className={`rounded-xl p-3 border ${doc.statutOcr === "Analysé" ? "bg-primary/5 border-primary/25" : "bg-destructive/5 border-destructive/20"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${doc.statutOcr === "Analysé" ? "bg-primary/20" : "bg-destructive/15"}`}>
                  <Brain className={`w-4 h-4 ${doc.statutOcr === "Analysé" ? "text-primary" : "text-destructive"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-primary uppercase tracking-[0.15em] leading-none">ARIANA</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Agent d'Analyse IA · {doc.statutOcr === "Analysé" ? `Analysé le ${doc.date}` : `Échec · ${doc.date}`}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${doc.statutOcr === "Analysé" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {doc.statutOcr === "Analysé" ? "✓ Signé" : "✗ Échec"}
                </span>
              </div>
              {doc.statutOcr === "Analysé" && (doc.type || doc.referenceExtraite || doc.montantExtrait != null || doc.nomEmetteurExtrait) && (
                <div className="mt-2 pt-2 border-t border-primary/15 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {doc.type && <p className="text-[11px] text-muted-foreground">Type : <strong className="text-foreground">{doc.type}</strong></p>}
                  {doc.referenceExtraite && <p className="text-[11px] text-muted-foreground med-num">Réf. : <strong className="text-foreground">{doc.referenceExtraite}</strong></p>}
                  {doc.montantExtrait != null && <p className="text-[11px] text-muted-foreground med-num">Montant : <strong className="text-foreground">{fmtM(Number(doc.montantExtrait))} FCFA</strong></p>}
                  {doc.nomEmetteurExtrait && <p className="text-[11px] text-muted-foreground">Émetteur : <span className="text-foreground">{doc.nomEmetteurExtrait}</span></p>}
                </div>
              )}
            </div>
          )}

          {/* Référence, montant et date cachet */}
          <div className="bg-secondary/20 rounded-xl p-4 grid grid-cols-2 gap-3">
            {doc.referenceExtraite && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Référence extraite</p>
                <p className="text-sm font-semibold text-foreground med-num">{doc.referenceExtraite}</p>
              </div>
            )}
            {doc.montantExtrait != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Montant lu sur document</p>
                <p className="text-sm font-semibold text-foreground med-num">{fmtM(Number(doc.montantExtrait))} FCFA</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Date de réception / cachet</p>
              {editMode ? (
                <input type="date" value={dateCachetEdit} onChange={(e) => setDateCachetEdit(e.target.value)} className={inputCls} />
              ) : (
                <p className={`text-sm font-semibold med-num ${doc.dateCachet ? "text-primary" : "text-muted-foreground"}`}>
                  {doc.dateCachet || "—"}
                </p>
              )}
            </div>
          </div>

          {/* Objet */}
          {doc.objet && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Objet</p>
              <p className="text-sm text-foreground">{doc.objet}</p>
            </div>
          )}

          {/* Résumé complet d'ARIANA */}
          {doc.resume && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Contenu lu par ARIANA</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{doc.resume}</p>
            </div>
          )}

          {/* Prestataire + Traitement */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Prestataire / Émetteur
                {doc.nomEmetteurExtrait && !doc.prestataire?.nom && !doc.entiteLiee && !editMode && (
                  <span className="ml-1 text-primary text-[10px]">(ARIANA)</span>
                )}
              </p>
              {editMode ? (
                <Combobox
                  options={prestataires}
                  value={prestataireEdit}
                  onChange={setPrestataireEdit}
                  getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                  placeholder="Rechercher un prestataire…"
                />
              ) : (
                <>
                  <p className="text-sm text-foreground">{doc.prestataire?.nom || doc.entiteLiee || doc.nomEmetteurExtrait || "—"}</p>
                  {doc.nomEmetteurExtrait && (doc.prestataire?.nom || doc.entiteLiee) && (
                    <p className="text-xs text-muted-foreground">ARIANA : {doc.nomEmetteurExtrait}</p>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Entité liée</p>
              {editMode ? (
                <input value={entiteLieeEdit} onChange={(e) => setEntiteLieeEdit(e.target.value)} placeholder="Client, contrat…" className={inputCls} />
              ) : (
                <p className="text-sm text-foreground">{doc.entiteLiee || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Statut traitement</p>
              <Badge variant={statutTraitementVariant[doc.statutTraitement] ?? "neutral"}>{doc.statutTraitement}</Badge>
            </div>
            {doc.facture && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Facture liée</p>
                <p className="text-sm text-foreground med-num">{doc.facture.referenceFacture}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Signature</p>
              <Badge variant={statutSignatureVariant[doc.statutSignature] ?? "neutral"}>{doc.statutSignature}</Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
            {editMode ? (
              <>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />{saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button type="button" onClick={handleCancelEdit}
                  className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" />Annuler
                </button>
              </>
            ) : (
              <>
                {doc.fichier && (
                  <button type="button" onClick={handleOuvrir} disabled={opening}
                    className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 disabled:opacity-60">
                    <FileText className="w-3.5 h-3.5" />{opening ? "Chargement…" : "Ouvrir le document"}
                  </button>
                )}
                {doc.factureId && (
                  <button type="button" onClick={onRapport}
                    className="h-9 px-4 rounded-lg border border-primary/30 text-primary text-[13px] hover:bg-primary/10 inline-flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />Rapport de liaison
                  </button>
                )}
                {doc.type === "Facture prestataire" && (
                  <button type="button" onClick={onRapprocher}
                    className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />Relancer le rapprochement
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JournalAriana({ documents }: { documents: GedDocument[] }) {
  if (documents.length === 0) return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      ARIANA n'a effectué aucune action pour le moment.
    </div>
  );
  return (
    <div className="divide-y divide-border">
      {documents.map((doc, i) => (
        <div key={doc.id} className="px-4 py-4 flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${doc.statutOcr === "Analysé" ? "bg-primary/15" : doc.statutOcr === "Échec" ? "bg-destructive/10" : "bg-secondary/40"}`}>
              <Brain className={`w-4 h-4 ${doc.statutOcr === "Analysé" ? "text-primary" : doc.statutOcr === "Échec" ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            {i < documents.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-black text-primary uppercase tracking-[0.15em]">ARIANA</span>
              <span className="text-[10px] text-muted-foreground med-num">{doc.date}</span>
              <Badge variant={statutOcrVariant[doc.statutOcr] ?? "neutral"}>{doc.statutOcr}</Badge>
              {doc.statutTraitement !== "Sans objet" && doc.statutTraitement !== "Non traité" && (
                <Badge variant={statutTraitementVariant[doc.statutTraitement] ?? "neutral"}>{doc.statutTraitement}</Badge>
              )}
            </div>
            <p className="text-sm text-foreground font-medium truncate mb-1">{doc.nom}</p>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {doc.type && <p>→ <strong className="text-foreground">{doc.type}</strong></p>}
              {doc.objet && <p className="truncate">→ {doc.objet}</p>}
              {(doc.referenceExtraite || doc.montantExtrait != null) && (
                <p className="med-num">
                  → {[doc.referenceExtraite && `Réf. ${doc.referenceExtraite}`, doc.montantExtrait != null && `${fmtM(Number(doc.montantExtrait))} FCFA`].filter(Boolean).join(" · ")}
                </p>
              )}
              {(doc.prestataire?.nom || doc.nomEmetteurExtrait) && (
                <p>→ {doc.prestataire?.nom ?? doc.nomEmetteurExtrait}</p>
              )}
              {doc.facture && (
                <p className="med-num">→ Rapprochement : Facture <strong className="text-foreground">{doc.facture.referenceFacture}</strong></p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface QueueItem {
  id: string;
  file: File;
  sens: "Entrant" | "Sortant";
  prestataire: Prestataire | null;
  entiteLiee: string;
  dateCachetManuelle: string;
  status: "waiting" | "processing" | "done" | "error";
  result?: GedDocument;
  erreur?: string;
}

function QueueItemRow({ item, prestataires, onChange, onArchiver, onRetirer }: {
  item: QueueItem;
  prestataires: Prestataire[];
  onChange: (patch: Partial<QueueItem>) => void;
  onArchiver: () => void;
  onRetirer: () => void;
}) {
  const inCls = "border border-border rounded-lg px-2.5 py-1.5 bg-background text-[12px] text-foreground w-full";

  if (item.status === "processing") return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin flex-shrink-0" />
      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground truncate flex-1">{item.file.name}</span>
      <span className="text-xs text-muted-foreground">Analyse en cours…</span>
    </div>
  );

  if (item.status === "done" && item.result) return (
    <div className="px-4 py-3 flex items-start gap-2">
      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm text-foreground font-medium truncate">{item.file.name}</span>
          <Badge variant="gold">{item.result.type}</Badge>
          <Badge variant={statutOcrVariant[item.result.statutOcr] ?? "neutral"}>{item.result.statutOcr}</Badge>
        </div>
        {(item.result.objet || item.result.referenceExtraite || item.result.montantExtrait != null) && (
          <p className="text-xs text-muted-foreground med-num">
            {[item.result.objet, item.result.referenceExtraite && `Réf. ${item.result.referenceExtraite}`, item.result.montantExtrait != null && `${fmtM(Number(item.result.montantExtrait))} FCFA`].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <button type="button" onClick={onRetirer} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (item.status === "error") return (
    <div className="px-4 py-3 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground font-medium truncate block">{item.file.name}</span>
        <p className="text-xs text-destructive">{item.erreur}</p>
      </div>
      <button type="button" onClick={onArchiver}
        className="h-7 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary/40 flex-shrink-0 whitespace-nowrap">
        Réessayer
      </button>
      <button type="button" onClick={onRetirer} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // waiting
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-foreground font-medium truncate flex-1">{item.file.name}</span>
        <button type="button" onClick={onRetirer} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-secondary/40 text-muted-foreground flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-5">
        <select value={item.sens} onChange={(e) => onChange({ sens: e.target.value as "Entrant" | "Sortant" })} className={inCls}>
          <option value="Entrant">Entrant (reçu)</option>
          <option value="Sortant">Sortant (envoyé)</option>
        </select>
        <Combobox
          options={prestataires} value={item.prestataire}
          onChange={(p) => onChange({ prestataire: p })}
          getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
          placeholder="Prestataire…" allowClear clearLabel="Aucun"
        />
        <input value={item.entiteLiee} onChange={(e) => onChange({ entiteLiee: e.target.value })}
          placeholder="Entité liée…" className={inCls} />
        {item.sens === "Entrant" && (
          <input type="date" value={item.dateCachetManuelle} onChange={(e) => onChange({ dateCachetManuelle: e.target.value })}
            className={inCls} title="Date de réception / cachet" />
        )}
      </div>
      <div className="pl-5">
        <button type="button" onClick={onArchiver}
          className="h-8 px-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 inline-flex items-center gap-1.5">
          <Brain className="w-3 h-3" />Analyser et archiver
        </button>
      </div>
    </div>
  );
}

export default function GedView() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [rapportDocId, setRapportDocId] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<GedDocument | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [vue, setVue] = useState<"documents" | "journal">("documents");

  // Filtres
  const [recherche, setRecherche] = useState("");
  const [prestataireFiltre, setPrestataireFiltre] = useState<Prestataire | null>(null);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");

  const refresh = () => getDocuments().then(setDocuments);

  useEffect(() => {
    refresh();
    getPrestataires().then(setPrestataires);
  }, []);

  const documentsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return documents.filter((d) => {
      if (prestataireFiltre && d.prestataireId !== prestataireFiltre.id) return false;
      if (du || au) {
        const iso = dateVersISO(d.date);
        if (du && iso < du) return false;
        if (au && iso > au) return false;
      }
      if (q && ![d.nom, d.objet, d.resume, d.referenceExtraite, d.entiteLiee, d.prestataire?.nom].some(
        (v) => v?.toLowerCase().includes(q),
      )) return false;
      return true;
    });
  }, [documents, recherche, prestataireFiltre, du, au]);

  const pagination = usePagination(documentsFiltres);

  const handleFiles = (files: File[]) => {
    setQueue((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        sens: "Entrant" as const,
        prestataire: null,
        entiteLiee: "",
        dateCachetManuelle: "",
        status: "waiting" as const,
      })),
    ]);
  };

  const archiver = async (item: QueueItem) => {
    setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "processing" as const } : q));
    try {
      const cachet = item.dateCachetManuelle ? item.dateCachetManuelle.split("-").reverse().join("/") : undefined;
      const doc = await uploadDocument({
        fichier: item.file, sens: item.sens, prestataireId: item.prestataire?.id,
        entiteLiee: item.entiteLiee.trim() || undefined, dateCachetManuelle: cachet,
      });
      setDocuments((prev) => [doc, ...prev]);
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "done" as const, result: doc } : q));
    } catch (err) {
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error" as const, erreur: messageErreur(err, "Archivage impossible.") } : q));
    }
  };

  const handleArchiverTout = () => {
    queue.filter((q) => q.status === "waiting").forEach(archiver);
  };

  const handleRapprocher = async (d: GedDocument) => {
    try {
      await rapprocherDocument(d.id);
      refresh();
      toast.success("Rapprochement relancé.");
    } catch (err) {
      toast.error(messageErreur(err, "Rapprochement impossible."));
    }
  };

  const handleDelete = async (d: GedDocument) => {
    const ok = window.confirm(`Supprimer le document ${d.nom} ?`);
    if (!ok) return;
    try {
      await deleteDocument(d.id);
      refresh();
      toast.success("Document supprimé.");
    } catch (err) {
      toast.error(messageErreur(err, "Suppression impossible."));
    }
  };

  const filtresActifs = recherche || prestataireFiltre || du || au;

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="GED & Documents" subtitle="Archivage entrant/sortant, lecture automatique par ARIANA et rapprochement facture" icon={Archive} />

      <UploadDropzone
        onFiles={handleFiles}
        label="Glissez vos documents ici"
        hint="Sélectionnez plusieurs fichiers à la fois · Factures, courriers, contrats · Lecture automatique par ARIANA"
        accept="image/*,.pdf"
        multiple
      />

      {queue.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <Archive className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">
              File d'attente — {queue.length} fichier{queue.length > 1 ? "s" : ""}
            </h3>
            <div className="ml-auto flex items-center gap-2">
              {queue.some((q) => q.status === "waiting") && (
                <button type="button" onClick={handleArchiverTout}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  Archiver tout ({queue.filter((q) => q.status === "waiting").length} en attente)
                </button>
              )}
              <button type="button" onClick={() => setQueue([])}
                className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary/40">
                Vider
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {queue.map((item) => (
              <QueueItemRow
                key={item.id}
                item={item}
                prestataires={prestataires}
                onChange={(patch) => setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, ...patch } : q))}
                onArchiver={() => archiver(item)}
                onRetirer={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">
              {vue === "documents"
                ? `Documents archivés (${filtresActifs ? `${documentsFiltres.length} sur ${documents.length}` : documents.length})`
                : `Journal ARIANA (${documents.length} action${documents.length !== 1 ? "s" : ""})`}
            </h3>
            {filtresActifs && vue === "documents" && (
              <button type="button" onClick={() => { setRecherche(""); setPrestataireFiltre(null); setDu(""); setAu(""); }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Réinitialiser les filtres
              </button>
            )}
            <div className="ml-auto flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
              {(["documents", "journal"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVue(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${vue === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {v === "documents" ? "Archives" : "Journal ARIANA"}
                </button>
              ))}
            </div>
          </div>

          {/* Filtres de recherche */}
          <div className={`grid grid-cols-1 md:grid-cols-4 gap-2${vue !== "documents" ? " hidden" : ""}`}>
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher par nom, réf., patient, objet, résumé…"
                className="w-full border border-border rounded-lg pl-8 pr-3 py-1.5 bg-background text-[13px] text-foreground"
              />
            </div>
            <Combobox
              options={prestataires}
              value={prestataireFiltre}
              onChange={setPrestataireFiltre}
              getLabel={(pr) => pr.nom} getSubLabel={(pr) => pr.ville} getId={(pr) => pr.id}
              placeholder="Prestataire…"
              allowClear clearLabel="Tous"
            />
            <div className="flex items-center gap-1">
              <input type="date" value={du} onChange={(e) => setDu(e.target.value)}
                className="flex-1 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground" title="Date de début" />
              <span className="text-muted-foreground text-xs">→</span>
              <input type="date" value={au} onChange={(e) => setAu(e.target.value)}
                className="flex-1 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground" title="Date de fin" />
            </div>
          </div>
        </div>

        <table className={`w-full text-sm${vue !== "documents" ? " hidden" : ""}`}>
          <thead>
            <tr className="border-b border-border">
              {["Document / Réf.", "Sens", "Type", "Objet", "Prestataire", "OCR", "Facture", "Signature", "Archivé le", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 min-w-[160px]">
                  <div className="flex flex-col gap-0.5">
                    {d.fichier ? (
                      <button type="button" onClick={() => ouvrirDocumentGed(d.id, d.nom).catch(() => toast.error("Impossible d'ouvrir le document."))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary med-num text-left">
                        {d.nom}<FileText className="w-3 h-3 flex-shrink-0" />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-foreground med-num">{d.nom}</span>
                    )}
                    {d.referenceExtraite && (
                      <span className="text-[11px] text-primary med-num">Réf. {d.referenceExtraite}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={d.sens === "Entrant" ? "info" : "neutral"}>{d.sens}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{d.type}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={d.objet ?? undefined}>{d.objet ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {d.prestataire?.nom || d.entiteLiee || d.nomEmetteurExtrait
                    ? <span title={d.nomEmetteurExtrait && !d.prestataire?.nom && !d.entiteLiee ? "Lu par ARIANA" : undefined}>
                        {d.prestataire?.nom || d.entiteLiee || d.nomEmetteurExtrait}
                        {d.nomEmetteurExtrait && !d.prestataire?.nom && !d.entiteLiee && (
                          <span className="ml-1 text-[10px] text-primary opacity-70">(ARIANA)</span>
                        )}
                      </span>
                    : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutOcrVariant[d.statutOcr] ?? "neutral"}>{d.statutOcr}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Badge variant={statutTraitementVariant[d.statutTraitement] ?? "neutral"}>{d.statutTraitement}</Badge>
                    {d.montantExtrait != null && <span className="text-xs text-muted-foreground med-num">{fmt(Number(d.montantExtrait))}</span>}
                    {d.type === "Facture prestataire" && (
                      <button type="button" onClick={() => handleRapprocher(d)} title="Relancer le rapprochement" className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10">
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {d.statutSignature !== "N/A" && <FileSignature className="w-3 h-3 text-muted-foreground" />}
                    <Badge variant={statutSignatureVariant[d.statutSignature] ?? "neutral"}>{d.statutSignature}</Badge>
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">
                  <div className="flex flex-col gap-0.5">
                    <span>{d.date}</span>
                    {d.dateCachet && <span className="text-[11px] text-primary">↩ {d.dateCachet}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setDetailDoc(d)} title="Voir le détail"
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {d.factureId && (
                      <button type="button" onClick={() => setRapportDocId(d.id)} title="Rapport de liaison"
                        className="h-7 w-7 flex items-center justify-center rounded-lg border border-primary/30 text-primary hover:bg-primary/10">
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(d)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {filtresActifs ? "Aucun document ne correspond aux filtres." : "Aucun document archivé."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {vue === "documents" && (
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        )}
        {vue === "journal" && <JournalAriana documents={documents} />}
      </div>

      {rapportDocId && <RapportLiaisonModal docId={rapportDocId} onClose={() => setRapportDocId(null)} />}
      {detailDoc && (
        <DetailDocumentModal
          doc={detailDoc}
          onClose={() => setDetailDoc(null)}
          onRapport={() => { setDetailDoc(null); setRapportDocId(detailDoc.id); }}
          onRapprocher={async () => { setDetailDoc(null); await handleRapprocher(detailDoc); }}
          prestataires={prestataires}
          onUpdated={(updated) => {
            setDocuments((prev) => prev.map((d) => d.id === updated.id ? updated : d));
            setDetailDoc(updated);
          }}
        />
      )}
    </div>
  );
}
