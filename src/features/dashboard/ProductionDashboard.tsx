import { useEffect, useState } from "react";
import { FileText, RefreshCw, TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { useAuth } from "@/auth/AuthContext";
import { fmtM } from "@/lib/format";
import { getRenouvellements } from "@/services/renouvellements.service";
import { getCotations } from "@/services/cotation.service";
import type { Renouvellement } from "@/types/renouvellements";
import type { Cotation } from "@/types/cotation";

// Tableau de bord personnel (2026-08) — voir demande utilisateur : "le
// tableau de bord [doit] faire remonter les informations en fonction du
// profil de l'utilisateur et non toutes les données." Renouvellements et
// cotations sont filtrés sur le contrat/la cotation dont l'agent connecté
// est le gestionnaire d'origine (voir schema.prisma Contrat.gestionnaireId/
// Cotation.gestionnaireId) — jamais tout le portefeuille de la compagnie.
export default function ProductionDashboard() {
  const { setView } = useShellNavigation();
  const { currentUser } = useAuth();
  const [allRenouvellements, setAllRenouvellements] = useState<Renouvellement[]>([]);
  const [allCotations, setAllCotations] = useState<Cotation[]>([]);

  useEffect(() => {
    getRenouvellements().then(setAllRenouvellements);
    getCotations().then(setAllCotations);
  }, []);

  const renouvellements = allRenouvellements.filter((r) => r.gestionnaireId === currentUser?.id);
  const cotations = allCotations.filter((c) => c.gestionnaireId === currentUser?.id);
  const aRenouveler = renouvellements.filter((r) => r.statut === "À renouveler");
  const primeARenegocier = aRenouveler.reduce((a, b) => a + b.primeProposee, 0);
  const primeCotations = cotations.reduce((a, b) => a + b.primeTTC, 0);

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Production" subtitle="Mes cotations en cours et mes renouvellements" icon={FileText}
        actions={
          <>
            <Btn variant="secondary" onClick={() => { setView("renouvellements"); toast.success("Ouverture du module Renouvellements"); }}><RefreshCw className="w-4 h-4" />Relancer les renouvellements</Btn>
            <Btn variant="primary" onClick={() => { setView("cotation"); toast.success("Ouverture du module Cotation"); }}><Plus className="w-4 h-4" />Nouvelle cotation</Btn>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="À renouveler" value={String(aRenouveler.length)} subtitle="Sous 30 jours" icon={RefreshCw} accent="bg-amber-500/10" />
        <StatCard title="Cotations enregistrées" value={String(cotations.length)} icon={FileText} />
        <StatCard title="Prime totale cotée" value={`${fmtM(primeCotations)} FCFA`} icon={TrendingUp} />
        <StatCard title="Prime à renégocier" value={`${fmtM(primeARenegocier)} FCFA`} icon={RefreshCw} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Mes renouvellements urgents</h3>
          </div>
          <div className="divide-y divide-border/50">
            {aRenouveler.slice(0, 6).map((r) => (
              <div key={r.id} onClick={() => setView("renouvellements")} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.client}</p>
                  <p className="text-xs text-muted-foreground">{r.branche} · {r.compagnie}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-400 med-num">{r.joursRestants} j</p>
                  <p className="text-xs text-muted-foreground med-num">{fmtM(r.primeProposee)} FCFA</p>
                </div>
              </div>
            ))}
            {aRenouveler.length === 0 && (
              <div className="px-4 py-6">
                <p className="med-empty-state px-4 py-5 text-sm text-muted-foreground text-center">Aucun renouvellement urgent</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Mes cotations récentes</h3>
          </div>
          <div className="divide-y divide-border/50">
            {cotations.slice(0, 6).map((c) => (
              <div key={c.id} onClick={() => setView("cotation")} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.clientNom}</p>
                  <p className="text-xs text-muted-foreground">{c.branche}{c.compagnie ? ` · ${c.compagnie.nom}` : ""}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-semibold text-foreground med-num">{fmtM(c.primeTTC)} FCFA</p>
                  <p className="text-xs text-muted-foreground med-num">{c.dateCreation}</p>
                </div>
              </div>
            ))}
            {cotations.length === 0 && (
              <div className="px-4 py-6">
                <p className="med-empty-state px-4 py-5 text-sm text-muted-foreground text-center">Aucune cotation enregistrée</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
