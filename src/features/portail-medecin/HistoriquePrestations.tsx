import { useEffect, useMemo, useState } from "react";
import { History, Search, FileDown } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { LABEL_STATUT_BON, VARIANT_STATUT_BON, statutBonDe } from "@/lib/statutBon";
import {
  getMesPrescriptions, ouvrirFeuilleSoinsPrescription, ouvrirFeuilleExamenPrescription,
  type Prescription,
} from "@/services/portailMedecin.service";

function parseDate(date: string): number {
  const [j, m, a] = date.split("/").map(Number);
  if (!j || !m || !a) return 0;
  return new Date(a, m - 1, j).getTime();
}
function anneeDe(date: string): string {
  return date.split("/")[2] ?? "—";
}

// Non traité / Partiellement traité / Traité (2026-08) — voir demande
// utilisateur : "le statut du bon (Non traité, Partiellement traité,
// Traité)... les mêmes informations doivent apparaître prestataire" — même
// libellé/couleur que le E-carnet Santé (voir src/lib/statutBon.ts).
function statutGlobal(p: Prescription): { label: string; variant: BadgeVariant } {
  if (p.lignes.length === 0) return { label: "—", variant: "neutral" };
  const statut = statutBonDe(p.lignes);
  return { label: LABEL_STATUT_BON[statut], variant: VARIANT_STATUT_BON[statut] };
}

// Historique des prestations (2026-08) — voir demande utilisateur : "un
// autre onglet Historique des prestations pour qu'il voie la liste de ses
// prestations." Liste chronologique de toutes les consultations/prescriptions
// de ce médecin, groupées par année (même convention que Dossiers Patients).
export default function MedecinHistoriquePrestationsView() {
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => { getMesPrescriptions().then(setPrescriptions); }, []);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = [...(prescriptions ?? [])].sort((a, b) => parseDate(b.date) - parseDate(a.date));
    if (!q) return base;
    return base.filter((p) => p.assureNom.toLowerCase().includes(q) || p.assureMatricule.toLowerCase().includes(q));
  }, [prescriptions, recherche]);

  const parAnnee = useMemo(() => {
    const m = new Map<string, Prescription[]>();
    for (const p of filtrees) {
      const annee = anneeDe(p.date);
      if (!m.has(annee)) m.set(annee, []);
      m.get(annee)!.push(p);
    }
    return m;
  }, [filtrees]);
  const annees = useMemo(() => [...parAnnee.keys()].sort((a, b) => Number(b) - Number(a)), [parAnnee]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><History className="w-5 h-5 text-primary" />Historique des prestations</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Toutes vos consultations, groupées par année.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (nom, matricule)…"
          className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
      </div>

      {annees.map((annee) => (
        <div key={annee} className="space-y-2">
          <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">{annee}</p>
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Patient</th>
                  <th className="text-left px-3 py-2">Structure</th>
                  <th className="text-left px-3 py-2">Motifs</th>
                  <th className="text-left px-3 py-2">Lignes</th>
                  <th className="text-left px-3 py-2">Statut</th>
                  <th className="text-left px-3 py-2">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {parAnnee.get(annee)!.map((p) => {
                  const statut = statutGlobal(p);
                  return (
                    <tr key={p.id} className="hover:bg-secondary/25">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.date}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{p.assureNom}</p>
                        <p className="text-[11px] text-muted-foreground">{p.assureMatricule}</p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.prestataireNom}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={p.motifsConsultation.join(", ")}>
                        {p.motifsConsultation.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.lignes.filter((l) => l.type === "Medicament").length} médic. · {p.lignes.filter((l) => l.type === "Examen").length} examen(s)
                      </td>
                      <td className="px-3 py-2"><Badge variant={statut.variant}>{statut.label}</Badge></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {p.numeroFeuilleSoins && (
                            <button type="button" onClick={() => ouvrirFeuilleSoinsPrescription(p.id)} title="Imprimer la feuille de soins" className="text-primary hover:text-primary/70">
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {p.numeroBonExamen && (
                            <button type="button" onClick={() => ouvrirFeuilleExamenPrescription(p.id)} title="Imprimer le bon d'examen" className="text-primary hover:text-primary/70">
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!p.numeroFeuilleSoins && !p.numeroBonExamen && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {prescriptions && filtrees.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-[13px] text-muted-foreground">
          {recherche ? "Aucune prestation ne correspond à cette recherche." : "Aucune prestation enregistrée pour l'instant."}
        </div>
      )}
      {!prescriptions && (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
      )}
    </div>
  );
}
