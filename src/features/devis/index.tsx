import { useEffect, useState } from "react";
import { FileText, Plus, Send, CheckCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getDevis } from "@/services/devis.service";
import type { Devis } from "@/types/devis";

const statutVariant: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = {
  "Brouillon": "neutral",
  "Envoyé": "info",
  "Accepté": "success",
  "Refusé": "danger",
  "Expiré": "warning",
};

export default function DevisView() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [selected, setSelected] = useState<Devis | null>(null);

  useEffect(() => {
    getDevis().then(setDevis);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Module Devis" subtitle="Création et suivi des devis multi-compagnies" icon={FileText}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouveau devis</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Réf.", "Client", "Branche", "Prime la + basse", "Validité", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => (
                <tr key={d.id} onClick={() => setSelected(d)}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === d.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                >
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{d.id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{d.client}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.branche}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.primeEstimee)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{d.validite}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[d.statut] ?? "neutral"}>{d.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="pb-4 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.id}</span>
                  <Badge variant={statutVariant[selected.statut] ?? "neutral"}>{selected.statut}</Badge>
                </div>
                <h3 className="font-bold text-foreground">{selected.client}</h3>
                <p className="text-xs text-muted-foreground">{selected.branche} · Créé le {selected.dateCreation}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Compagnies sollicitées</p>
                <div className="space-y-2">
                  {selected.compagnies.map((c) => (
                    <div key={c.nom} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${c.prime === selected.primeEstimee ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                      <span className="text-sm text-foreground">{c.nom}</span>
                      <div className="flex items-center gap-1.5">
                        {c.prime === selected.primeEstimee && <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                        <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Btn variant="primary" className="flex-1 justify-center"><Send className="w-4 h-4" />Envoyer</Btn>
                <Btn variant="secondary" className="flex-1 justify-center">Convertir en contrat</Btn>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un devis<br />pour voir le détail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
