import { useEffect, useState } from "react";
import { FileText, RefreshCw, TrendingUp, Plus } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getRenouvellements } from "@/services/renouvellements.service";
import { getDevis } from "@/services/devis.service";
import type { Renouvellement } from "@/types/renouvellements";
import type { Devis } from "@/types/devis";

const devisVariant: Record<string, "success" | "danger" | "info" | "neutral" | "warning"> = {
  "Accepté": "success",
  "Refusé": "danger",
  "Envoyé": "info",
  "Expiré": "warning",
  "Brouillon": "neutral",
};

export default function ProductionDashboard() {
  const [renouvellements, setRenouvellements] = useState<Renouvellement[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);

  useEffect(() => {
    getRenouvellements().then(setRenouvellements);
    getDevis().then(setDevis);
  }, []);

  const aRenouveler = renouvellements.filter((r) => r.statut === "À renouveler");
  const devisEnCours = devis.filter((d) => d.statut === "Envoyé" || d.statut === "Brouillon");
  const devisAcceptes = devis.filter((d) => d.statut === "Accepté").length;
  const tauxConversion = devis.length ? Math.round((devisAcceptes / devis.length) * 100) : 0;
  const primeARenegocier = aRenouveler.reduce((a, b) => a + b.primeProposee, 0);

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Production" subtitle="Contrats, renouvellements et devis en portefeuille" icon={FileText}
        actions={
          <>
            <Btn variant="secondary"><RefreshCw className="w-4 h-4" />Relancer les renouvellements</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouveau devis</Btn>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="À renouveler" value={String(aRenouveler.length)} subtitle="Sous 30 jours" icon={RefreshCw} accent="bg-amber-500/10" />
        <StatCard title="Devis en cours" value={String(devisEnCours.length)} subtitle="Envoyés ou en brouillon" icon={FileText} />
        <StatCard title="Taux de conversion" value={`${tauxConversion}%`} icon={TrendingUp} trend={{ label: "+4%", up: true }} />
        <StatCard title="Prime à renégocier" value={`${fmtM(primeARenegocier)} XAF`} icon={RefreshCw} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Renouvellements urgents</h3>
          </div>
          <div className="divide-y divide-border/50">
            {aRenouveler.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.client}</p>
                  <p className="text-xs text-muted-foreground">{r.branche} · {r.compagnie}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-amber-400" style={{ fontFamily: "'DM Mono', monospace" }}>{r.joursRestants} j</p>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.primeProposee)} XAF</p>
                </div>
              </div>
            ))}
            {aRenouveler.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun renouvellement urgent</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Devis récents</h3>
          </div>
          <div className="divide-y divide-border/50">
            {devis.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{d.client}</p>
                  <p className="text-xs text-muted-foreground">{d.branche}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.primeEstimee)} XAF</p>
                  <Badge variant={devisVariant[d.statut] ?? "neutral"}>{d.statut}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
