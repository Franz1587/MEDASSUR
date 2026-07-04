import { useEffect, useState } from "react";
import { BarChart3, Plus, FileSearch, Download } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { getRapports, getKpis } from "@/services/rapports.service";
import type { Rapport, Kpi } from "@/types/rapports";

export default function RapportsView() {
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);

  useEffect(() => {
    getRapports().then(setRapports);
    getKpis().then(setKpis);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Reporting & KPIs" subtitle="Indicateurs de performance et rapports d'activité — Zone CIMA" icon={BarChart3}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Générer un rapport</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.title} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{k.target}</span>
            </div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.title}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Bibliothèque de Rapports</h3>
        </div>
        <div className="divide-y divide-border/50">
          {rapports.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><FileSearch className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.type} · {r.date} {r.taille !== "—" && `· ${r.taille}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={r.statut === "Généré" ? "success" : r.statut === "En cours" ? "warning" : "neutral"}>{r.statut}</Badge>
                {r.statut === "Généré" && (
                  <button className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
