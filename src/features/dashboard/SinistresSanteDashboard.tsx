import { useEffect, useState } from "react";
import { AlertTriangle, Stethoscope, Clock, Plus } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getSinistres } from "@/services/sinistres.service";
import { getPriseEnCharges } from "@/services/sante.service";
import type { Sinistre } from "@/types/sinistres";
import type { PriseEnCharge } from "@/types/sante";

const prioriteOrder: Record<string, number> = { Urgent: 0, Haute: 1, Normal: 2 };
const prioriteVariant: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", Haute: "warning", Normal: "neutral" };

export default function SinistresSanteDashboard() {
  const [sinistres, setSinistres] = useState<Sinistre[]>([]);
  const [prisesEnCharge, setPrisesEnCharge] = useState<PriseEnCharge[]>([]);

  useEffect(() => {
    getSinistres().then(setSinistres);
    getPriseEnCharges().then(setPrisesEnCharge);
  }, []);

  const enCours = sinistres.filter((s) => s.statut !== "Clôturé" && s.statut !== "Remboursé");
  const urgents = sinistres.filter((s) => s.priorite === "Urgent").length;
  const montantEngage = enCours.reduce((a, b) => a + b.montant, 0);
  const priorityQueue = [...enCours].sort((a, b) => (prioriteOrder[a.priorite] ?? 9) - (prioriteOrder[b.priorite] ?? 9));
  const priseEnChargeActives = prisesEnCharge.filter((pc) => pc.statut === "Accordé");

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Sinistres & Santé" subtitle="File priorisée des dossiers et prises en charge" icon={AlertTriangle}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Déclarer un sinistre</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Sinistres en cours" value={String(enCours.length)} icon={AlertTriangle} />
        <StatCard title="Dossiers urgents" value={String(urgents)} icon={AlertTriangle} accent="bg-red-500/10" />
        <StatCard title="Prises en charge actives" value={String(priseEnChargeActives.length)} icon={Stethoscope} />
        <StatCard title="Montant engagé" value={`${fmtM(montantEngage)} XAF`} icon={Clock} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">File priorisée — Sinistres</h3>
          </div>
          <div className="divide-y divide-border/50">
            {priorityQueue.slice(0, 7).map((s) => (
              <div key={s.id} className="flex items-start justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{s.id}</span>
                    <Badge variant={prioriteVariant[s.priorite] ?? "neutral"}>{s.priorite}</Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">{s.description}</p>
                  <p className="text-xs text-muted-foreground">{s.client} · {s.branche}</p>
                </div>
                <p className="text-xs font-semibold text-foreground flex-shrink-0" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(s.montant)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Prises en charge récentes</h3>
          </div>
          <div className="divide-y divide-border/50">
            {prisesEnCharge.slice(0, 7).map((pc) => (
              <div key={pc.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                  <p className="text-xs text-muted-foreground">{pc.prestataire} · {pc.type}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(pc.montant)}</p>
                  <Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
