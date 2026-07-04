import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getHonoraires } from "@/services/honoraires.service";
import type { HonorairesGestion } from "@/types/honoraires";

const statutVariant: Record<string, "success" | "warning" | "neutral"> = {
  "Facturé": "success",
  "En attente": "warning",
};

export default function HonorairesView() {
  const [honoraires, setHonoraires] = useState<HonorairesGestion[]>([]);

  useEffect(() => {
    getHonoraires().then(setHonoraires);
  }, []);

  const total = honoraires.reduce((a, b) => a + b.montantHonoraires, 0);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Honoraires de Gestion" subtitle="Honoraires = sinistres × taux — auto-gestion santé" icon={DollarSign} />
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs text-muted-foreground mb-1">Honoraires cumulés</p>
        <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(total)} XAF</p>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Client", "Période", "Sinistres", "Taux", "Honoraires", "Plafond", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {honoraires.map((h) => (
              <tr key={h.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{h.clientNom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{h.periode}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(h.montantSinistres)}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{h.tauxHonoraires}%</td>
                <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(h.montantHonoraires)}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{h.plafond ? fmtM(h.plafond) : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[h.statut] ?? "neutral"}>{h.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
