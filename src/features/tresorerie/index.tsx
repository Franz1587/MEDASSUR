import { useEffect, useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, CheckCircle, Clock } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getComptesBancaires, getFluxTresorerie } from "@/services/tresorerie.service";
import type { CompteBancaire, FluxTresorerie } from "@/types/tresorerie";

export default function TresorerieView() {
  const [comptes, setComptes] = useState<CompteBancaire[]>([]);
  const [flux, setFlux] = useState<FluxTresorerie[]>([]);

  useEffect(() => {
    getComptesBancaires().then(setComptes);
    getFluxTresorerie().then(setFlux);
  }, []);

  const soldeTotal = comptes.reduce((a, b) => a + b.solde, 0);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Trésorerie" subtitle="Suivi des comptes bancaires, flux et rapprochement" icon={Wallet} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-primary/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Solde consolidé</p>
          <p className="text-xl font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(soldeTotal)} XAF</p>
        </div>
        {comptes.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.banque} · {c.pays}</p>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.solde)} {c.devise}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Flux récents</h3>
        </div>
        <div className="divide-y divide-border/50">
          {flux.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${f.type === "Encaissement" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  {f.type === "Encaissement" ? <ArrowUpRight className="w-4 h-4 text-green-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.libelle}</p>
                  <p className="text-xs text-muted-foreground">{f.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${f.type === "Encaissement" ? "text-green-400" : "text-red-400"}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                  {f.type === "Encaissement" ? "+" : "−"}{fmtM(f.montant)}
                </span>
                {f.rapproche ? (
                  <span title="Rapproché"><CheckCircle className="w-4 h-4 text-green-400" /></span>
                ) : (
                  <span title="Non rapproché"><Clock className="w-4 h-4 text-amber-400" /></span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
