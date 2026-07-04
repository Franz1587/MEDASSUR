import { useEffect, useState } from "react";
import { Archive, FileSignature, Brain, Tag, CheckCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { useSimulatedProcessing } from "@/components/shared/useSimulatedProcessing";
import { getDocuments } from "@/services/ged.service";
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
  const { status, result, run } = useSimulatedProcessing<{ type: string; tags: string[] }>();

  useEffect(() => {
    getDocuments().then(setDocuments);
  }, []);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="GED & Documents" subtitle="Gestion électronique documentaire, OCR et signature électronique" icon={Archive} />

      <UploadDropzone
        onFiles={() => run(() => classifyDocument())}
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
        <div className="flex items-center gap-3 bg-primary/8 border border-primary/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-foreground">Document classé automatiquement :</span>
            <Badge variant="gold">{result.type}</Badge>
            {result.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Tag className="w-3 h-3" />{t}</span>
            ))}
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
              {["Document", "Type", "Entité liée", "Tags", "OCR", "Signature", "Date"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{d.nom}</td>
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
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{d.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
