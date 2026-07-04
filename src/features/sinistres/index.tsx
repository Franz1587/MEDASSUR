import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getSinistres, getSinistresKanban } from "@/services/sinistres.service";
import type { Sinistre } from "@/types/sinistres";

const statusStyle: Record<string, string> = {
  "Déclaré": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Expert. en cours": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Expertise": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Recours": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Remboursé": "text-green-400 bg-green-500/10 border-green-500/20",
  "Clôturé": "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function SinistresView() {
  const [activeTab, setActiveTab] = useState<"liste" | "kanban">("liste");
  const [sinistres, setSinistres] = useState<Sinistre[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getSinistres().then(setSinistres);
    getSinistresKanban().then(setKanbanColumns);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Gestion des Sinistres" subtitle="Déclaration, expertise, suivi, indemnisation et clôture" icon={AlertTriangle}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Déclarer un sinistre</Btn>}
      />
      <div className="flex gap-2 mb-5">
        {(["liste", "kanban"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            {t === "liste" ? "Liste des sinistres" : "Vue Workflow Kanban"}
          </button>
        ))}
      </div>

      {activeTab === "liste" ? (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Référence", "Client", "Branche", "Description", "Montant estimé", "Date", "Priorité", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sinistres.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.client}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{s.branche}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(s.montant)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={s.priorite === "Urgent" ? "danger" : s.priorite === "Haute" ? "warning" : "neutral"}>{s.priorite}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${statusStyle[s.statut] || statusStyle["Clôturé"]}`}>
                      {s.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {Object.entries(kanbanColumns).map(([status, ids]) => (
              <div key={status} className="w-52 flex-shrink-0">
                <div className={`px-3 py-2 rounded-lg mb-3 border text-xs font-semibold flex items-center justify-between ${statusStyle[status] || statusStyle["Clôturé"]}`}>
                  <span>{status}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const s = sinistres.find((x) => x.id === id);
                    return (
                      <div key={id} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                        <p className="text-xs font-semibold text-primary mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>{id}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s?.description || "Sinistre en traitement"}</p>
                        {s && (
                          <p className="text-xs font-semibold text-foreground mt-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {fmtM(s.montant)} XAF
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
