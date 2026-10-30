import { useEffect, useMemo, useState } from "react";
import { Archive, FileSignature, Brain, CheckCircle, Trash2, RefreshCw, BarChart2, X, CheckCheck, AlertTriangle, Clock, Eye, Search, Pencil, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { Combobox } from "@/components/shared/Combobox";
import { useSimulatedProcessing } from "@/components/shared/useSimulatedProcessing";
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
                  <Badge variant={rapport.facture.statut === "Soumise" ? "success" : "neutral"}>{rapport.facture.statut}</Badge>
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

          {/* Résumé complet de l'IA */}
          {doc.resume && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Contenu lu par l'IA</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{doc.resume}</p>
            </div>
          )}

          {/* Prestataire + Traitement */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Prestataire / Émetteur
                {doc.nomEmetteurExtrait && !doc.prestataire?.nom && !doc.entiteLiee && !editMode && (
                  <span className="ml-1 text-primary text-[10px]">(lu par l'IA)</span>
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
                    <p className="text-xs text-muted-foreground">IA : {doc.nomEmetteurExtrait}</p>
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

export default function GedView() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [rapportDocId, setRapportDocId] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<GedDocument | null>(null);
  const { status, result, run, reset } = useSimulatedProcessing<GedDocument>();
  const [fichierChoisi, setFichierChoisi] = useState<File | null>(null);
  const [sens, setSens] = useState<"Entrant" | "Sortant">("Entrant");
  const [prestataireChoisi, setPrestataireChoisi] = useState<Prestataire | null>(null);
  const [entiteLiee, setEntiteLiee] = useState("");
  const [dateCachetManuelle, setDateCachetManuelle] = useState("");

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
    const f = files[0];
    if (!f) return;
    setFichierChoisi(f);
    reset();
  };

  const handleAnalyser = () => {
    if (!fichierChoisi) return;
    // "2026-10-30" → "30/10/2026" pour cohérence avec le format extrait par l'IA
    const cachet = dateCachetManuelle ? dateCachetManuelle.split("-").reverse().join("/") : undefined;
    run(() => uploadDocument({
      fichier: fichierChoisi, sens, prestataireId: prestataireChoisi?.id, entiteLiee: entiteLiee.trim() || undefined,
      dateCachetManuelle: cachet,
    }).then((doc) => { refresh(); return doc; }));
  };

  const handleNouveauDocument = () => {
    reset();
    setFichierChoisi(null);
    setPrestataireChoisi(null);
    setEntiteLiee("");
    setDateCachetManuelle("");
    setSens("Entrant");
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
      <ModuleHeader title="GED & Documents" subtitle="Archivage entrant/sortant, lecture automatique par IA et rapprochement facture" icon={Archive} />

      {!fichierChoisi && (
        <UploadDropzone
          onFiles={handleFiles}
          label="Glissez vos documents ici"
          hint="Factures et courriers prestataires, contrats, pièces d'identité · Lecture automatique par IA"
          accept="image/*,.pdf"
        />
      )}

      {fichierChoisi && status !== "done" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm text-foreground font-semibold">{fichierChoisi.name}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Sens du document</div>
              <select value={sens} onChange={(e) => setSens(e.target.value as "Entrant" | "Sortant")} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground">
                <option value="Entrant">Entrant (reçu)</option>
                <option value="Sortant">Sortant (envoyé)</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Prestataire (facture/courrier lié)</div>
              <Combobox
                options={prestataires}
                value={prestataireChoisi}
                onChange={setPrestataireChoisi}
                getLabel={(pr) => pr.nom} getSubLabel={(pr) => pr.ville} getId={(pr) => pr.id}
                placeholder="Rechercher…"
              />
            </label>
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Entité liée (facultatif)</div>
              <input
                value={entiteLiee}
                onChange={(e) => setEntiteLiee(e.target.value)}
                placeholder="Client, contrat…"
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"
              />
            </label>
            {sens === "Entrant" && (
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">Date de réception / cachet (facultatif)</div>
                <input
                  type="date"
                  value={dateCachetManuelle}
                  onChange={(e) => setDateCachetManuelle(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"
                />
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={status === "processing"} onClick={handleAnalyser} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">
              {status === "processing" ? "Analyse en cours…" : "Analyser et enregistrer"}
            </button>
            <button type="button" onClick={handleNouveauDocument} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          </div>
          {status === "processing" && (
            <div className="flex items-center gap-3">
              <div className="relative w-6 h-6 flex-shrink-0">
                <div className="w-6 h-6 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Lecture du contenu par l'IA (OCR, objet, résumé, rapprochement facture)…</p>
            </div>
          )}
        </div>
      )}

      {status === "done" && result && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-foreground">Document enregistré dans la GED :</span>
              <Badge variant="gold">{result.type}</Badge>
              <Badge variant={statutOcrVariant[result.statutOcr] ?? "neutral"}>{result.statutOcr}</Badge>
            </div>
          </div>
          {result.objet && <p className="text-sm text-foreground"><span className="font-semibold">Objet :</span> {result.objet}</p>}
          {result.referenceExtraite && (
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Référence :</span> {result.referenceExtraite}</p>
          )}
          {result.montantExtrait != null && (
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Montant lu :</span> <span className="med-num">{fmtM(Number(result.montantExtrait))} FCFA</span></p>
          )}
          {result.dateCachet && (
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Date cachet :</span> <span className="med-num">{result.dateCachet}</span></p>
          )}
          {result.resume && <p className="text-sm text-muted-foreground">{result.resume}</p>}
          {result.statutOcr === "Échec" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">Contenu non lisible par l'IA — format non supporté ou fichier illisible. Le document reste archivé, sans objet/résumé automatique.</p>
          )}
          <button type="button" onClick={handleNouveauDocument} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Importer un autre document</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">
              Documents archivés ({filtresActifs ? `${documentsFiltres.length} sur ${documents.length}` : documents.length})
            </h3>
            {filtresActifs && (
              <button type="button" onClick={() => { setRecherche(""); setPrestataireFiltre(null); setDu(""); setAu(""); }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Réinitialiser les filtres
              </button>
            )}
          </div>

          {/* Filtres de recherche */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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

        <table className="w-full text-sm">
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
                      <a href={urlDocumentGed(d.fichier)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary med-num">
                        {d.nom}<ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
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
                    ? <span title={d.nomEmetteurExtrait && !d.prestataire?.nom && !d.entiteLiee ? "Lu par l'IA" : undefined}>
                        {d.prestataire?.nom || d.entiteLiee || d.nomEmetteurExtrait}
                        {d.nomEmetteurExtrait && !d.prestataire?.nom && !d.entiteLiee && (
                          <span className="ml-1 text-[10px] text-primary opacity-70">(IA)</span>
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
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
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
