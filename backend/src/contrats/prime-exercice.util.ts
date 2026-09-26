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

type Categorie = "AS" | "CJ" | "EF";
// Personne comptée dans la prime d'un exercice : poids 1 (compte entière)
// ou < 1 (retiré à date connue, prorata des jours couverts).
type PersonnePonderee = { categorie: Categorie; dateNaissance: string | null; poids: number };

function ageALaDate(dateNaissance: string | null, reference: Date | null): number | null {
  const naissance = parseDateFr(dateNaissance);
  if (!naissance || !reference) return null;
  let age = reference.getFullYear() - naissance.getFullYear();
  const m = reference.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < naissance.getDate())) age--;
  return age;
}

function tauxSurprime(age: number | null, grille: { ageMin: number; ageMax: number | null; tauxPourcent: unknown }[]): number {
  if (age === null) return 0;
  const tranche = grille.find((t) => age >= t.ageMin && (t.ageMax === null || age <= t.ageMax));
  return tranche ? Number(tranche.tauxPourcent) : 0;
}

// Personnes comptées pour un exercice. Règles utilisateur (2026-09) :
//  - EXERCICE PASSÉ ou CONTRAT ÉCHU (expiré, résilié, échéance dépassée) :
//    "tout contrat échu calcule la prime sur la base de toute sa
//    population" / "si c'est un ancien exercice, il faut compter toute la
//    population pour avoir l'historique des statistiques" — toute personne
//    présente sur la période compte en entier ;
//  - EXERCICE EN COURS d'un CONTRAT ACTIF : "le principe de prorata ne
//    concerne que les contrats actifs qui ont des assurés et ayants droit
//    radiés ou retirés... sa prime au prorata des jours qui restent à
//    couvrir est ristournée. Mais si on n'a pas la date exacte de son
//    retrait, il ne faut pas les comptabiliser" — actif en entier, retiré
//    daté au prorata, retiré sans date / suspendu non compté.
function personnesComptees(
  population: Awaited<ReturnType<typeof reconstituerPopulation>>,
  toutCompter: boolean, dateDebut: string, dateFin: string,
): PersonnePonderee[] {
  const debut = parseDateFr(dateDebut);
  const fin = parseDateFr(dateFin);
  const duree = debut && fin ? fin.getTime() - debut.getTime() : 0;
  const resultat: PersonnePonderee[] = [];
  for (const p of population) {
    const t = (p.typeAssure ?? "").toUpperCase();
    if (t !== "AS" && t !== "CJ" && t !== "EF") continue;
    if (toutCompter || p.statutPeriode === "Actif") {
      resultat.push({ categorie: t, dateNaissance: p.dateNaissance, poids: 1 });
    } else if (p.statutPeriode === "Radié" && p.finPresence && debut && duree > 0) {
      const poids = Math.min(1, Math.max(0, (p.finPresence.getTime() - debut.getTime()) / duree));
      if (poids > 0) resultat.push({ categorie: t, dateNaissance: p.dateNaissance, poids });
    }
  }
  return resultat;
}

type ExerciceRow = NonNullable<Awaited<ReturnType<PrismaService["exercice"]["findFirst"]>>>;
const aDesPrimesUnitaires = (ex: ExerciceRow) =>
  [ex.primeUnitaireAssurePrincipal, ex.primeUnitaireConjoint, ex.primeUnitaireEnfant].some((v) => Number(v ?? 0) > 0);

