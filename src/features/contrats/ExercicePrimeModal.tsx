import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { toNumber } from "@/lib/decimal";
import { mettreAJourPrimeExercice, getPopulationHistorique, type ExerciceCompagnie, type ExercicePrimeInput } from "@/services/contrats.service";
import { CalculPrimeSection, calculerPrime, tallyByType, type PrimeCalcState } from "@/features/contrats/CalculPrimeSection";

interface Props {
  contratId: string;
  // Id du contrat dont on doit reprendre la population pour ce calcul de
  // prime — le contrat lui-même, SAUF pour une Assistance liée à un
  // contrat Maladie (voir demande utilisateur : "il faut que la
  // population du contrat maladie remonte même au niveau du calcul de la
  // prime, pas juste dans l'onglet population"), où la population réelle
  // vit sous le contrat Maladie lié (même règle que openEdit/popSourceId
  // dans index.tsx). Par défaut = contratId, pour tout appelant qui ne la
  // fournit pas.
  populationContratId?: string;
  exercice: ExerciceCompagnie;
  onClose: () => void;
  onDone: (historique: ExerciceCompagnie[]) => void;
}

type Form = ExercicePrimeInput & { dateDebut: string; dateFin: string };

const num = (v: string | number | null | undefined): number | undefined => (v === null || v === undefined ? undefined : toNumber(v));

// Saisie de la prime détaillée d'un exercice PASSÉ (2026-09) — voir demande
// utilisateur : "dans le cadre de la récupération des données, on puisse
// aller saisir les primes sur les anciennes périodes afin de rendre
// possible le calcul du S/P à ces périodes... mais pour tout calcul de
// prime pour les périodes clôturées, il faut faire remonter la population
// déjà liée au contrat" — jamais resaisir à la main des effectifs que
// l'application connaît déjà. Réutilise EXACTEMENT le même composant/
// moteur que la création de Contrat/Avenant (CalculPrimeSection,
// calculerPrime) avec le même mécanisme de verrouillage de population
// (populationLock) que ceux-ci, mais la population vient ici de
// `reconstituerPopulation` (voir getPopulationHistorique) sur les dates
// DE CET EXERCICE précis plutôt que de la population actuelle du contrat.
export default function ExercicePrimeModal({ contratId, populationContratId, exercice, onClose, onDone }: Props) {
  const [form, setForm] = useState<Form>({
    dateDebut: exercice.dateDebut, dateFin: exercice.dateFin,
    nombreAssuresPrincipaux: exercice.nombreAssuresPrincipaux ?? undefined,
    primeUnitaireAssurePrincipal: num(exercice.primeUnitaireAssurePrincipal),
    nombreConjoints: exercice.nombreConjoints ?? undefined,
    primeUnitaireConjoint: num(exercice.primeUnitaireConjoint),
    nombreEnfants: exercice.nombreEnfants ?? undefined,
    primeUnitaireEnfant: num(exercice.primeUnitaireEnfant),
    nombreCouples: exercice.nombreCouples ?? undefined,
    primeUnitaireCouple: num(exercice.primeUnitaireCouple),
    tauxMinoMajoration: num(exercice.tauxMinoMajoration),
    tauxReductionCommerciale: num(exercice.tauxReductionCommerciale),
    montantAccessoires: num(exercice.montantAccessoires),
    tauxCommission: num(exercice.tauxCommission),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargementPopulation, setChargementPopulation] = useState(true);
  const [tally, setTally] = useState({ AS: 0, CJ: 0, EF: 0 });
  const [manualPopulationEntry, setManualPopulationEntry] = useState(false);

  useEffect(() => {
    setChargementPopulation(true);
    getPopulationHistorique(populationContratId ?? contratId, { du: exercice.dateDebut, au: exercice.dateFin })
      // Règle utilisateur (2026-09) : exercice EN COURS → seules les
      // personnes actives comptent (les retirés datés sont ajoutés au
      // prorata par le serveur à l'enregistrement, les autres ignorés) ;
      // exercice passé → toute la population de la période (historique).
      .then((population) => setTally(tallyByType(exercice.statut === "Actif" ? population.filter((p) => p.statut === "Actif") : population)))
      .finally(() => setChargementPopulation(false));
  }, [contratId, populationContratId, exercice.dateDebut, exercice.dateFin]);

  const hasCategorizedPopulation = tally.AS + tally.CJ + tally.EF > 0;
  const populationSourceIsAuto = hasCategorizedPopulation && !manualPopulationEntry;

  useEffect(() => {
    if (!populationSourceIsAuto) return;
    setForm((v) =>
      v.nombreAssuresPrincipaux === tally.AS && v.nombreConjoints === tally.CJ && v.nombreEnfants === tally.EF
        ? v
        : { ...v, nombreAssuresPrincipaux: tally.AS, nombreConjoints: tally.CJ, nombreEnfants: tally.EF },
    );
  }, [populationSourceIsAuto, tally]);

  const calc = calculerPrime(form as PrimeCalcState);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const { dateDebut, dateFin, ...dto } = form;
      const historique = await mettreAJourPrimeExercice(contratId, exercice.numero, dto);
      toast.success(`Prime de l'exercice n°${exercice.numero} mise à jour — utilisée pour le calcul du S/P sur cette période.`);
      onDone(historique);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" />Prime de l'exercice n°{exercice.numero}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{exercice.dateDebut} → {exercice.dateFin} — nécessaire pour calculer le S/P sur cette période (reprise de données)</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {chargementPopulation ? (
            <p className="text-[12px] text-muted-foreground py-4">Chargement de la population de cette période…</p>
          ) : (
            <CalculPrimeSection
              form={form}
              setForm={setForm}
              calc={calc}
              populationLock={hasCategorizedPopulation ? {
                computedAS: tally.AS, computedCJ: tally.CJ, computedEF: tally.EF,
                manualEntry: manualPopulationEntry,
                onToggleManual: () => setManualPopulationEntry((m) => !m),
              } : undefined}
            />
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <div className="text-[12px] text-destructive">{error ?? ""}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
            <button type="button" disabled={submitting || chargementPopulation} onClick={handleSubmit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">
              {submitting ? "Enregistrement…" : "Enregistrer la prime"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
