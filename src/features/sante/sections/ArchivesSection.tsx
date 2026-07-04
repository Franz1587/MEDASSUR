import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { getDocuments } from "@/services/ged.service";
import type { GedDocument } from "@/types/ged";

const statutOcrVariant: Record<string, "success" | "warning"> = {
  "Analysé": "success", "En cours": "warning",
};
const statutSignatureVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Signé": "success", "En attente": "warning", "N/A": "neutral",
};

const isDocumentSante = (d: GedDocument) =>
  d.tags.some((t) => t.toLowerCase().includes("santé")) || d.tags.some((t) => t.toLowerCase().includes("sante"));

export default function ArchivesSection() {
  const [documents, setDocuments] = useState<GedDocument[]>([]);

  useEffect(() => {
    getDocuments().then((all) => setDocuments(all.filter(isDocumentSante)));
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm">Archives Santé ({documents.length})</h3>
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
            <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
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
      {documents.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucun document santé archivé</div>}
    </div>
  );
}
