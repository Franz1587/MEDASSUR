import { useEffect, useState } from "react";
import { Archive, FileSignature, Brain, Tag, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { useSimulatedProcessing } from "@/components/shared/useSimulatedProcessing";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getDocuments, createDocument, deleteDocument } from "@/services/ged.service";
import { classifyDocument } from "@/services/ai.service";
import type { GedDocument } from "@/types/ged";

const statutOcrVariant: Record<string, "success" | "warning"> = {
  "Analysé": "success",
  "En cours": "warning",
};

const statutSignatureVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Signé": "success",
  "En attente": "warning",
  "N/A": "neutral",
};

export default function GedView() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);
  const { status, result, run, reset } = useSimulatedProcessing<{ type: string; tags: string[] }>();
  const [entiteLiee, setEntiteLiee] = useState("");
  const [saving, setSaving] = useState(false);
  const pagination = usePagination(documents);

  const refresh = () => getDocuments().then(setDocuments);

  useEffect(() => {
    refresh();
  }, []);

  const handleEnregistrer = async () => {
    if (!result) return;
    if (!entiteLiee.trim()) {
      toast.error("Précisez l'entité liée (client, contrat, prestataire…) avant d'enregistrer.");
      return;
    }
    try {
      setSaving(true);
      await createDocument({
        nom: `Document_${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).slice(2, 6)}`,
        type: result.type, entiteLiee: entiteLiee.trim(), tags: result.tags,
      });
      refresh();
      reset();
      setEntiteLiee("");
      toast.success("Document enregistré dans la GED.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
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
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="GED & Documents" subtitle="Gestion électronique documentaire, OCR et signature électronique" icon={Archive} />

      <UploadDropzone
        onFiles={() => run(() => classifyDocument().catch((err) => { toast.error(err instanceof Error ? err.message : "Classement impossible."); throw err; }))}
        label="Glissez vos documents ici"
        hint="Contrats, factures, pièces d'identité, scans smartphone · Classement automatique par IA"
      />

      {status === "processing" && (
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Analyse OCR et classement automatique en cours…</p>
        </div>
      )}

      {status === "done" && result && (
        <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-foreground">Document classé automatiquement :</span>
              <Badge variant="gold">{result.type}</Badge>
              {result.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Tag className="w-3 h-3" />{t}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={entiteLiee}
              onChange={(e) => setEntiteLiee(e.target.value)}
              placeholder="Entité liée (client, contrat, prestataire…)"
              className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground"
            />
            <button type="button" disabled={saving} onClick={handleEnregistrer} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 whitespace-nowrap">Enregistrer dans la GED</button>
            <button type="button" onClick={() => { reset(); setEntiteLiee(""); }} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Documents classés ({documents.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Document", "Type", "Entité liée", "Tags", "OCR", "Signature", "Date", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap med-num">{d.nom}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.type}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.entiteLiee}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-1 flex-wrap">
                    {d.tags.map((t) => <Badge key={t} variant="neutral">{t}</Badge>)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutOcrVariant[d.statutOcr] ?? "neutral"}>{d.statutOcr}</Badge></td>
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


