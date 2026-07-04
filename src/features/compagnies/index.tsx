import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getCompagnies } from "@/services/compagnies.service";
import type { Compagnie } from "@/types/compagnies";

export default function CompagniesView() {
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);

  useEffect(() => {
    getCompagnies().then(setCompagnies);
  }, []);

  return (
    <div className="p-6">
      <ModuleHeader title="Compagnies Partenaires" subtitle="Réseau de compagnies d'assurance — Zone CIMA" icon={Building2}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Ajouter compagnie</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {compagnies.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <Badge variant={c.niveau === "Premium" ? "gold" : "neutral"}>{c.niveau}</Badge>
            </div>
            <h3 className="font-bold text-foreground mb-0.5">{c.nom}</h3>
            <p className="text-xs text-muted-foreground mb-4">{c.pays}</p>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3">
              <div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{c.contrats}</p>
                <p className="text-xs text-muted-foreground">Contrats</p>
              </div>
              <div>
                <p className="text-sm font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{c.taux}</p>
                <p className="text-xs text-muted-foreground">Commission</p>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</p>
                <p className="text-xs text-muted-foreground">Primes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
