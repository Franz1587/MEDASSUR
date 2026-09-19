// Taux de taxe sur les primes d'assurance santé — fixe au Gabon.
const TAUX_TAXE_GABON = 0.08;

// Le FCFA n'a pas de sous-unité utilisée en pratique — tout montant
// calculé est arrondi au franc le plus proche, jamais de virgule stockée.
const round = (n: number) => Math.round(n);

export type PrimeInput = {
  prime?: number;
  dateDebut?: string; dateFin?: string;
  nombreAssuresPrincipaux?: number; primeUnitaireAssurePrincipal?: number;
  nombreConjoints?: number; primeUnitaireConjoint?: number;
  nombreEnfants?: number; primeUnitaireEnfant?: number;
  nombreCouples?: number; primeUnitaireCouple?: number;
  tauxMinoMajoration?: number; tauxReductionCommerciale?: number;
  montantAccessoires?: number; tauxCommission?: number;
};

// Dates stockées en JJ/MM/AAAA (string) — un contrat peut être à cheval sur
// deux années civiles, la simple différence de Date le gère nativement.
function parseDateFr(s?: string): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

function daysBetween(dateDebut?: string, dateFin?: string): number | null {
  const debut = parseDateFr(dateDebut);
  const fin = parseDateFr(dateFin);
  if (!debut || !fin) return null;
  return Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
}

// Modélisé sur le tableau de calcul de prime fourni par l'utilisateur :
// Total Nette Prestation = Σ(nombre × prime unitaire) par catégorie, prorata
// temporis au jour (joursCouverts/365 — même règle quelle que soit la
// périodicité choisie, gère nativement un contrat à cheval sur deux années)
// → ajustements mino/majo + réduction commerciale → Prime Totale H.T.
// → Taxe (8% fixe) calculée sur (H.T. + Accessoires) → Prime Totale TTC
// (= `prime`, le champ lu partout ailleurs dans l'app).
// La commission est le prélèvement du courtier/compagnie sur la prime
// H.T. — informative, elle n'est PAS ajoutée à la prime TTC payée par le client.
// Les accessoires restent un montant forfaitaire, non proratisé.
//
// Extrait de contrats.service.ts pour être réutilisable par
// MouvementsService (backend/src/mouvements/mouvements.service.ts), point
// d'entrée unique des ajouts/retraits de population sur un contrat existant
// — que le mouvement vienne de l'écran Contrats ou de l'écran Participants.
// Retour typé explicitement (2026-09) — sans cette annotation, TS infère
// une simple union entre les deux branches (T | T&{...}), ce qui empêche
// tout appelant d'accéder à `.primeNette` etc. sur le résultat sans passer
// par un spread — voir ContratsService.mettreAJourPrimeExercice, qui a
// besoin d'accéder aux champs nommément pour ne persister QUE les colonnes
// calculées de l'Exercice (jamais le contrat entier).
type PrimeCalculee = { primeNette?: number; primeTotaleHT?: number; montantAccessoires?: number; montantTaxe?: number; montantCommission?: number; prime?: number };
export function withComputedPrime<T extends PrimeInput>(dto: T): T & PrimeCalculee {
  const hasPopulation = (dto.nombreAssuresPrincipaux ?? 0) > 0 || (dto.nombreConjoints ?? 0) > 0
    || (dto.nombreEnfants ?? 0) > 0 || (dto.nombreCouples ?? 0) > 0;
  if (!hasPopulation) return dto;

  const totalNetteAnnuelle =
    (dto.nombreAssuresPrincipaux ?? 0) * (dto.primeUnitaireAssurePrincipal ?? 0) +
    (dto.nombreConjoints ?? 0) * (dto.primeUnitaireConjoint ?? 0) +
    (dto.nombreEnfants ?? 0) * (dto.primeUnitaireEnfant ?? 0) +
    (dto.nombreCouples ?? 0) * (dto.primeUnitaireCouple ?? 0);

  const jours = daysBetween(dto.dateDebut, dto.dateFin);
  const facteurProrata = jours !== null && jours > 0 ? jours / 365 : 1;
  const totalNettePrestation = totalNetteAnnuelle * facteurProrata;

  const primeNette = round(totalNettePrestation * (1 + (dto.tauxMinoMajoration ?? 0) / 100) * (1 - (dto.tauxReductionCommerciale ?? 0) / 100));
  const primeTotaleHT = primeNette;
  const montantAccessoires = round(dto.montantAccessoires ?? 0);
  const montantTaxe = round((primeTotaleHT + montantAccessoires) * TAUX_TAXE_GABON);
  const montantCommission = round(primeTotaleHT * ((dto.tauxCommission ?? 0) / 100));
  const prime = primeTotaleHT + montantAccessoires + montantTaxe;

  return { ...dto, primeNette, primeTotaleHT, montantAccessoires, montantTaxe, montantCommission, prime };
}

// Prime "Annuelle" affichée en liste des Contrats (2026-09) — voir demande
// utilisateur : "la prime de la dernière prime active ou de la dernière
// période du contrat même s'il est clôturé" — capture d'écran montrant
// deux contrats Résiliés affichant "0 FCFA" alors qu'ils ont bien eu une
// prime réelle sur un exercice passé (Contrat.prime jamais renseignée,
// cas legacy/reprise). Ne modifie JAMAIS Contrat.prime en base (repli
// d'AFFICHAGE seul, voir ContratsService.findAll) : si la prime du
// contrat lui-même est déjà non nulle, elle prime toujours ; sinon on
// retombe sur la prime du DERNIER exercice (le plus grand numero) qui en
// a une, qu'il soit Actif ou Clôturé — jamais 0 tant qu'un exercice
// connaît une vraie valeur.
export function primeAffichee(primeContrat: unknown, exercices: { numero: number; prime: unknown }[]): unknown {
  if (Number(primeContrat) > 0) return primeContrat;
  const dernierAvecPrime = [...exercices].sort((a, b) => b.numero - a.numero).find((ex) => Number(ex.prime) > 0);
  return dernierAvecPrime ? dernierAvecPrime.prime : primeContrat;
}
