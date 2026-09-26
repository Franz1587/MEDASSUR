import type { PrismaService } from "../prisma/prisma.service";
import { withComputedPrime, type PrimeInput } from "./prime.util";
import { reconstituerPopulation } from "../mouvements/population-historique.util";

// Prime d'un exercice (2026-09) — écriture UNIQUE partagée par la fenêtre
// "Prime de l'exercice" (ContratsService.mettreAJourPrimeExercice) et par le
// recalcul automatique ci-dessous : exercice, contrat (si exercice courant)
// et avenant de l'exercice restent toujours alignés.
export type PrimeExerciceInput = Omit<PrimeInput, "prime" | "dateDebut" | "dateFin">;

export async function appliquerPrimeExercice(
  prisma: PrismaService, contratId: string, numero: number, dto: PrimeExerciceInput,
  // Montants déjà calculés (prorata des retirés datés, voir recalcul
  // automatique) — sinon calculés ici à partir des effectifs du dto.
  calculImpose?: ReturnType<typeof withComputedPrime>,
) {
  const cible = await prisma.exercice.findFirst({ where: { contratId, numero } });
  if (!cible) return null;
  const contrat = await prisma.contrat.findUnique({ where: { id: contratId }, select: { exerciceNumero: true } });

  const calcule = calculImpose ?? withComputedPrime({ ...dto, dateDebut: cible.dateDebut, dateFin: cible.dateFin });
  const champsPrime = {
    nombreAssuresPrincipaux: dto.nombreAssuresPrincipaux ?? null,
    primeUnitaireAssurePrincipal: dto.primeUnitaireAssurePrincipal ?? null,
    nombreConjoints: dto.nombreConjoints ?? null,
    primeUnitaireConjoint: dto.primeUnitaireConjoint ?? null,
    nombreEnfants: dto.nombreEnfants ?? null,
    primeUnitaireEnfant: dto.primeUnitaireEnfant ?? null,
    nombreCouples: dto.nombreCouples ?? null,
    primeUnitaireCouple: dto.primeUnitaireCouple ?? null,
    tauxMinoMajoration: dto.tauxMinoMajoration ?? null,
    tauxReductionCommerciale: dto.tauxReductionCommerciale ?? null,
    montantAccessoires: dto.montantAccessoires ?? null,
    tauxCommission: dto.tauxCommission ?? null,
    montantCommission: calcule.montantCommission ?? null,
    montantTaxe: calcule.montantTaxe ?? null,
    primeNette: calcule.primeNette ?? null,
    primeTotaleHT: calcule.primeTotaleHT ?? null,
  };
  const prime = calcule.prime !== undefined ? { prime: calcule.prime } : {};

  await prisma.exercice.update({ where: { id: cible.id }, data: { ...champsPrime, ...prime } });
  if (contrat?.exerciceNumero === numero) {
    await prisma.contrat.update({ where: { id: contratId }, data: { ...champsPrime, ...prime } });
  }
  // Avenant (affaire nouvelle / renouvellement) de cet exercice — même
  // synchronisation que la version historique de mettreAJourPrimeExercice.
  const avenantExercice = await prisma.avenant.findFirst({ where: { contratId, exerciceNumero: numero }, orderBy: { createdAt: "desc" } });
  if (avenantExercice && calcule.prime !== undefined) {
    await prisma.avenant.update({ where: { id: avenantExercice.id }, data: { ...champsPrime, primeApres: calcule.prime } });
  }
  return calcule;
}

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

const nb = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));

export interface RecalculPrime {
  contratId: string;
  numeroPolice: string | null;
  exercice: number;
  effectifsAvant: { AS: number; CJ: number; EF: number };
  effectifsApres: { AS: number; CJ: number; EF: number };
  primeAvant: number;
  primeApres: number;
}

