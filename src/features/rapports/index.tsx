import { useEffect, useState } from "react";
import { BarChart3, FileDown, TrendingUp, Percent, Wallet, ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Btn } from "@/components/shared/Btn";
import { fmt } from "@/lib/format";
import { getPilotageAssurance, openRapportPilotage } from "@/services/dashboard.service";
import { getProspects } from "@/services/crm.service";
import type { PilotageAssurance } from "@/types/dashboard";
import type { Prospect } from "@/types/crm";

// Reporting & KPIs (2026-09) — voir demande utilisateur : "lorsqu'on crée
// une nouvelle société qui n'a pas encore de données, l'application remonte
// encore certain mockdata... il faut que les données soient vierges et
// qu'on en crée nous-même progressivement." Cet écran renvoyait
// intégralement src/data/mock/rapports.mock.ts, jamais interrogé — remplacé
// par les VRAIES données déjà agrégées par DashboardService.pilotage()
// (même source que le tableau de bord principal, voir src/features/
// dashboard/index.tsx) + les VRAIS prospects CRM pour le taux de
// transformation. Aucune "bibliothèque" de rapports fabriqués : un seul
// rapport RÉEL existe dans l'application (DashboardService.
// genererRapportPdf), regénéré à la demande à partir des données du
// moment — jamais une liste statique de PDF qui n'ont jamais existé.
export default function RapportsView() {
  const [pilotage, setPilotage] = useState<PilotageAssurance | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [telechargement, setTelechargement] = useState(false);

  useEffect(() => {
    getPilotageAssurance().then(setPilotage);
    getProspects().then(setProspects);
  }, []);

  const gagnes = prospects.filter((p) => p.etape === "Gagné").length;
  const tauxTransfo = prospects.length ? Math.round((gagnes / prospects.length) * 100) : 0;
  const primeMoyenne = pilotage && pilotage.contratsActifs > 0 ? Math.round(pilotage.primesEmisesCumule / pilotage.contratsActifs) : 0;

  const telecharger = async () => {
    try {
      setTelechargement(true);
      await openRapportPilotage(pilotage?.annee);
    } finally {
      setTelechargement(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Reporting & KPIs" subtitle="Indicateurs de performance réels — Gabon" icon={BarChart3}
        actions={<Btn variant="primary" onClick={telecharger} disabled={telechargement}><FileDown className="w-4 h-4" />{telechargement ? "…" : "Télécharger le rapport de pilotage"}</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Taux de transformation" value={`${tauxTransfo}%`} subtitle={`${gagnes}/${prospects.length} prospect(s) gagné(s)`} icon={TrendingUp} />
        <StatCard title="Ratio Sinistres/Primes (S/P)" value={`${pilotage?.sinistresRatioSP ?? 0}%`} subtitle={`Année ${pilotage?.annee ?? "—"}`} icon={Percent} />
        <StatCard title="Prime moyenne / contrat" value={`${fmt(primeMoyenne)} FCFA`} subtitle={`${pilotage?.contratsActifs ?? 0} contrat(s) actif(s)`} icon={Wallet} />
        <StatCard title="Taux de recouvrement" value={pilotage?.tauxRecouvrement != null ? `${pilotage.tauxRecouvrement}%` : "—"} subtitle={pilotage?.tauxRecouvrement != null ? (pilotage.montantImpayes ? `${fmt(pilotage.montantImpayes)} FCFA impayés` : "Aucun impayé") : "Aucun contrat actif"} icon={ShieldCheck} />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Rapport de pilotage</h3>
        </div>
        <div className="flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><BarChart3 className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Rapport de pilotage — {pilotage?.annee ?? new Date().getFullYear()}</p>
              <p className="text-xs text-muted-foreground">Généré à la demande à partir des données réelles du moment (production, sinistralité, recouvrement, trésorerie).</p>
            </div>
          </div>
          <Btn variant="secondary" onClick={telecharger} disabled={telechargement}><FileDown className="w-4 h-4" />{telechargement ? "…" : "Télécharger"}</Btn>
        </div>
      </div>
    </div>
  );
}
