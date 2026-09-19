import type { Dispatch, ReactNode, SetStateAction } from "react";
import { fmt } from "@/lib/format";
import { calculerAge } from "@/lib/age";

export const TAUX_TAXE_GABON = 0.08;

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export function periodeCouverture(dateDebut: string, dateFin: string): number | null {
  const parse = (s: string) => {
    const [d, m, y] = s.split("/").map(Number);
    return d && m && y ? new Date(y, m - 1, d) : null;
  };
  const debut = parse(dateDebut);
  const fin = parse(dateFin);
  if (!debut || !fin) return null;
  return Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
}

// Champs de calcul de prime seuls (sans dates) — c'est la contrainte
// générique du composant <CalculPrimeSection> ci-dessous : il ne lit jamais
// dateDebut/dateFin lui-même (seul `calc`, déjà calculé par l'appelant, en
// a besoin). Satisfait aussi bien par ContratUpsertInput que par
// AvenantUpsertInput (qui n'a pas de dateDebut propre — un avenant utilise
// dateEffet/dateFin, voir avenants/index.tsx).
export interface PrimeChampsState {
  nombreAssuresPrincipaux?: number;
  primeUnitaireAssurePrincipal?: number;
  nombreConjoints?: number;
  primeUnitaireConjoint?: number;
  nombreEnfants?: number;
  primeUnitaireEnfant?: number;
  nombreCouples?: number;
  primeUnitaireCouple?: number;
  tauxMinoMajoration?: number;
  tauxReductionCommerciale?: number;
  montantAccessoires?: number;
  tauxCommission?: number;
  prime?: number; // repli manuel (Contrats uniquement)
}

// Contrainte de `calculerPrime()` — a besoin des dates pour le prorata.
export interface PrimeCalcState extends PrimeChampsState {
  dateDebut: string;
  dateFin: string;
}

// Surprime d'âge — majoration de la prime unitaire selon la tranche d'âge
// de chaque personne (grille paramétrée sur la compagnie, voir fiche
// Compagnie). Optionnelle, cochée par le producteur : quand elle n'est pas
// activée, ou que la population saisie n'a pas d'âge exploitable, le calcul
// reste la formule classique nombre × prime unitaire.
export type CategoriePopulation = "AS" | "CJ" | "EF";

// Comptage par catégorie — partagé entre la création de contrat/avenant
// (population saisie/importée) et la saisie de prime d'un Exercice passé
// (population reconstituée historiquement, voir ExercicePrimeModal) :
// même règle de classification (typeAssure AS/CJ/EF, tout le reste ignoré)
// dans les deux cas, pour que "population déjà liée au contrat" remonte
// identiquement partout.
export function tallyByType(items: { typeAssure?: string | null }[]): { AS: number; CJ: number; EF: number } {
  const tally = { AS: 0, CJ: 0, EF: 0 };
  for (const item of items) {
    const t = (item.typeAssure ?? "").toUpperCase();
    if (t === "AS" || t === "CJ" || t === "EF") tally[t]++;
  }
  return tally;
}

export interface PersonneAvecAge {
  categorie: CategoriePopulation;
  dateNaissance?: string;
}

export interface SurprimeAgeTranche {
  ageMin: number;
  ageMax: number | null;
  tauxPourcent: number;
}

export interface SurprimeAgeOptions {
  actif: boolean;
  grille: SurprimeAgeTranche[];
  population: PersonneAvecAge[];
}

export function tauxSurprimeAge(age: number | null, grille: SurprimeAgeTranche[]): number {
  if (age === null) return 0;
  return grille.find((t) => age >= t.ageMin && (t.ageMax === null || age <= t.ageMax))?.tauxPourcent ?? 0;
}

