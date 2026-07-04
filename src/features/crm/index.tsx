import { useEffect, useState } from "react";
import { Target, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { getProspects, getCrmKanban } from "@/services/crm.service";
import type { Prospect } from "@/types/crm";

const etapeStyle: Record<string, string> = {
  "Nouveau": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Qualifié": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Proposition envoyée": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Négociation": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Gagné": "text-green-400 bg-green-500/10 border-green-500/20",
  "Perdu": "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function CrmView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [kanban, setKanban] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getProspects().then(setProspects);
    getCrmKanban().then(setKanban);
  }, []);

  const pipelineValue = prospects
    .filter((p) => p.etape !== "Gagné" && p.etape !== "Perdu")
    .reduce((a, b) => a + b.valeurEstimee, 0);
  const gagnes = prospects.filter((p) => p.etape === "Gagné").length;
  const tauxTransfo = prospects.length ? Math.round((gagnes / prospects.length) * 100) : 0;

  return (
    <div className="p-6">
      <ModuleHeader title="CRM & Prospection" subtitle="Pipeline commercial et suivi des opportunités" icon={Target}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouveau prospect</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Pipeline actif" value={`${fmtM(pipelineValue)} XAF`} icon={Target} />
        <StatCard title="Prospects en cours" value={String(prospects.filter((p) => p.etape !== "Gagné" && p.etape !== "Perdu").length)} icon={Target} />
        <StatCard title="Taux de transformation" value={`${tauxTransfo}%`} icon={Target} trend={{ label: "+4%", up: true }} />
        <StatCard title="Affaires gagnées" value={String(gagnes)} icon={Target} accent="bg-green-500/10" />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {Object.entries(kanban).map(([etape, ids]) => (
            <div key={etape} className="w-60 flex-shrink-0">
              <div className={`px-3 py-2 rounded-lg mb-3 border text-xs font-semibold flex items-center justify-between ${etapeStyle[etape]}`}>
                <span>{etape}</span>
                <span className="opacity-70 font-mono">{ids.length}</span>
              </div>
              <div className="space-y-2">
                {ids.map((id) => {
                  const p = prospects.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{p.id}</span>
                        <Badge variant={p.type === "Entreprise" ? "gold" : "info"}>{p.type}</Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{p.nom}</p>
                      <p className="text-xs text-muted-foreground mt-1">{p.source}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.valeurEstimee)}</span>
                        <span className="text-xs text-muted-foreground">{p.commercial}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
