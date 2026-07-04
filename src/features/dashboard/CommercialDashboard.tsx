import { useEffect, useState } from "react";
import { Target, TrendingUp, FileText } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getProspects } from "@/services/crm.service";
import { getDevis } from "@/services/devis.service";
import type { Prospect } from "@/types/crm";
import type { Devis } from "@/types/devis";

const etapes = ["Nouveau", "Qualifié", "Proposition envoyée", "Négociation", "Gagné"];
const etapeStyle: Record<string, string> = {
  "Nouveau": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Qualifié": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Proposition envoyée": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Négociation": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Gagné": "text-green-400 bg-green-500/10 border-green-500/20",
};

export default function CommercialDashboard() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);

  useEffect(() => {
    getProspects().then(setProspects);
    getDevis().then(setDevis);
  }, []);

  const actifs = prospects.filter((p) => p.etape !== "Gagné" && p.etape !== "Perdu");
  const pipelineValue = actifs.reduce((a, b) => a + b.valeurEstimee, 0);
  const gagnes = prospects.filter((p) => p.etape === "Gagné").length;
  const tauxTransfo = prospects.length ? Math.round((gagnes / prospects.length) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Commercial" subtitle="Pipeline CRM et suivi des devis" icon={Target} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pipeline actif" value={`${fmtM(pipelineValue)} XAF`} icon={Target} />
        <StatCard title="Prospects en cours" value={String(actifs.length)} icon={Target} />
        <StatCard title="Taux de transformation" value={`${tauxTransfo}%`} icon={TrendingUp} trend={{ label: "+4%", up: true }} />
        <StatCard title="Affaires gagnées" value={String(gagnes)} icon={Target} accent="bg-green-500/10" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-foreground text-sm mb-3">Pipeline commercial</h3>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-3 min-w-max">
            {etapes.map((etape) => {
              const items = prospects.filter((p) => p.etape === etape);
              return (
                <div key={etape} className="w-48 flex-shrink-0">
                  <div className={`px-2.5 py-1.5 rounded-lg mb-2 border text-xs font-semibold flex items-center justify-between ${etapeStyle[etape]}`}>
                    <span>{etape}</span>
                    <span className="opacity-70 font-mono">{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.slice(0, 3).map((p) => (
                      <div key={p.id} className="bg-secondary/30 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-foreground truncate">{p.nom}</p>
                        <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.valeurEstimee)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Devis récents</h3>
        </div>
        <div className="divide-y divide-border/50">
          {devis.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div>
                <p className="text-sm font-semibold text-foreground">{d.client}</p>
                <p className="text-xs text-muted-foreground">{d.branche}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.primeEstimee)} XAF</p>
                <Badge variant={d.statut === "Accepté" ? "success" : d.statut === "Refusé" ? "danger" : "info"}>{d.statut}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