// Montant annuel d'une catégorie (AS/CJ/EF), majoré personne par personne
// selon son âge quand la surprime est active. Les "Couples" n'ont pas de
// population individualisée (pas de source d'âge) et restent toujours au
// tarif de base — voir calculerPrime. Si le nombre déclaré diffère de la
// population connue (saisie manuelle partielle, mouvement en cours), les
// personnes en trop restent au tarif de base plutôt que de faire échouer
// le calcul.
function montantCategorie(nombre: number, primeUnitaire: number, categorie: CategoriePopulation, surprime?: SurprimeAgeOptions): number {
  if (!surprime?.actif || surprime.grille.length === 0) return nombre * primeUnitaire;
  const personnesConnues = surprime.population.filter((p) => p.categorie === categorie).slice(0, nombre);
  const totalConnu = personnesConnues.reduce((sum, p) => sum + primeUnitaire * (1 + tauxSurprimeAge(calculerAge(p.dateNaissance), surprime.grille) / 100), 0);
  const inconnues = Math.max(0, nombre - personnesConnues.length);
  return totalConnu + inconnues * primeUnitaire;
}

// Prime unitaire moyenne "chargée" par catégorie, une fois la surprime
// d'âge appliquée — multipliée par le nombre, elle reproduit exactement le
// même total que montantCategorie(). Sert à figer, au moment de la
// soumission du formulaire (Contrats/Avenants), un prix unitaire qui inclut
// déjà la surprime : le recalcul serveur (withComputedPrime, qui ne connaît
// que nombre × prime unitaire, voir backend/src/contrats/prime.util.ts)
// retombe alors sur le même montant que l'aperçu, sans aucun changement
// côté backend.
export function primeUnitairesAvecSurprime<T extends PrimeChampsState>(form: T, surprime: SurprimeAgeOptions) {
  const effectif = (nombre: number | undefined, prix: number | undefined, categorie: CategoriePopulation) => {
    const n = nombre ?? 0;
    return n === 0 ? (prix ?? 0) : montantCategorie(n, prix ?? 0, categorie, surprime) / n;
  };
  return {
    primeUnitaireAssurePrincipal: effectif(form.nombreAssuresPrincipaux, form.primeUnitaireAssurePrincipal, "AS"),
    primeUnitaireConjoint: effectif(form.nombreConjoints, form.primeUnitaireConjoint, "CJ"),
    primeUnitaireEnfant: effectif(form.nombreEnfants, form.primeUnitaireEnfant, "EF"),
  };
}

// Même formule que withComputedPrime côté serveur
// (backend/src/contrats/prime.util.ts) — reproduite ici pour l'aperçu en
// direct, recalculée à chaque frappe. Le serveur reste toujours la source
// d'autorité finale (voir le commentaire "ceinture et bretelles" dans
// ContratsService.create/AvenantsService.create).
export function calculerPrime(form: PrimeCalcState, surprime?: SurprimeAgeOptions) {
  const nombreAssures = form.nombreAssuresPrincipaux ?? 0;
  const nombreConjoints = form.nombreConjoints ?? 0;
  const nombreEnfants = form.nombreEnfants ?? 0;
  const nombreCouples = form.nombreCouples ?? 0;
  const periode = periodeCouverture(form.dateDebut, form.dateFin);
  const facteurProrata = periode !== null && periode > 0 ? periode / 365 : 1;
  const totalSansSurprime =
    nombreAssures * (form.primeUnitaireAssurePrincipal ?? 0) +
    nombreConjoints * (form.primeUnitaireConjoint ?? 0) +
    nombreEnfants * (form.primeUnitaireEnfant ?? 0) +
    nombreCouples * (form.primeUnitaireCouple ?? 0);
  const totalNetteAnnuelle =
    montantCategorie(nombreAssures, form.primeUnitaireAssurePrincipal ?? 0, "AS", surprime) +
    montantCategorie(nombreConjoints, form.primeUnitaireConjoint ?? 0, "CJ", surprime) +
    montantCategorie(nombreEnfants, form.primeUnitaireEnfant ?? 0, "EF", surprime) +
    nombreCouples * (form.primeUnitaireCouple ?? 0);
  const montantSurprimeAge = totalNetteAnnuelle - totalSansSurprime;
  const totalNettePrestation = totalNetteAnnuelle * facteurProrata;
  const primeNette = totalNettePrestation * (1 + (form.tauxMinoMajoration ?? 0) / 100) * (1 - (form.tauxReductionCommerciale ?? 0) / 100);
  const primeTotaleHT = primeNette;
  const montantAccessoires = form.montantAccessoires ?? 0;
  const montantTaxe = (primeTotaleHT + montantAccessoires) * TAUX_TAXE_GABON;
  const montantCommission = primeTotaleHT * ((form.tauxCommission ?? 0) / 100);
  const primeTotaleTTC = primeTotaleHT + montantAccessoires + montantTaxe;
  return {
    nombreAssures, nombreConjoints, nombreEnfants, nombreCouples,
    periode, facteurProrata, totalNetteAnnuelle, totalNettePrestation, montantSurprimeAge,
    primeNette, primeTotaleHT, montantAccessoires, montantTaxe, montantCommission, primeTotaleTTC,
  };
}

