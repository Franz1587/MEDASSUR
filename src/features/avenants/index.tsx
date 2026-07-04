import { useEffect, useState } from "react";
import { Edit, Plus, ArrowRight } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getAvenants } from "@/services/avenants.service";
import type { Avenant } from "@/types/avenants";

const statutVariant: Record<string, "neutral" | "info" | "success"> = {
  "Brouillon": "neutral",
  "Validé": "info",
  "Appliqué": "success",
};

export default function AvenantsView() {
  const [avenants, setAvenants] = useState<Avenant[]>([]);

  useEffect(() => {
    getAvenants().then(setAvenants);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Avenants" subtitle="Modifications de contrats en vigueur et traçabilité des changements" icon={Edit}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvel avenant</Btn>}
      />
      <div className="space-y-3">
        {avenants.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{a.id}</span>
                  <Badge variant="gold">{a.type}</Badge>
                  <Badge variant={statutVariant[a.statut] ?? "neutral"}>{a.statut}</Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{a.client} · <span className="text-muted-foreground font-normal">{a.contrat}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.primeAvant)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={`font-semibold ${a.primeApres > a.primeAvant ? "text-amber-400" : "text-foreground"}`} style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.primeApres)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Effet: {a.dateEffet}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
