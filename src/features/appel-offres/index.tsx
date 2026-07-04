import { useEffect, useState } from "react";
import { FileSearch, TrendingUp } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getAppelsOffres } from "@/services/appelOffres.service";
import type { AppelOffres } from "@/types/appelOffres";

const statutVariant: Record<string, "info" | "success" | "warning" | "neutral"> = {
  "En cours": "info",
  "Proposition envoyée": "warning",
  "Gagné": "success",
};

export default function AppelOffresView() {
  const [appelsOffres, setAppelsOffres] = useState<AppelOffres[]>([]);
  const [selected, setSelected] = useState<AppelOffres | null>(null);

  useEffect(() => {
    getAppelsOffres().then((data) => {
      setAppelsOffres(data);
      setSelected((s) => s ?? data[0] ?? null);
    });
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Appels d'Offres" subtitle="Cahier des charges, simulation et propositions à 3 niveaux" icon={FileSearch} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Appels d'offres ({appelsOffres.length})</h3>
          </div>
          <div className="divide-y divide-border/50">
            {appelsOffres.map((ao) => (
              <div key={ao.id} onClick={() => setSelected(ao)}
                className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === ao.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{ao.id}</span>
                  <Badge variant={statutVariant[ao.statut] ?? "neutral"}>{ao.statut}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{ao.clientNom}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{selected.clientNom}</h3>
                  <Badge variant={statutVariant[selected.statut] ?? "neutral"}>{selected.statut}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selected.cahierCharges}</p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Garanties demandées :</span> {selected.garantiesDemandees}</p>
                {selected.historiqueSinistres && (
                  <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Historique :</span> {selected.historiqueSinistres}</p>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Projection S/P</p>
                    <p className="text-sm font-bold text-foreground">{selected.projectionSP}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimation PEPM</p>
                    <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(selected.estimationPepm)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fonds de roulement estimé</p>
                    <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(selected.estimationFondsRoulement)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selected.propositions.map((p) => (
                  <div key={p.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="gold">{p.niveau}</Badge>
                      <Badge variant={p.statut === "Envoyée" ? "info" : "neutral"}>{p.statut}</Badge>
                    </div>
                    <p className="text-xl font-bold text-primary mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.primeProposee)} <span className="text-xs text-muted-foreground">XAF</span></p>
                    <p className="text-xs text-muted-foreground">{p.descriptionGaranties}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un appel d'offres</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