// Bloc "Population par catégorie" + ajustements/accessoires/commission +
// Récapitulatif en direct — partagé, à l'identique, entre la création de
// contrat (Affaire Nouvelle) et la création d'avenant : un avenant utilise
// EXACTEMENT le même système de calcul de prime, seule différence, il
// s'applique à un contrat déjà existant. `children` (optionnel) s'insère
// entre le tableau de population et le bloc ajustements — utilisé par
// l'écran Contrats pour son bloc territorialité/limites/plafonds, propre à
// la création de contrat et hors du calcul de prime lui-même.
export interface AccessoireTrancheSuggestion {
  borneMin: number;
  borneMax: number | null;
  montant: number;
}

function trancheAccessoiresSuggeree(primeNette: number, tranches: AccessoireTrancheSuggestion[]): AccessoireTrancheSuggestion | undefined {
  return tranches.find((t) => primeNette >= t.borneMin && (t.borneMax === null || primeNette <= t.borneMax));
}

export function CalculPrimeSection<T extends PrimeChampsState>({
  form, setForm, calc, populationLock, showManualPrimeFallback, children, accessoiresTranches, surprimeAge,
}: {
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
  calc: ReturnType<typeof calculerPrime>;
  populationLock?: { computedAS: number; computedCJ: number; computedEF: number; manualEntry: boolean; onToggleManual: () => void };
  showManualPrimeFallback?: boolean;
  children?: ReactNode;
  // Grille d'accessoires de la compagnie sélectionnée (voir fiche
  // Compagnie) — sert uniquement à suggérer un montant, jamais appliqué
  // sans clic explicite sur "Appliquer" (le champ reste éditable librement).
  accessoiresTranches?: AccessoireTrancheSuggestion[];
  // Surprime d'âge (voir fiche Compagnie) — case à cocher par le
  // producteur, toujours visible (jamais masquée : `disabled`/`raison`
  // expliquent pourquoi elle est grisée plutôt que de la faire disparaître
  // sans explication — compagnie non sélectionnée, grille non paramétrée,
  // ou population sans date de naissance exploitable).
  surprimeAge?: { actif: boolean; onToggle: () => void; disabled: boolean; raison?: string };
}) {
  const suggestionAccessoires = accessoiresTranches && calc.primeNette > 0
    ? trancheAccessoiresSuggeree(calc.primeNette, accessoiresTranches)
    : undefined;
  return (
    <div className="space-y-5">
      <p className="text-[12px] text-muted-foreground">
        Prime calculée par catégorie d'assuré (nombre × prime unitaire), ajustée des minorations/majorations et de la réduction commerciale, puis majorée des accessoires (montant forfaitaire) et de la taxe (8% fixe Gabon).
      </p>

      {populationLock && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px]">
          <span className="text-foreground">
            {populationLock.manualEntry
              ? "Saisie manuelle activée — les effectifs ci-dessous ne sont plus synchronisés avec la population importée/affiliée."
              : `Effectifs Assuré Principal / Conjoint / Enfants repris automatiquement de la population importée et déjà affiliée (${populationLock.computedAS} AS, ${populationLock.computedCJ} CJ, ${populationLock.computedEF} EF).`}
          </span>
          <button type="button" onClick={populationLock.onToggleManual} className="text-primary hover:underline whitespace-nowrap flex-shrink-0">
            {populationLock.manualEntry ? "Revenir à la population importée" : "Saisie manuelle"}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-secondary/30 border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Population par catégorie</div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase">
              <th className="text-left px-4 py-2">Catégorie</th>
              <th className="text-right px-3 py-2 w-28">Nombre</th>
              <th className="text-right px-3 py-2 w-40">Prime unitaire</th>
              <th className="text-right px-4 py-2 w-40">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {([
              ["Assuré Principal", "nombreAssuresPrincipaux", "primeUnitaireAssurePrincipal"],
              ["Conjoint", "nombreConjoints", "primeUnitaireConjoint"],
              ["Enfants", "nombreEnfants", "primeUnitaireEnfant"],
              ["Couples", "nombreCouples", "primeUnitaireCouple"],
            ] as const).map(([label, nombreKey, primeKey]) => {
              const autoLocked = label !== "Couples" && !!populationLock && !populationLock.manualEntry;
              return (
                <tr key={label}>
                  <td className="px-4 py-2 text-foreground">{label}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={form[nombreKey] ?? 0}
                      disabled={autoLocked}
                      onChange={(e) => setForm((v) => ({ ...v, [nombreKey]: Number(e.target.value) }))}
                      className={`${fieldCls} text-right ${autoLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                  </td>
                  <td className="px-3 py-2"><input type="number" value={form[primeKey] ?? 0} onChange={(e) => setForm((v) => ({ ...v, [primeKey]: Number(e.target.value) }))} className={`${fieldCls} text-right`} /></td>
                  <td className="px-4 py-2 text-right font-semibold text-foreground med-num">{fmt((form[nombreKey] ?? 0) * (form[primeKey] ?? 0))}</td>
                </tr>
              );
            })}
            {calc.periode !== null && calc.facteurProrata < 1 && (
              <tr className="bg-amber-500/5">
                <td className="px-4 py-2 text-[12px] text-muted-foreground" colSpan={3}>
                  Prorata temporis : {calc.periode} jour(s) / 365 jours (montants ci-dessus en annuel plein, avant prorata)
                </td>
                <td className="px-4 py-2 text-right text-[12px] text-muted-foreground med-num">× {(calc.facteurProrata * 100).toFixed(1)}%</td>
              </tr>
            )}
            <tr className="bg-secondary/20">
              <td className="px-4 py-2.5 font-semibold text-foreground">Total Nette Prestation{calc.facteurProrata < 1 ? " (proratisée)" : ""}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-foreground med-num">{calc.nombreAssures + calc.nombreConjoints + calc.nombreEnfants + calc.nombreCouples}</td>
              <td />
              <td className="px-4 py-2.5 text-right font-bold text-primary med-num">{fmt(calc.totalNettePrestation)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {surprimeAge && (
        <div className="rounded-lg border border-border px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className={`flex items-center gap-2 text-[13px] text-foreground ${surprimeAge.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" checked={surprimeAge.actif} disabled={surprimeAge.disabled} onChange={surprimeAge.onToggle} className="w-4 h-4 accent-primary" />
              Appliquer la surprime d'âge (grille de la compagnie)
            </label>
            {surprimeAge.actif && calc.montantSurprimeAge > 0 && (
              <span className="text-[12px] font-semibold text-amber-500 med-num whitespace-nowrap">+{fmt(calc.montantSurprimeAge)}</span>
            )}
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            {surprimeAge.raison ?? "Majore la prime unitaire de chaque Assuré Principal/Conjoint/Enfant selon sa tranche d'âge (grille de la compagnie) — les Couples restent au tarif de base."}
          </p>
        </div>
      )}

      {children}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block"><div className={labelCls}>Minoration/Majoration (%)</div><input type="number" step="0.1" value={form.tauxMinoMajoration ?? 0} onChange={(e) => setForm((v) => ({ ...v, tauxMinoMajoration: Number(e.target.value) }))} className={fieldCls} /></label>
        <label className="block"><div className={labelCls}>Réduction commerciale (%)</div><input type="number" step="0.1" value={form.tauxReductionCommerciale ?? 0} onChange={(e) => setForm((v) => ({ ...v, tauxReductionCommerciale: Number(e.target.value) }))} className={fieldCls} /></label>
        <label className="block">
          <div className={labelCls}>Accessoires (montant forfaitaire, FCFA)</div>
          {suggestionAccessoires && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] mb-2">
              <span className="text-foreground">Accessoires suggérés d'après la grille de la compagnie : <strong className="med-num">{fmt(suggestionAccessoires.montant)}</strong></span>
              <button type="button" onClick={() => setForm((v) => ({ ...v, montantAccessoires: suggestionAccessoires.montant }))} className="text-primary hover:underline whitespace-nowrap flex-shrink-0">Appliquer</button>
            </div>
          )}
          <input type="number" value={form.montantAccessoires ?? 0} onChange={(e) => setForm((v) => ({ ...v, montantAccessoires: Number(e.target.value) }))} className={fieldCls} />
          <p className="text-[10.5px] text-muted-foreground mt-1">Communiqué par la compagnie (ou saisi manuellement) — pas un taux.</p>
        </label>
        <div className="rounded-lg border border-border px-3 py-2.5">
          <div className={labelCls}>Taux de taxe (Gabon)</div>
          <div className="text-[16px] font-bold text-foreground med-num">{(TAUX_TAXE_GABON * 100).toFixed(0)}%</div>
          <p className="text-[10.5px] text-muted-foreground mt-0.5">Taux fixe, non modifiable</p>
        </div>
        <label className="block">
          <div className={labelCls}>Taux de commission (%)</div>
          <input type="number" step="0.1" value={form.tauxCommission ?? 0} onChange={(e) => setForm((v) => ({ ...v, tauxCommission: Number(e.target.value) }))} className={fieldCls} />
          <p className="text-[10.5px] text-muted-foreground mt-1">Repris automatiquement du taux paramétré sur la compagnie sélectionnée — modifiable.</p>
        </label>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-secondary/30 border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Récapitulatif</div>
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">Prime Nette Fractionnée</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.totalNettePrestation)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">Prime Nette (réduc./mino./majo.)</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.primeNette)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">Prime Totale H.T.</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.primeTotaleHT)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">Accessoires</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.montantAccessoires)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px]">
            <span className="text-muted-foreground">Taxe ({(TAUX_TAXE_GABON * 100).toFixed(0)}%)</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.montantTaxe)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px] bg-secondary/20">
            <span className="text-muted-foreground">Commission ({form.tauxCommission ?? 0}%) — prélèvement courtier, non ajoutée à la prime</span>
            <span className="font-semibold text-foreground med-num">{fmt(calc.montantCommission)}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-[14px] bg-primary/5">
            <span className="font-semibold text-foreground">Prime Totale TTC</span>
            <span className="font-bold text-primary med-num">{fmt(calc.primeTotaleTTC)}</span>
          </div>
        </div>
      </div>

      {showManualPrimeFallback && calc.primeTotaleTTC <= 0 && (
        <label className="block">
          <div className={labelCls}>Ou saisir une prime manuelle (FCFA) — si population/primes unitaires indisponibles</div>
          <input type="number" value={form.prime ?? 0} onChange={(e) => setForm((v) => ({ ...v, prime: Number(e.target.value) }))} className={fieldCls} />
        </label>
      )}
    </div>
  );
}
