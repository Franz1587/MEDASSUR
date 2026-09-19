import { useEffect, useState } from "react";
import { Gauge, Users2, Building2, Activity, FileText } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { getPerformanceGlobale, getPerformanceParSociete } from "@/services/societes.service";
import type { PerformanceGlobale, PerformanceSociete } from "@/types/societes";

function tempsEcoule(iso?: string | null): string {
  if (!iso) return "Jamais connecté";
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 30) return `Il y a ${jours} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Performance / usage de la plateforme (2026-09) — voir demande
// utilisateur : "un écran lui permettant de voir les performances
// d'utilisation de l'application." Aucun outil d'analytics/APM branché sur
// ce projet — construit à partir de signaux réels déjà en base (dernières
// connexions, volume de données, activité journalisée), voir
// PerformanceService pour le détail des sources.
export default function SuperAdminPerformanceView() {
  const [global, setGlobal] = useState<PerformanceGlobale | null>(null);
  const [parSociete, setParSociete] = useState<PerformanceSociete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPerformanceGlobale(), getPerformanceParSociete()])
      .then(([g, s]) => { setGlobal(g); setParSociete(s); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Performance & Usage" subtitle="Activité réelle des sociétés utilisatrices de la plateforme" icon={Gauge} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Sociétés actives" value={loading ? "…" : `${global?.societesActives ?? 0}/${global?.totalSocietes ?? 0}`} icon={Building2} />
        <StatCard title="Utilisateurs actifs (30j)" value={loading ? "…" : `${global?.utilisateursActifs30j ?? 0}/${global?.totalUtilisateurs ?? 0}`} icon={Users2} accent="bg-emerald-500" />
        <StatCard title="Opérations (30j)" value={loading ? "…" : String(global?.operations30j ?? 0)} icon={Activity} />
        <StatCard title="Volume total" value={loading ? "…" : `${(global?.totalContrats ?? 0) + (global?.totalAssures ?? 0) + (global?.totalFactures ?? 0)}`} subtitle="Contrats + assurés + factures" icon={FileText} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Activité par société ({parSociete.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Société", "Utilisateurs actifs (30j)", "Opérations (30j)", "Dernière activité", "Contrats", "Assurés", "Factures", "PEC", "Prestataires"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground text-xs">Chargement…</td></tr>}
            {!loading && parSociete.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune société.</td></tr>}
            {parSociete.map((s) => (
              <tr key={s.societeId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-foreground text-sm whitespace-nowrap">{s.nom}</td>
                <td className="px-3 py-2.5 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.utilisateursActifs30j}/{s.totalUtilisateurs}</td>
                <td className="px-3 py-2.5 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.operations30j}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{tempsEcoule(s.derniereActivite)}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{s.volumeDonnees.contrats}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{s.volumeDonnees.assures}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{s.volumeDonnees.factures}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{s.volumeDonnees.prisesEnCharge}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{s.volumeDonnees.prestataires}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
