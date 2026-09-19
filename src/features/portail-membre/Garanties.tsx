import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getMesGaranties, type MembreGarantie } from "@/services/portailMembre.service";

// Mes garanties (2026-08) — voir demande utilisateur. Lecture seule,
// Contrat.garanties de l'assuré connecté, taux résolu côté serveur selon
// typeAssure (voir PortailMembreController.garanties).
export default function MembreGarantiesView() {
  const [garanties, setGaranties] = useState<MembreGarantie[] | null>(null);

  useEffect(() => { getMesGaranties().then(setGaranties); }, []);

  const groupes = garanties
    ? [...new Set(garanties.map((g) => g.categorie))].map((cat) => ({
        categorie: cat,
        lignes: garanties.filter((g) => g.categorie === cat),
      }))
    : [];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Mes garanties</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Taux de couverture et plafonds de votre contrat</p>
      </div>

      {!garanties ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : groupes.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucune garantie renseignée sur votre contrat.</div>
      ) : (
        <div className="space-y-3">
          {groupes.map((g) => (
            <div key={g.categorie} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-primary/10 border-b border-border flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="text-[13px] font-semibold text-foreground uppercase tracking-wide">{g.categorie}</p>
              </div>
              <div className="divide-y divide-border/60">
                {g.lignes.map((l) => (
                  <div key={l.id} className="px-4 py-3">
                    <p className="text-[13px] text-foreground font-medium">{l.libelle}</p>
                    <div className="flex items-center justify-between mt-1.5 text-[12px] text-muted-foreground">
                      <span>Taux : <span className="text-foreground font-semibold">{l.tauxApplicable != null ? `${l.tauxApplicable}%` : "—"}</span></span>
                      <span>{l.plafond ?? (l.plafondMontant != null ? `${l.plafondMontant} FCFA` : "Sans plafond")}{l.plafondPeriode ? ` / ${l.plafondPeriode}` : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
