import { useEffect, useState } from "react";
import { Building2, Star, Clock, ShieldOff } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getPrestataires, suspendrePrestataire } from "@/services/prestataires.service";
import type { Prestataire } from "@/types/prestataires";

const statutVariant: Record<string, "success" | "warning" | "danger"> = {
  "Conventionné": "success", "En négociation": "warning", "Suspendu": "danger",
};

export default function ReseauSoinsSection() {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [selected, setSelected] = useState<Prestataire | null>(null);

  useEffect(() => {
    getPrestataires().then((data) => {
      setPrestataires(data);
      setSelected((s) => s ?? data[0] ?? null);
    });
  }, []);

  const handleSuspendre = async () => {
    if (!selected) return;
    const motif = window.prompt("Motif de suspension (fraude, surtarification, non-respect des délais…) :");
    if (!motif) return;
    const updated = await suspendrePrestataire(selected.id, motif);
    setPrestataires((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Prestataires ({prestataires.length})</h3>
        </div>
        <div className="divide-y divide-border/50">
          {prestataires.map((p) => (
            <div key={p.id} onClick={() => setSelected(p)}
              className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === p.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">{p.nom}</p>
                <Badge variant={statutVariant[p.statutConvention] ?? "neutral"}>{p.statutConvention}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.type} · {p.ville}, {p.pays}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-foreground">{selected.nom}</h3>
                <p className="text-xs text-muted-foreground">{selected.type} · {selected.ville}, {selected.pays}</p>
              </div>
              <Badge variant={statutVariant[selected.statutConvention] ?? "neutral"}>{selected.statutConvention}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3">
                <Star className="w-4 h-4 text-primary mb-1" />
                <p className="text-sm font-bold text-foreground">{selected.scoreQualite ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Score qualité</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <Clock className="w-4 h-4 text-primary mb-1" />
                <p className="text-sm font-bold text-foreground">{selected.delaiPaiementMoyen ? `${selected.delaiPaiementMoyen} j` : "—"}</p>
                <p className="text-xs text-muted-foreground">Délai paiement moyen</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <Building2 className="w-4 h-4 text-primary mb-1" />
                <p className="text-sm font-bold text-foreground">{selected.dateConventionnement ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Date conventionnement</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Grille tarifaire</p>
              <div className="space-y-1.5">
                {selected.grillesTarifaires.map((g) => (
                  <div key={g.acte} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                    <span className="text-sm text-foreground">{g.acte}</span>
                    <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.plafond)} XAF</span>
                  </div>
                ))}
                {selected.grillesTarifaires.length === 0 && <p className="text-xs text-muted-foreground">Aucune grille tarifaire renseignée</p>}
              </div>
            </div>

            {selected.motifSuspension && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
                <ShieldOff className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{selected.motifSuspension}</p>
              </div>
            )}

            {selected.statutConvention !== "Suspendu" && (
              <Btn variant="secondary" onClick={handleSuspendre}><ShieldOff className="w-4 h-4" />Suspendre le prestataire</Btn>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Sélectionnez un prestataire</p>
          </div>
        )}
      </div>
    </div>
  );
}
