import { useEffect, useState } from "react";
import { XCircle, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getResiliations } from "@/services/resiliations.service";
import type { Resiliation } from "@/types/resiliations";

const statutVariant: Record<string, "warning" | "info" | "success"> = {
  "Demandée": "warning",
  "Validée": "info",
  "Effective": "success",
};

export default function ResiliationsView() {
  const [resiliations, setResiliations] = useState<Resiliation[]>([]);

  useEffect(() => {
    getResiliations().then(setResiliations);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Résiliations" subtitle="Traitement des demandes de résiliation et calcul des ristournes" icon={XCircle}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle résiliation</Btn>}
      />
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Contrat", "Client", "Branche", "Motif", "Initiateur", "Date d'effet", "Ristourne", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resiliations.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.contrat}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{r.client}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.branche}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={r.motif === "Fraude" || r.motif === "Non-paiement" ? "danger" : "neutral"}>{r.motif}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.initiateur}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.dateEffet}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.ristourne > 0 ? fmtM(r.ristourne) : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
