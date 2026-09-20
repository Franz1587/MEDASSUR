import { useEffect, useState } from "react";
import { Archive, FileSignature, Brain, CheckCircle, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { Combobox } from "@/components/shared/Combobox";
import { useSimulatedProcessing } from "@/components/shared/useSimulatedProcessing";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getDocuments, uploadDocument, deleteDocument, rapprocherDocument, urlDocumentGed } from "@/services/ged.service";
import { getPrestataires } from "@/services/prestataires.service";
import { fmt } from "@/lib/format";
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

export default function GedView() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const { status, result, run, reset } = useSimulatedProcessing<GedDocument>();
  const [fichierChoisi, setFichierChoisi] = useState<File | null>(null);
  const [sens, setSens] = useState<"Entrant" | "Sortant">("Entrant");
  const [prestataireChoisi, setPrestataireChoisi] = useState<Prestataire | null>(null);
  const [entiteLiee, setEntiteLiee] = useState("");
  const pagination = usePagination(documents);

  const refresh = () => getDocuments().then(setDocuments);

  useEffect(() => {
    refresh();
    getPrestataires().then(setPrestataires);
  }, []);

  const handleFiles = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFichierChoisi(f);
    reset();
  };

  const handleAnalyser = () => {
    if (!fichierChoisi) return;
    run(() => uploadDocument({
      fichier: fichierChoisi, sens, prestataireId: prestataireChoisi?.id, entiteLiee: entiteLiee.trim() || undefined,
    }).then((doc) => { refresh(); return doc; }));
  };

  const handleNouveauDocument = () => {
    reset();
    setFichierChoisi(null);
    setPrestataireChoisi(null);
    setEntiteLiee("");
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
          {result.resume && <p className="text-sm text-muted-foreground">{result.resume}</p>}
          {result.statutOcr === "Échec" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">Contenu non lisible par l'IA — format non supporté ou fichier illisible. Le document reste archivé, sans objet/résumé automatique.</p>
          )}
          <button type="button" onClick={handleNouveauDocument} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Importer un autre document</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Documents archivés ({documents.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Document", "Sens", "Type", "Objet", "Entité liée", "OCR", "Facture", "Signature", "Date", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap med-num">
                  {d.fichier ? (
                    <a href={urlDocumentGed(d.fichier)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                      {d.nom}<ExternalLink className="w-3 h-3" />
                    </a>
                  ) : d.nom}
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={d.sens === "Entrant" ? "info" : "neutral"}>{d.sens}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.type}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-[260px] truncate" title={d.objet ?? undefined}>{d.objet ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.entiteLiee || d.prestataire?.nom || "—"}</td>
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
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">{d.date}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button type="button" onClick={() => handleDelete(d)} className="h-7 w-7 flex items-center justify-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </div>
  );
}
