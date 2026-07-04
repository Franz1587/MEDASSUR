import { useEffect, useState } from "react";
import { Stethoscope, Plus, Users, Heart, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getAssuresSante, getPriseEnCharges } from "@/services/sante.service";
import type { AssureSante, PriseEnCharge } from "@/types/sante";

export default function SanteView() {
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [priseEnCharges, setPriseEnCharges] = useState<PriseEnCharge[]>([]);

  useEffect(() => {
    getAssuresSante().then(setAssures);
    getPriseEnCharges().then(setPriseEnCharges);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Module Santé" subtitle="Assurés, bénéficiaires, prises en charge et remboursements" icon={Stethoscope}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle prise en charge</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Assurés actifs", value: "456", icon: Users, color: "text-primary" },
          { label: "Bénéficiaires totaux", value: "1 248", icon: Heart, color: "text-red-400" },
          { label: "Prises en charge actives", value: "48", icon: Clock, color: "text-amber-400" },
          { label: "Remboursé ce mois", value: "12.4M XAF", icon: CheckCircle, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <s.icon className={`w-5 h-5 mb-2.5 ${s.color}`} />
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Assurés Principaux</h3>
            <button className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Assuré", "Matricule", "Bénéf.", "Cotisation/mois", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assures.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-foreground text-sm">{a.nom}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{a.matricule}</td>
                  <td className="px-4 py-3 text-center text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{a.benef}</td>
                  <td className="px-4 py-3 text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.cotisation)}</td>
                  <td className="px-4 py-3"><Badge variant={a.statut === "Actif" ? "success" : "warning"}>{a.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Prises en Charge Récentes</h3>
            <button className="text-xs text-primary hover:underline">Voir tout →</button>
          </div>
          <div className="p-4 space-y-3">
            {priseEnCharges.map((pc) => (
              <div key={pc.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{pc.id}</span>
                    <Badge variant={pc.type === "Hospitalisation" ? "danger" : "neutral"}>{pc.type}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                  <p className="text-xs text-muted-foreground">{pc.prestataire}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(pc.montant)}</p>
                  <div className="mt-1"><Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge></div>
                  <p className="text-xs text-muted-foreground mt-1">{pc.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
