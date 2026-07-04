import { useEffect, useState } from "react";
import { Wallet, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { getFondsDeRoulement } from "@/services/fondsDeRoulement.service";
import type { FondsDeRoulement } from "@/types/fondsDeRoulement";

const statutVariant: Record<string, "success" | "warning" | "danger"> = {
  Normal: "success",
  Alerte: "warning",
  Épuisé: "danger",
};

export default function FondsDeRoulementView() {
  const [fonds, setFonds] = useState<FondsDeRoulement[]>([]);

  useEffect(() => {
    getFondsDeRoulement().then(setFonds);
  }, []);

  const enAlerte = fonds.filter((f) => f.statut !== "Normal").length;
  const totalRestant = fonds.reduce((a, b) => a + (b.montantInitial - b.montantConsomme), 0);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Fonds de Roulement" subtitle="Auto-gestion santé — alimentation et consommation par contrat" icon={Wallet} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Contrats en auto-gestion" value={String(fonds.length)} icon={Wallet} />
        <StatCard title="Solde restant cumulé" value={`${fmtM(totalRestant)} XAF`} icon={Wallet} />
        <StatCard title="Sous seuil d'alerte" value={String(enAlerte)} icon={AlertTriangle} accent={enAlerte > 0 ? "bg-red-500/10" : undefined} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fonds.map((f) => {
          const restant = f.montantInitial - f.montantConsomme;
          const pctConsomme = f.montantInitial > 0 ? Math.round((f.montantConsomme / f.montantInitial) * 100) : 0;
          return (
            <div key={f.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">{f.clientNom}</p>
                <Badge variant={statutVariant[f.statut] ?? "neutral"}>{f.statut}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{f.contratId} · Alimenté le {f.dateAlimentation}</p>
              <div className="w-full bg-secondary rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full ${f.statut === "Normal" ? "bg-primary" : "bg-red-500"}`} style={{ width: `${Math.min(pctConsomme, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Consommé {fmtM(f.montantConsomme)} / {fmtM(f.montantInitial)} XAF ({pctConsomme}%)</span>
                <span className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(restant)} restants</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
