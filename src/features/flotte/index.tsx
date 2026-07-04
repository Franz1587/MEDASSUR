import { useEffect, useState } from "react";
import { Truck, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getFlottes } from "@/services/flotte.service";
import type { Flotte } from "@/types/flotte";

export default function FlotteView() {
  const [flottes, setFlottes] = useState<Flotte[]>([]);
  const [selected, setSelected] = useState<Flotte | null>(null);

  useEffect(() => {
    getFlottes().then((data) => {
      setFlottes(data);
      setSelected(data[0] ?? null);
    });
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Flottes Automobiles" subtitle="Gestion des flottes de véhicules et suivi individuel par immatriculation" icon={Truck}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle flotte</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Flottes ({flottes.length})</h3>
          </div>
          <div className="divide-y divide-border/50">
            {flottes.map((f) => (
              <div key={f.id} onClick={() => setSelected(f)}
                className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === f.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{f.id}</span>
                  <Badge variant={f.statut === "Actif" ? "success" : "neutral"}>{f.statut}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{f.client}</p>
                <p className="text-xs text-muted-foreground">{f.nbVehicules} véhicules · {f.compagnie}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{selected.client}</h3>
                  <p className="text-xs text-muted-foreground">{selected.contrat} · Prime totale {fmtM(selected.primeTotal)} XAF</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Immatriculation", "Modèle", "Conducteur", "Valeur vénale", "Statut"].map((h) => (
                      <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.vehicules.map((v) => (
                    <tr key={v.immatriculation} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{v.immatriculation}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{v.modele}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{v.conducteur}</td>
                      <td className="px-4 py-3 text-right text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(v.valeurVenale)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><Badge variant={v.statut === "En circulation" ? "success" : "warning"}>{v.statut}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Truck className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez une flotte</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
