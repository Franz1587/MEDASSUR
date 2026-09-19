import { useEffect, useState } from "react";
import { Wallet, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { fmtM } from "@/lib/format";
import { getComptesBancaires } from "@/services/tresorerie.service";
import { getImpayes } from "@/services/recouvrement.service";
import { getCommissions } from "@/services/commissions.service";
import type { CompteBancaire } from "@/types/tresorerie";
import type { Impaye } from "@/types/recouvrement";
import type { Commission } from "@/types/commissions";

const niveauVariant: Record<string, "warning" | "danger"> = {
  "Relance 1": "warning",
  "Relance 2": "warning",
  "Mise en demeure": "danger",
  "Contentieux": "danger",
};

export default function FinanceDashboard() {
  const { setView } = useShellNavigation();
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [impayes, setImpayes] = useState<Impaye[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);

  useEffect(() => {
    getComptesBancaires().then(setComptes);
    getImpayes().then(setImpayes);
    getCommissions().then(setCommissions);
  }, []);

  const soldeConsolide = comptes.reduce((a, b) => a + b.solde, 0);
  const enCours = impayes.filter((i) => i.statut === "En cours").sort((a, b) => b.joursRetard - a.joursRetard);
  const totalImpayes = impayes.reduce((a, b) => a + b.montantDu, 0);
  const aReverser = commissions.filter((c) => c.statut !== "Reversé").reduce((a, b) => a + b.montantCommission, 0);

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Finance" subtitle="Trésorerie, commissions et recouvrement" icon={Wallet} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Solde consolidé" value={`${fmtM(soldeConsolide)} FCFA`} icon={Wallet} />
        <StatCard title="Commissions à reverser" value={`${fmtM(aReverser)} FCFA`} icon={DollarSign} accent="bg-amber-500/10" />
        <StatCard title="Total impayés" value={`${fmtM(totalImpayes)} FCFA`} icon={CreditCard} accent="bg-red-500/10" />
        <StatCard title="Dossiers en cours" value={String(enCours.length)} icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {comptes.map((c) => (
          <div key={c.id} onClick={() => { setView("tresorerie"); toast.success("Navigation vers Trésorerie"); }} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/30 transition-colors">
            <p className="text-xs text-muted-foreground mb-1">{c.banque} · {c.pays}</p>
            <p className="text-lg font-bold text-foreground med-num">{fmtM(c.solde)} {c.devise}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Impayés urgents</h3>
        </div>
        <div className="divide-y divide-border/50">
          {enCours.slice(0, 6).map((i) => (
            <div key={i.id} onClick={() => setView("recouvrement")} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-foreground">{i.client}</p>
                <p className="text-xs text-muted-foreground">{i.contrat} · {i.canal}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-semibold text-foreground med-num">{fmtM(i.montantDu)} FCFA</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-red-400 med-num">{i.joursRetard} j</span>
                  <Badge variant={niveauVariant[i.niveau] ?? "neutral"}>{i.niveau}</Badge>
                </div>
              </div>
            </div>
          ))}
          {enCours.length === 0 && (
            <div className="px-4 py-6">
              <p className="med-empty-state px-4 py-5 text-sm text-muted-foreground text-center">Aucun impayé en cours</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


