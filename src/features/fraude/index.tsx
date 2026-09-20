import { useState, useEffect } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getScoringsFraude, evaluerAssure } from "@/services/fraude.service";
import type { ScoringFraude } from "@/types/fraude";

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 50) return "danger";
  if (score >= 25) return "warning";
  return "success";
}

export default function FraudeView() {
  const [scores, setScores] = useState<ScoringFraude[]>([]);
  const [assureId, setAssureId] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const pagination = usePagination(scores);

  useEffect(() => {
    getScoringsFraude().then(setScores);
  }, []);

  const handleEvaluer = async () => {
    if (!assureId.trim()) return;
    setEvaluating(true);
    try {
      await evaluerAssure(assureId.trim());
      setScores(await getScoringsFraude());
      setAssureId("");
    } catch {
      window.alert("Assuré introuvable ou erreur d'évaluation");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Contrôle fraude" subtitle="Scoring et évaluation des assurés et prestataires" icon={ShieldAlert} />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            value={assureId}
            onChange={(e) => setAssureId(e.target.value)}
            placeholder="ID assuré (ex: ASS-001)"
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors w-56"
          />
          <Btn variant="primary" onClick={handleEvaluer}><Search className="w-4 h-4" />{evaluating ? "Évaluation…" : "Évaluer"}</Btn>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Cible", "Nom", "Score", "Motifs", "Date évaluation"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{s.cible}</Badge></td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.cibleNom}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-secondary rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${s.score >= 50 ? "bg-red-500" : s.score >= 25 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${s.score}%` }} />
                      </div>
                      <Badge variant={scoreVariant(s.score)}>{s.score}/100</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">{s.motifs}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.dateEvaluation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scores.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucune évaluation enregistrée</div>}
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