// Recalcul de la prime de l'exercice COURANT selon la population réelle
// (2026-09) — voir demande utilisateur : "l'affichage des primes... ça ne
// s'actualise pas systématiquement." Même formule que la fenêtre "Prime de
// l'exercice" (withComputedPrime) : effectifs AS/CJ/EF = personnes actives
// sur la période de l'exercice (population du contrat Maladie lié pour un
// contrat d'Assistance), couples inchangés, primes unitaires et taux déjà
// paramétrés. Ne touche RIEN si aucune prime unitaire n'est
// paramétrée ou si aucune population n'est catégorisée (prime saisie à la
// main), ni si les effectifs n'ont pas changé.
async function recalculerUnContrat(prisma: PrismaService, contratId: string, simulation: boolean): Promise<RecalculPrime | null> {
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { id: true, numeroPolice: true, branche: true, contratMaladieLieId: true, exerciceNumero: true } });
  if (!c) return null;
  const ex = await prisma.exercice.findFirst({ where: { contratId, numero: c.exerciceNumero } });
  // Seul l'exercice EN COURS est recalculé : un exercice passé garde toute
  // sa population (historique des statistiques), réglé via la fenêtre
  // "Prime de l'exercice".
  if (!ex || ex.statut !== "Actif") return null;
  const unitaires = [ex.primeUnitaireAssurePrincipal, ex.primeUnitaireConjoint, ex.primeUnitaireEnfant].map((v) => Number(v ?? 0));
  if (!unitaires.some((u) => u > 0)) return null;

  const source = c.branche === "Assistance" && c.contratMaladieLieId ? c.contratMaladieLieId : c.id;
  const population = await reconstituerPopulation(prisma, source, ex.dateDebut, ex.dateFin);
  // Règle utilisateur (2026-09) pour l'exercice en cours : "il faut ignorer
  // les personnes retirées. Quand une personne est retirée à une période
  // bien précise de l'exercice, sa prime au prorata des jours qui restent à
  // couvrir est ristournée. Mais si on n'a pas la date exacte de son retrait
  // (récupération des données), il ne faut pas comptabiliser les personnes
  // retirées ou résiliées."
  //  - actif → compte entier ;
  //  - retiré avec date connue → compte au prorata des jours couverts ;
  //  - retiré/résilié sans date, suspendu → ne compte pas.
  const debutEx = parseDateFr(ex.dateDebut);
  const finEx = parseDateFr(ex.dateFin);
  const dureeEx = debutEx && finEx ? finEx.getTime() - debutEx.getTime() : 0;
  const tally = { AS: 0, CJ: 0, EF: 0 };
  const equivalents = { AS: 0, CJ: 0, EF: 0 };
  for (const p of population) {
    const t = (p.typeAssure ?? "").toUpperCase();
    if (t !== "AS" && t !== "CJ" && t !== "EF") continue;
    if (p.statutPeriode === "Actif") {
      tally[t]++;
      equivalents[t]++;
    } else if (p.statutPeriode === "Radié" && p.finPresence && debutEx && dureeEx > 0) {
      equivalents[t] += Math.min(1, Math.max(0, (p.finPresence.getTime() - debutEx.getTime()) / dureeEx));
    }
  }
  if (equivalents.AS + equivalents.CJ + equivalents.EF === 0) return null;
  const avant = { AS: ex.nombreAssuresPrincipaux ?? 0, CJ: ex.nombreConjoints ?? 0, EF: ex.nombreEnfants ?? 0 };

  const dto: PrimeExerciceInput = {
    nombreAssuresPrincipaux: tally.AS, primeUnitaireAssurePrincipal: nb(ex.primeUnitaireAssurePrincipal),
    nombreConjoints: tally.CJ, primeUnitaireConjoint: nb(ex.primeUnitaireConjoint),
    nombreEnfants: tally.EF, primeUnitaireEnfant: nb(ex.primeUnitaireEnfant),
    nombreCouples: nb(ex.nombreCouples), primeUnitaireCouple: nb(ex.primeUnitaireCouple),
    tauxMinoMajoration: nb(ex.tauxMinoMajoration), tauxReductionCommerciale: nb(ex.tauxReductionCommerciale),
    montantAccessoires: nb(ex.montantAccessoires), tauxCommission: nb(ex.tauxCommission),
  };
  // Prime calculée sur les ÉQUIVALENTS (prorata des retirés datés) ;
  // les effectifs enregistrés restent les personnes actives (entiers).
  const calcule = withComputedPrime({
    ...dto, nombreAssuresPrincipaux: equivalents.AS, nombreConjoints: equivalents.CJ, nombreEnfants: equivalents.EF,
    dateDebut: ex.dateDebut, dateFin: ex.dateFin,
  });
  const apres = calcule.prime ?? Number(ex.prime);
  const inchange = avant.AS === tally.AS && avant.CJ === tally.CJ && avant.EF === tally.EF && Math.abs(apres - Number(ex.prime)) < 1;
  if (inchange) return null;
  if (!simulation) await appliquerPrimeExercice(prisma, contratId, ex.numero, dto, calcule);
  return { contratId, numeroPolice: c.numeroPolice, exercice: ex.numero, effectifsAvant: avant, effectifsApres: tally, primeAvant: Number(ex.prime), primeApres: apres };
}

// Recalcule le contrat ET les contrats d'Assistance qui partagent sa
// population. Jamais bloquant pour l'opération qui l'a déclenché.
export async function recalculerPrimeSelonPopulation(prisma: PrismaService, contratIds: string[], simulation = false): Promise<RecalculPrime[]> {
  const resultats: RecalculPrime[] = [];
  const dejaFaits = new Set<string>();
  for (const id of contratIds) {
    const lies = await prisma.contrat.findMany({ where: { contratMaladieLieId: id }, select: { id: true } });
    for (const cid of [id, ...lies.map((l) => l.id)]) {
      if (dejaFaits.has(cid)) continue;
      dejaFaits.add(cid);
      try {
        const r = await recalculerUnContrat(prisma, cid, simulation);
        if (r) resultats.push(r);
      } catch (err) {
        console.error("Recalcul de prime impossible", err);
      }
    }
  }
  return resultats;
}