// Recalcule UN exercice : effectifs (entiers = personnes comptées en
// entier), prime sur les équivalents (prorata) AVEC surprime d'âge — voir
// demande utilisateur : "Il faut appliquer les surprimes d'âge." La grille
// est celle de la compagnie de l'exercice (sinon du contrat), l'âge est
// celui de chaque personne au début de l'exercice. Les primes unitaires
// enregistrées restent les primes de BASE (la surprime n'est jamais
// incorporée dedans, donc jamais comptée deux fois).
async function recalculerExercice(
  prisma: PrismaService, contratId: string, numeroPolice: string | null, ex: ExerciceRow,
  personnes: PersonnePonderee[], parametres: ExerciceRow, compagnieId: string, simulation: boolean,
): Promise<RecalculPrime | null> {
  const totalPoids = personnes.reduce((s, p) => s + p.poids, 0);
  if (totalPoids === 0 || !aDesPrimesUnitaires(parametres)) return null;

  const grille = await prisma.compagnieSurprimeAge.findMany({ where: { compagnieId: ex.compagnieId ?? compagnieId }, orderBy: { ordre: "asc" } });
  const debut = parseDateFr(ex.dateDebut);
  const unitaire: Record<Categorie, number> = {
    AS: Number(parametres.primeUnitaireAssurePrincipal ?? 0), CJ: Number(parametres.primeUnitaireConjoint ?? 0), EF: Number(parametres.primeUnitaireEnfant ?? 0),
  };
  const entiers: Record<Categorie, number> = { AS: 0, CJ: 0, EF: 0 };
  const equivalents: Record<Categorie, number> = { AS: 0, CJ: 0, EF: 0 };
  const montants: Record<Categorie, number> = { AS: 0, CJ: 0, EF: 0 };
  for (const p of personnes) {
    if (p.poids === 1) entiers[p.categorie]++;
    equivalents[p.categorie] += p.poids;
    montants[p.categorie] += p.poids * unitaire[p.categorie] * (1 + tauxSurprime(ageALaDate(p.dateNaissance, debut), grille) / 100);
  }
  // Prime unitaire "effective" (surprime incluse) par catégorie, pour la
  // formule commune withComputedPrime (prorata de durée, mino/majoration,
  // réduction, accessoires, taxe, commission).
  const effectif = (c: Categorie) => (equivalents[c] > 0 ? montants[c] / equivalents[c] : unitaire[c]);

  const dto: PrimeExerciceInput = {
    nombreAssuresPrincipaux: entiers.AS, primeUnitaireAssurePrincipal: nb(parametres.primeUnitaireAssurePrincipal),
    nombreConjoints: entiers.CJ, primeUnitaireConjoint: nb(parametres.primeUnitaireConjoint),
    nombreEnfants: entiers.EF, primeUnitaireEnfant: nb(parametres.primeUnitaireEnfant),
    nombreCouples: nb(parametres.nombreCouples), primeUnitaireCouple: nb(parametres.primeUnitaireCouple),
    tauxMinoMajoration: nb(parametres.tauxMinoMajoration), tauxReductionCommerciale: nb(parametres.tauxReductionCommerciale),
    montantAccessoires: nb(parametres.montantAccessoires), tauxCommission: nb(parametres.tauxCommission),
  };
  const calcule = withComputedPrime({
    ...dto,
    nombreAssuresPrincipaux: equivalents.AS, primeUnitaireAssurePrincipal: effectif("AS"),
    nombreConjoints: equivalents.CJ, primeUnitaireConjoint: effectif("CJ"),
    nombreEnfants: equivalents.EF, primeUnitaireEnfant: effectif("EF"),
    dateDebut: ex.dateDebut, dateFin: ex.dateFin,
  });
  const avant = { AS: ex.nombreAssuresPrincipaux ?? 0, CJ: ex.nombreConjoints ?? 0, EF: ex.nombreEnfants ?? 0 };
  const apres = calcule.prime ?? Number(ex.prime);
  const unitairesIdentiques = Number(ex.primeUnitaireAssurePrincipal ?? 0) === unitaire.AS && Number(ex.primeUnitaireConjoint ?? 0) === unitaire.CJ && Number(ex.primeUnitaireEnfant ?? 0) === unitaire.EF;
  if (avant.AS === entiers.AS && avant.CJ === entiers.CJ && avant.EF === entiers.EF && unitairesIdentiques && Math.abs(apres - Number(ex.prime)) < 1) return null;
  if (!simulation) await appliquerPrimeExercice(prisma, contratId, ex.numero, dto, calcule);
  return { contratId, numeroPolice, exercice: ex.numero, effectifsAvant: avant, effectifsApres: entiers, primeAvant: Number(ex.prime), primeApres: apres };
}

