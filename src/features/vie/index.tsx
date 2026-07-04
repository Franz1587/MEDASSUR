import { useEffect, useState } from "react";
import { Activity, Plus, Users } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getContratsVie } from "@/services/vie.service";
import type { ContratVie } from "@/types/vie";

export default function VieView() {
  const [contrats, setContrats] = useState<ContratVie[]>([]);
  const [selected, setSelected] = useState<ContratVie | null>(null);

  useEffect(() => {
    getContratsVie().then(setContrats);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Vie & Prévoyance" subtitle="Vie entière, épargne, retraite, prévoyance collective et décès invalidité" icon={Activity}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouveau contrat</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Réf.", "Assuré", "Produit", "Capital garanti", "Prime annuelle", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contrats.map((c) => (
                <tr key={c.id} onClick={() => setSelected(c)}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                >
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.assure}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{c.produit}</Badge></td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.capitalGaranti)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.primeAnnuelle)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={c.statut === "Actif" ? "success" : "warning"}>{c.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="pb-4 border-b border-border">
                <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.id}</span>
                <h3 className="font-bold text-foreground mt-1">{selected.assure}</h3>
                <p className="text-xs text-muted-foreground">{selected.produit} · {selected.compagnie}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Capital garanti</p>
                  <p className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(selected.capitalGaranti)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prime annuelle</p>
                  <p className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(selected.primeAnnuelle)}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Bénéficiaires</p>
                </div>
                <div className="space-y-1.5">
                  {selected.beneficiaires.map((b) => (
                    <div key={b.nom} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                      <div>
                        <p className="text-sm text-foreground">{b.nom}</p>
                        <p className="text-xs text-muted-foreground">{b.lien}</p>
                      </div>
                      <span className="text-sm font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{b.quotePart}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Activity className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un contrat<br />pour voir le détail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