// Recalcule les exercices d'un contrat selon sa population réelle (voir
// demande utilisateur : "ça ne s'actualise pas systématiquement" et "faire
// remonter les populations vers les précédents exercices, pas seulement
// l'exercice actif, afin d'avoir une statistique complète, S/P y compris").
// Population du contrat Maladie lié pour un contrat d'Assistance.
//  - `inclurePasses` : traite aussi les exercices antérieurs ;
//  - `repriseDepuisActif` : un exercice passé sans population sur sa
//    période ou sans prime unitaire reprend la population ET les
//    paramètres de prime de l'exercice actif ("il faut récupérer la prime
//    de l'exercice actif et également la même population") — réservé au
//    rattrapage explicite, pour qu'un exercice passé ne suive jamais les
//    mouvements courants à chaque import.
async function recalculerUnContrat(
  prisma: PrismaService, contratId: string, simulation: boolean,
  options: { inclurePasses: boolean; repriseDepuisActif: boolean; numeros?: number[] },
): Promise<RecalculPrime[]> {
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { id: true, numeroPolice: true, branche: true, contratMaladieLieId: true, exerciceNumero: true, statut: true, dateFin: true, compagnieId: true } });
  if (!c) return [];
  const exercices = await prisma.exercice.findMany({ where: { contratId }, orderBy: { numero: "asc" } });
  const actif = exercices.find((e) => e.numero === c.exerciceNumero);
  if (!actif) return [];
  const source = c.branche === "Assistance" && c.contratMaladieLieId ? c.contratMaladieLieId : c.id;
  const echu = contratEchu(c);

  const populationActive = personnesComptees(await reconstituerPopulation(prisma, source, actif.dateDebut, actif.dateFin), echu, actif.dateDebut, actif.dateFin);
  const resultats: RecalculPrime[] = [];
  for (const ex of exercices) {
    if (options.numeros && !options.numeros.includes(ex.numero)) continue;
    const estActif = ex.numero === actif.numero;
    if (!estActif && !options.inclurePasses) continue;
    let personnes = estActif ? populationActive : personnesComptees(await reconstituerPopulation(prisma, source, ex.dateDebut, ex.dateFin), true, ex.dateDebut, ex.dateFin);
    let parametres = ex;
    if (!estActif && options.repriseDepuisActif) {
      if (personnes.length === 0) personnes = populationActive.map((p) => ({ ...p, poids: 1 }));
      if (!aDesPrimesUnitaires(ex)) parametres = actif;
    }
    try {
      const r = await recalculerExercice(prisma, contratId, c.numeroPolice, ex, personnes, parametres, c.compagnieId, simulation);
      if (r) resultats.push(r);
    } catch (err) {
      console.error(`Recalcul de prime impossible (exercice ${ex.numero})`, err);
    }
  }
  return resultats;
}

// Contrat échu : statut Expiré/Résilié (ou autre que Actif/En
// renouvellement), ou date d'échéance déjà passée.
export function contratEchu(c: { statut: string; dateFin: string }): boolean {
  if (c.statut !== "Actif" && c.statut !== "En renouvellement") return true;
  const fin = parseDateFr(c.dateFin);
  if (!fin) return false;
  const now = new Date();
  return fin < new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Recalcule le contrat ET les contrats d'Assistance qui partagent sa
// population. Jamais bloquant pour l'opération qui l'a déclenché. Par
// défaut (mouvements, import) : exercice actif + exercices passés qui ont
// leur propre population sur leur période, sans reprise depuis l'actif.
export async function recalculerPrimeSelonPopulation(
  prisma: PrismaService, contratIds: string[], simulation = false,
  options: { inclurePasses?: boolean; repriseDepuisActif?: boolean; numeros?: number[] } = {},
): Promise<RecalculPrime[]> {
  const opts = { inclurePasses: options.inclurePasses ?? true, repriseDepuisActif: options.repriseDepuisActif ?? false, numeros: options.numeros };
  const resultats: RecalculPrime[] = [];
  const dejaFaits = new Set<string>();
  for (const id of contratIds) {
    const lies = await prisma.contrat.findMany({ where: { contratMaladieLieId: id }, select: { id: true } });
    for (const cid of [id, ...lies.map((l) => l.id)]) {
      if (dejaFaits.has(cid)) continue;
      dejaFaits.add(cid);
      try {
        resultats.push(...(await recalculerUnContrat(prisma, cid, simulation, opts)));
      } catch (err) {
        console.error("Recalcul de prime impossible", err);
      }
    }
  }
  return resultats;
}
