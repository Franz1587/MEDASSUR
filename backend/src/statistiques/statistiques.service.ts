import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { genererAnalyseNarrative } from "./analyse-narrative.util";
import { resoudreRubriqueContrat } from "../actes-medicaux/rubrique-contrat.util";
import type {
  ConsommationLigne, DetailFamille, DetailPrestataire, RepartitionBeneficiaireLigne, RepartitionLigne, RepartitionSousGroupe,
  SpBloc, StatistiquesPayload,
} from "./statistiques.types";

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function parseDateFr(d: string): Date {
  const [j, m, a] = d.split("/").map(Number);
  return new Date(a, (m || 1) - 1, j || 1);
}

function moisLabel(d: Date): string {
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// "Montant consommé" = ce que l'assurance a réellement remboursé (voir
// mémoire "Montant = net à payer") — jamais les frais réels bruts.
function montantLigne(p: { montant: unknown; baseRemboursement: unknown }): number {
  return Number(p.baseRemboursement ?? p.montant);
}

// Tranche/Régularisation — mécanisme CompagnieClauseAjustement (voir
// demande utilisateur : "l'ajustement de prime de chaque compagnie par
// rapport au rapport sinistres/primes"). Un S/P sous la première tranche
// connue (ex. clauses commençant à 55% pour une compagnie donnée) tombe
// dans une zone saine par défaut, sans régularisation.
function trouverTranche(ratio: number, clauses: { spMin: unknown; spMax: unknown; tauxAjustement: unknown }[]): { tranche: string; regularisationPct: number } {
  const formatBorne = (v: number) => `${Math.round(v * 100)} %`;
  const clause = clauses.find((c) => ratio >= Number(c.spMin) && (c.spMax === null || ratio <= Number(c.spMax)));
  if (clause) {
    const min = Number(clause.spMin), max = clause.spMax === null ? null : Number(clause.spMax);
    const tranche = max === null ? `Supérieur ou égal à ${formatBorne(min)}` : min === 0 ? `Inférieur ou égal à ${formatBorne(max)}` : `${formatBorne(min)} – ${formatBorne(max)}`;
    return { tranche, regularisationPct: Number(clause.tauxAjustement) };
  }
  const premiereBorne = clauses.length > 0 ? Number(clauses[0].spMin) : 1;
  return { tranche: `0 – ${formatBorne(premiereBorne)}`, regularisationPct: 0 };
}

@Injectable()
export class StatistiquesService {
  constructor(private prisma: PrismaService) {}

  async calculer(contratId: string, du?: string, au?: string): Promise<StatistiquesPayload> {
    const contrat = await this.prisma.contrat.findUnique({
      where: { id: contratId },
      include: { client: true, compagnie: { include: { clausesAjustement: { orderBy: { ordre: "asc" } } } }, garanties: { select: { categorie: true } } },
    });
    if (!contrat) throw new NotFoundException(`Contrat ${contratId} introuvable`);

    // "Date d'effet" des Bases Contractuelles = date d'effet de l'exercice
    // EN COURS, pas la date de création du contrat (voir demande
    // utilisateur : "il s'agit de la date d'effet du contrat pour chaque
    // exercice et non la date de création du contrat") — un contrat
    // renouvelé plusieurs fois a un Exercice par renouvellement
    // (AvenantsService, branche "Renouvellement"), chacun avec sa propre
    // dateDebut. Repli sur contrat.dateDebut si aucun Exercice n'existe
    // (contrats créés avant l'introduction de ce modèle).
    const exerciceCourant = await this.prisma.exercice.findFirst({ where: { contratId }, orderBy: { numero: "desc" } });
    const dateEffetExercice = exerciceCourant?.dateDebut ?? contrat.dateDebut;

    const duEff = du || contrat.dateDebut;
    const auEff = au || contrat.dateFin;
    const duDate = parseDateFr(duEff);
    const auDate = parseDateFr(auEff);

    // `select` ciblé plutôt que `include: { assure: true, prestataireRef:
    // true }` (2026-09 — voir demande utilisateur : "l'application devient
    // lente... peu importe le poids et le flux, [les données] doivent
    // pouvoir remonter rapidement"). Mesuré en conditions réelles (contrat
    // à 15 818 lignes, EXPLAIN ANALYZE) : la requête SQL elle-même
    // s'exécute en ~13ms (index sur contratId déjà présent) — le temps
    // observé côté Prisma (2 à 4s avec `include`) est presque entièrement
    // de l'HYDRATATION côté Node de la trentaine de champs de
    // PriseEnCharge (dont plusieurs Decimal, chacun enveloppé dans un
    // objet decimal.js) × la fiche AssureSante COMPLÈTE × la fiche
    // Prestataire COMPLÈTE pour CHAQUE ligne — alors que cette fonction ne
    // lit qu'une poignée de champs (voir montantLigne/resoudreFamille/
    // libelleActe ci-dessous et la boucle d'agrégation). Réduire aux seuls
    // champs réellement utilisés a mesurablement réduit ce coût (~2-3x sur
    // la requête isolée) — mais une hydratation Prisma pour 15 000+ lignes
    // Decimal reste intrinsèquement plus lente qu'une requête SQL brute ;
    // un passage à `$queryRaw` supprimerait le reste de cet écart mais est
    // un changement plus risqué (mapping manuel, perte de la sécurité de
    // type Prisma), volontairement laissé de côté ici.
    // Rejeté ET Annulé exclus (2026-09) — voir demande utilisateur : "le
    // cumul de la police n'est pas harmonisé avec le reste des données de
    // la police" ; cette requête n'excluait jusqu'ici AUCUN statut, à la
    // différence des contrôles de plafond (SanteService.verifierPlafondPartage/
    // calculerPartPlafonnee), qui excluaient déjà Rejeté.
    const toutesLesLignes = await this.prisma.priseEnCharge.findMany({
      where: { contratId, statut: { notIn: ["Rejeté", "Annulé"] } },
      select: {
        date: true, montant: true, baseRemboursement: true, assureId: true, type: true, acteMedicalId: true, prestataire: true,
        assure: { select: { id: true, familleId: true, matricule: true, nom: true, prenom: true, typeAssure: true, sexe: true } },
        prestataireRef: { select: { nom: true } },
      },
    });
    // Filtrage par période + collecte de racinesId en UN SEUL passage
    // (2026-09 — voir demande utilisateur : "l'application devient
    // lente... valable pour... la génération [de documents]"). La version
    // précédente enchaînait ~11 passages successifs sur `lignes` (un par
    // agrégation : mois/année/famille/bénéficiaire/rubrique/détail
    // famille/prestataire/détail prestataire), en plus d'un .filter()/
    // .map() séparé rien que pour ce premier tri — fusionnés ici en 2
    // passages seulement (celui-ci + l'agrégation combinée plus bas), un
    // gain réel sur les contrats à fort volume (jusqu'à 15 000+ lignes
    // constatées cette même session).
    const lignes: typeof toutesLesLignes = [];
    const racinesId = new Set<string>();
    for (const p of toutesLesLignes) {
      const d = parseDateFr(p.date);
      if (d >= duDate && d <= auDate) {
        lignes.push(p);
        racinesId.add(p.assure.familleId ?? p.assure.id);
      }
    }

    // ── Consommation par famille (racine + tous ses membres) ─────────
    const racines = await this.prisma.assureSante.findMany({ where: { id: { in: [...racinesId] } }, select: { id: true, nom: true, matricule: true } });
    const racineParId = new Map(racines.map((r) => [r.id, r]));

    // ── Consommation par Rubrique (2026-09 — voir demande utilisateur :
    // "il faut trouver les correspondances de ces rubriques dans le
    // tableau de garanties"). Priorité à ActeMedical.categorieGarantie —
    // le champ créé précisément pour rattacher un acte à une catégorie du
    // TABLEAU DE GARANTIES du contrat (voir Garantie.categorie/
    // GarantieCatalogue.categorie, même valeurs : Consultation/Divers,
    // Dentisterie, Hospitalisation, Maternité, Optique, Kinésithérapie &
    // Cure thermale, Transport, Autre) — c'est cette rubrique-là qui
    // correspond à un plafond/taux réel affiché sur le contrat, jamais
    // ActeMedical.famille (regroupement catalogue plus fin, ex. "EXAMENS
    // LABORATOIRE", sans équivalent direct dans le tableau de garanties).
    // Repli sur famille puis sur le libellé brut UNIQUEMENT quand l'acte
    // n'a encore aucune categorieGarantie renseignée (voir commentaire du
    // schéma : "nullable, toute famille n'a pas forcément d'équivalent
    // direct").
    const actes = await this.prisma.acteMedical.findMany({ select: { id: true, libelle: true, famille: true, categorieGarantie: true } });
    const acteInfoParActeId = new Map(actes.map((a) => [a.id, { famille: a.famille, categorieGarantie: a.categorieGarantie }]));
    const libelleParActeId = new Map(actes.map((a) => [a.id, a.libelle]));
    const garantiesContrat = contrat.garanties;
    const resoudreFamille = (p: (typeof lignes)[number]): string =>
      resoudreRubriqueContrat(garantiesContrat, p, p.acteMedicalId ? acteInfoParActeId.get(p.acteMedicalId) : null);
    // Famille D'ACTES (2026-09) — voir demande utilisateur : "consommation
    // par famille des actes (exemple acte ORL, actes du cardiologue,
    // échographie...)" — ActeMedical.famille brut (le regroupement fin du
    // catalogue), jamais categorieGarantie (déjà utilisé par
    // resoudreFamille ci-dessus pour la rubrique du tableau de garanties).
    const familleActeParActeId = new Map(actes.map((a) => [a.id, a.famille]));
    const familleActeParLibelle = new Map(actes.map((a) => [a.libelle.trim().toLowerCase(), a.famille]));
    const resoudreFamilleActe = (p: (typeof lignes)[number]): string => {
      if (p.acteMedicalId) {
        const f = familleActeParActeId.get(p.acteMedicalId);
        if (f) return f;
      }
      const f = familleActeParLibelle.get(p.type.trim().toLowerCase());
      return f ?? p.type.trim() ?? "Non précisé";
    };
    const libelleActe = (p: (typeof lignes)[number]): string => (p.acteMedicalId && libelleParActeId.get(p.acteMedicalId)) || p.type || "Acte non précisé";

    // ── Agrégation combinée (2026-09) — un seul passage sur `lignes` pour
    // TOUTES les rubriques ci-dessous : évolution mensuelle/annuelle,
    // consommation par famille/bénéficiaire/rubrique/prestataire, détails
    // par famille/prestataire. `montantLigne(p)` n'est calculé qu'UNE
    // fois par ligne (auparavant recalculé dans chaque passage séparé).
    let totalConsomme = 0;
    const parMoisKey = new Map<string, { label: string; montant: number }>();
    // TOUS les mois de la période apparaissent, même à 0 F CFA (voir
    // demande utilisateur : "les sinistres de tous les mois ne remontent
    // pas") — un mois sans aucune PriseEnCharge doit rester visible.
    for (let d = new Date(duDate.getFullYear(), duDate.getMonth(), 1); d <= auDate; d.setMonth(d.getMonth() + 1)) {
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      parMoisKey.set(cle, { label: moisLabel(d), montant: 0 });
    }
    const parAnneeKey = new Map<number, number>();
    const parFamille = new Map<string, ConsommationLigne>();
    const parBeneficiaire = new Map<string, { assureIds: Set<string>; montant: number }>();
    const personnesSoigneesIds = new Set<string>();
    const parRubrique = new Map<string, { montant: number; nombre: number }>();
    const parFamilleActe = new Map<string, { montant: number; nombre: number }>();
    const detailParFamilleMap = new Map<string, DetailFamille>();
    const parPrestataire = new Map<string, { montant: number; nombre: number }>();
    const detailParPrestataireMap = new Map<string, DetailPrestataire>();

    for (const p of lignes) {
      const montant = montantLigne(p);
      totalConsomme += montant;

      const d = parseDateFr(p.date);
      const cleMois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const eMois = parMoisKey.get(cleMois) ?? { label: moisLabel(d), montant: 0 };
      eMois.montant += montant;
      parMoisKey.set(cleMois, eMois);

      parAnneeKey.set(d.getFullYear(), (parAnneeKey.get(d.getFullYear()) ?? 0) + montant);

      const racineId = p.assure.familleId ?? p.assure.id;
      const racine = racineParId.get(racineId);
      const eFamille = parFamille.get(racineId) ?? { matricule: racine?.matricule ?? p.assure.matricule, famille: `Famille ${racine?.nom ?? p.assure.nom}`, montant: 0 };
      eFamille.montant += montant;
      parFamille.set(racineId, eFamille);

      const type = p.assure.typeAssure ?? "AS";
      const sexe = p.assure.sexe ?? "M";
      const cleBenef = `${type}|${sexe}`;
      const eBenef = parBeneficiaire.get(cleBenef) ?? { assureIds: new Set<string>(), montant: 0 };
      eBenef.assureIds.add(p.assureId);
      eBenef.montant += montant;
      parBeneficiaire.set(cleBenef, eBenef);
      personnesSoigneesIds.add(p.assureId);

      const rubrique = resoudreFamille(p);
      const eRubrique = parRubrique.get(rubrique) ?? { montant: 0, nombre: 0 };
      eRubrique.montant += montant; eRubrique.nombre += 1;
      parRubrique.set(rubrique, eRubrique);

      const familleActe = resoudreFamilleActe(p);
      const eFamilleActe = parFamilleActe.get(familleActe) ?? { montant: 0, nombre: 0 };
      eFamilleActe.montant += montant; eFamilleActe.nombre += 1;
      parFamilleActe.set(familleActe, eFamilleActe);

      const acteLibelle = libelleActe(p);
      const assureNom = `${p.assure.nom}${p.assure.prenom ? ` ${p.assure.prenom}` : ""}`;

      const eDetailFamille = detailParFamilleMap.get(racineId) ?? {
        matricule: racine?.matricule ?? p.assure.matricule,
        famille: `Famille ${racine?.nom ?? p.assure.nom}`,
        totalFamille: 0,
        lignes: [] as DetailFamille["lignes"],
      };
      eDetailFamille.totalFamille += montant;
      eDetailFamille.lignes.push({ assureNom, date: p.date, acte: acteLibelle, montant });
      detailParFamilleMap.set(racineId, eDetailFamille);

      const nomPrestataire = p.prestataireRef?.nom ?? p.prestataire;
      const ePrestataire = parPrestataire.get(nomPrestataire) ?? { montant: 0, nombre: 0 };
      ePrestataire.montant += montant; ePrestataire.nombre += 1;
      parPrestataire.set(nomPrestataire, ePrestataire);

      const eDetailPrestataire = detailParPrestataireMap.get(nomPrestataire) ?? { prestataire: nomPrestataire, totalPrestataire: 0, lignes: [] as DetailPrestataire["lignes"] };
      eDetailPrestataire.totalPrestataire += montant;
      eDetailPrestataire.lignes.push({ assureNom, date: p.date, acte: acteLibelle, montant });
      detailParPrestataireMap.set(nomPrestataire, eDetailPrestataire);
    }

    const evolutionMensuelle = [...parMoisKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

    // Évolution annuelle — analyse sur plusieurs années (voir demande
    // utilisateur : "il faut que l'application permette aussi de faire une
    // analyse statistique sur plusieurs années").
    const evolutionAnnuelle = [...parAnneeKey.entries()].sort(([a], [b]) => a - b).map(([annee, montant]) => ({ label: String(annee), montant }));

    const consommationParFamille = [...parFamille.values()].sort((a, b) => a.famille.localeCompare(b.famille));
    const top20Consommateurs = [...consommationParFamille].sort((a, b) => b.montant - a.montant).slice(0, 20);

    // ── Répartition par type de bénéficiaire (AS/CJ/EF × F/M) ────────
    const totalPersonnesSoignees = personnesSoigneesIds.size;
    const sousGroupe = (type: string, sexe: string): RepartitionSousGroupe => {
      const e = parBeneficiaire.get(`${type}|${sexe}`);
      const nombre = e?.assureIds.size ?? 0;
      const montant = e?.montant ?? 0;
      return { nombre, montant, pctDepenses: totalConsomme > 0 ? (montant / totalConsomme) * 100 : 0, pctPopulation: totalPersonnesSoignees > 0 ? (nombre / totalPersonnesSoignees) * 100 : 0 };
    };
    const groupeBeneficiaire = (type: "Assurés Principaux" | "Conjoints" | "Enfants", code: string): RepartitionBeneficiaireLigne => {
      const feminin = sousGroupe(code, "F");
      const masculin = sousGroupe(code, "M");
      const nombre = feminin.nombre + masculin.nombre;
      const montant = feminin.montant + masculin.montant;
      return { type, nombre, montant, pctDepenses: totalConsomme > 0 ? (montant / totalConsomme) * 100 : 0, pctPopulation: totalPersonnesSoignees > 0 ? (nombre / totalPersonnesSoignees) * 100 : 0, feminin, masculin };
    };
    const repartitionBeneficiaire = [
      groupeBeneficiaire("Assurés Principaux", "AS"),
      groupeBeneficiaire("Conjoints", "CJ"),
      groupeBeneficiaire("Enfants", "EF"),
    ];

    const consommationParRubrique: RepartitionLigne[] = [...parRubrique.entries()]
      .map(([libelle, v]) => ({ libelle, montant: v.montant, nombre: v.nombre, pct: totalConsomme > 0 ? (v.montant / totalConsomme) * 100 : 0 }))
      .sort((a, b) => b.montant - a.montant);
    const consommationParFamilleActe: RepartitionLigne[] = [...parFamilleActe.entries()]
      .map(([libelle, v]) => ({ libelle, montant: v.montant, nombre: v.nombre, pct: totalConsomme > 0 ? (v.montant / totalConsomme) * 100 : 0 }))
      .sort((a, b) => b.montant - a.montant);

    // ── Détails de Consommation Par Famille (rubrique additionnelle, hors
    // modèle de référence — voir demande utilisateur : "connaître
    // précisément dans chaque famille qui a consommé et pour quel acte...
    // à quelle date") ────────────────────────────────────────────────
    const detailParFamille = [...detailParFamilleMap.values()]
      .map((f) => ({ ...f, lignes: f.lignes.sort((a, b) => parseDateFr(a.date).getTime() - parseDateFr(b.date).getTime()) }))
      .sort((a, b) => a.famille.localeCompare(b.famille));

    // ── Consommation par Prestataire ──────────────────────────────────
    const consommationParPrestataire: RepartitionLigne[] = [...parPrestataire.entries()]
      .map(([libelle, v]) => ({ libelle, montant: v.montant, nombre: v.nombre, pct: totalConsomme > 0 ? (v.montant / totalConsomme) * 100 : 0 }))
      .sort((a, b) => b.montant - a.montant);
    const top20Prestataires = consommationParPrestataire.slice(0, 20);

    // ── Détails de Prestations Par Prestataires (rubrique additionnelle,
    // hors modèle de référence — voir demande utilisateur : nouvelle
    // rubrique "Détails de prestations Par prestataires") ────────────
    const detailParPrestataire = [...detailParPrestataireMap.values()]
      .map((pr) => ({ ...pr, lignes: pr.lignes.sort((a, b) => parseDateFr(a.date).getTime() - parseDateFr(b.date).getTime()) }))
      .sort((a, b) => b.totalPrestataire - a.totalPrestataire);

    // ── Évolution du S/P (sans / avec chargement) ─────────────────────
    // "Primes" = prime NETTE totale (pas la prime TTC) — voir demande
    // utilisateur : prime nette de départ (contrat/exercice) + primes
    // nettes des incorporations - primes nettes des retraits, du début du
    // contrat/exercice jusqu'à la génération. Contrat.primeNette EST déjà
    // ce cumul : chaque Incorporation/Retrait recalcule et réécrit
    // primeNette sur le Contrat via withComputedPrime (voir
    // MouvementsService.ajusterCompteurs) — inutile de resommer les
    // avenants, la valeur courante l'est déjà. Repli sur la prime TTC pour
    // les contrats legacy sans détail de calcul (primeNette alors null).
    //
    // Reprise de données sur une PÉRIODE PASSÉE (2026-09) — voir demande
    // utilisateur : "on puisse aller saisir les primes sur les anciennes
    // périodes afin de rendre possible le calcul du S/P à ces périodes...
    // présentement ce n'est pas encore possible." Contrat.primeNette
    // reflète l'état COURANT du contrat, jamais une ancienne période —
    // pour une période historique (rapport généré sur du/au passés), on
    // privilégie la somme des primeNette des Exercice qui RECOUVRENT
    // cette période (voir ContratsService.mettreAJourPrimeExercice, saisie
    // manuelle par personne + accessoires lors de la reprise), si au moins
    // un exercice porte un détail de prime saisi. Sinon, comportement
    // inchangé (repli sur le cumul courant du contrat).
    // Dates stockées en JJ/MM/AAAA (string) — une comparaison Prisma
    // lte/gte porterait sur l'ordre LEXICOGRAPHIQUE (faux pour ce format,
    // le jour vient avant l'année), d'où un filtrage/recouvrement fait ici
    // en JS avec parseDateFr, comme le reste de ce fichier.
    const tousExercices = await this.prisma.exercice.findMany({ where: { contratId } });
    const exercicesRecouvrant = tousExercices.filter((ex) => parseDateFr(ex.dateDebut) <= auDate && parseDateFr(ex.dateFin) >= duDate);
    const exercicesPeriode = exercicesRecouvrant.filter((ex) => ex.primeNette !== null);
    const primesExercices = exercicesPeriode.reduce((s, ex) => s + Number(ex.primeNette), 0);
    const primes = exercicesPeriode.length > 0 ? primesExercices
      : contrat.primeNette !== null ? Number(contrat.primeNette) : Number(contrat.prime);

    // Exercice(s) déjà clôturé(s) sur la période demandée (2026-09) — voir
    // demande utilisateur : "l'analyse ne devrait pas parler en prévision
    // d'une statistique dont l'exercice est déjà clôturée... ça devrait
    // être une analyse EXACTE quant à la police et ses consommations par
    // rapport aux clauses d'ajustement." Un rapport généré sur une période
    // dont TOUS les exercices recouvrants sont Clôturés n'a plus de "reste
    // d'année" à projeter — voir genererAnalyseNarrative, qui bascule vers
    // un langage rétrospectif/définitif (résultat S/P réel + clause
    // d'ajustement appliquée) au lieu du langage prédictif par défaut
    // (toujours conservé tel quel pour un exercice encore Actif/En
    // renouvellement — comportement inchangé, déjà vérifié en conditions
    // réelles cette session).
    const periodeCloturee = exercicesRecouvrant.length > 0 && exercicesRecouvrant.every((ex) => ex.statut === "Clôturé");
    // Règle confirmée par l'utilisateur : sinistres avec chargement =
    // sinistres + 20% des sinistres, par défaut — reste éditable au cas
    // par cas via Contrat.tauxChargement.
    const tauxChargement = contrat.tauxChargement !== null ? Number(contrat.tauxChargement) : 20;
    const sinistresSansChargement = totalConsomme;
    const sinistresAvecChargement = totalConsomme * (1 + tauxChargement / 100);
    const clauses = contrat.compagnie.clausesAjustement;
    const ratioSans = primes > 0 ? sinistresSansChargement / primes : 0;
    const ratioAvec = primes > 0 ? sinistresAvecChargement / primes : 0;
    const trancheSans = trouverTranche(ratioSans, clauses);
    const trancheAvec = trouverTranche(ratioAvec, clauses);
    const spSansChargement: SpBloc = { sinistres: sinistresSansChargement, primes, ratioPct: ratioSans * 100, ...trancheSans };
    const spAvecChargement: SpBloc = { sinistres: sinistresAvecChargement, primes, ratioPct: ratioAvec * 100, ...trancheAvec };

    // "Garanties" du tableau S/P = taux de couverture clinique PRIVÉE
    // (voir demande utilisateur : "il s'agit des garanties qui sont sur la
    // carte, précisément se concentrer sur les taux des cliniques
    // privées... ambulatoire et hospitalisation, abrégé Hosp:...% Amb:...%")
    // — pas la branche du contrat.
    const formaterTaux = (v: string | null): string => (v ? `${v.replace(/%/g, "").trim()}%` : "—");
    const garantiesPrivees = `Hosp: ${formaterTaux(contrat.tauxHospitalisationPrivee)} Amb: ${formaterTaux(contrat.tauxAmbulatoirePrivee)}`;

    const payloadSansAnalyse = {
      contrat: {
        id: contrat.id, numeroPolice: contrat.numeroPolice ?? contrat.id, client: contrat.client.nom,
        compagnie: contrat.compagnie.nom, branche: contrat.branche, garantiesPrivees,
      },
      periode: { du: duEff, au: auEff },
      basesContractuelles: { college: contrat.client.nom, assureur: contrat.compagnie.nom, policeNumero: contrat.numeroPolice ?? contrat.id, dateEffet: dateEffetExercice },
      evolutionMensuelle, evolutionAnnuelle, totalConsomme, consommationParFamille, detailParFamille, top20Consommateurs,
      repartitionBeneficiaire, totalPersonnesSoignees, consommationParRubrique, consommationParFamilleActe,
      consommationParPrestataire, detailParPrestataire, top20Prestataires, spSansChargement, spAvecChargement,
    };

    const analyse = genererAnalyseNarrative({ ...payloadSansAnalyse, periodeCloturee });

    return { ...payloadSansAnalyse, analyse };
  }

  // Tableau de bord portail client (2026-08) — voir demande utilisateur :
  // "un compteur de prises en charge par rubrique... par an, par mois".
  // Attention : "prise en charge" désigne ici l'ENTENTE PRÉALABLE
  // (AccordPrealable/AccordPrealableLigne — voir demande utilisateur :
  // "lorsque je parle pas de prise en charge je parle de l'entente
  // préalable et non de la saisie des facture"), PAS le modèle PriseEnCharge
  // (lignes de facture/remboursement, utilisé par consommationParRubrique
  // ci-dessus). Compte les LIGNES (un dossier peut porter plusieurs actes,
  // voir AccordPrealableLigne), regroupées par rubrique — ActeMedical.
  // categorieGarantie en priorité, même correspondance avec le tableau de
  // garanties que consommationParRubrique ci-dessus (voir son commentaire
  // pour le détail) — et par date de la demande (AccordPrealable.
  // dateDemande), agrégé sur TOUS les contrats du client à la fois.
  async comptagesPriseEnChargeParRubrique(contratIds: string[]) {
    if (contratIds.length === 0) return { annees: [], rubriques: [], parAnnee: {}, parMois: {} };

    const [dossiers, actes, contrats] = await Promise.all([
      this.prisma.accordPrealable.findMany({
        where: { contratId: { in: contratIds } },
        select: { contratId: true, dateDemande: true, type: true, lignes: { select: { acteMedicalId: true, description: true } } },
      }),
      this.prisma.acteMedical.findMany({ select: { id: true, libelle: true, famille: true, categorieGarantie: true } }),
      this.prisma.contrat.findMany({ where: { id: { in: contratIds } }, select: { id: true, garanties: { select: { categorie: true } } } }),
    ]);
    const acteInfoParActeId = new Map(actes.map((a) => [a.id, { famille: a.famille, categorieGarantie: a.categorieGarantie }]));
    const garantiesParContratId = new Map(contrats.map((c) => [c.id, c.garanties]));
    const resoudreFamille = (contratId: string, l: { acteMedicalId: string | null; description: string }): string =>
      resoudreRubriqueContrat(garantiesParContratId.get(contratId) ?? [], { type: l.description }, l.acteMedicalId ? acteInfoParActeId.get(l.acteMedicalId) : null);
    // Lignes = une par acte (voir AccordPrealableLigne) ; un dossier créé
    // avant l'introduction de ce modèle (aucune ligne) compte quand même
    // comme UN dossier, rattaché à son type de dossier (Hospitalisation |
    // Chirurgie | EVASAN) plutôt qu'un générique "Non précisé", pour ne pas
    // disparaître du décompte tout en restant informatif.
    const lignesAplaties = dossiers.flatMap((d) =>
      d.lignes.length > 0
        ? d.lignes.map((l) => ({ contratId: d.contratId, dateDemande: d.dateDemande, ligne: l }))
        : [{ contratId: d.contratId, dateDemande: d.dateDemande, ligne: { acteMedicalId: null, description: d.type || "Non précisé" } }],
    );

    const MOIS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const anneesSet = new Set<number>();
    const rubriquesSet = new Set<string>();
    const parAnneeMap = new Map<number, Map<string, number>>();
    const parMoisMap = new Map<number, Map<number, Map<string, number>>>();

    for (const { contratId, dateDemande, ligne } of lignesAplaties) {
      const d = parseDateFr(dateDemande);
      const annee = d.getFullYear();
      const mois = d.getMonth();
      const rubrique = resoudreFamille(contratId, ligne);
      anneesSet.add(annee);
      rubriquesSet.add(rubrique);

      const m1 = parAnneeMap.get(annee) ?? new Map<string, number>();
      m1.set(rubrique, (m1.get(rubrique) ?? 0) + 1);
      parAnneeMap.set(annee, m1);

      const m2 = parMoisMap.get(annee) ?? new Map<number, Map<string, number>>();
      const m3 = m2.get(mois) ?? new Map<string, number>();
      m3.set(rubrique, (m3.get(rubrique) ?? 0) + 1);
      m2.set(mois, m3);
      parMoisMap.set(annee, m2);
    }

    const annees = [...anneesSet].sort((a, b) => b - a);
    const rubriques = [...rubriquesSet].sort();

    const parAnnee: Record<number, { rubrique: string; nombre: number }[]> = {};
    for (const [annee, m] of parAnneeMap) {
      parAnnee[annee] = rubriques.map((r) => ({ rubrique: r, nombre: m.get(r) ?? 0 })).filter((x) => x.nombre > 0).sort((a, b) => b.nombre - a.nombre);
    }

    const parMois: Record<number, Array<{ mois: string; [rubrique: string]: string | number }>> = {};
    for (const annee of annees) {
      const moisMap = parMoisMap.get(annee) ?? new Map<number, Map<string, number>>();
      parMois[annee] = Array.from({ length: 12 }, (_, i) => {
        const row: { mois: string; [rubrique: string]: string | number } = { mois: MOIS_COURT[i] };
        for (const r of rubriques) row[r] = moisMap.get(i)?.get(r) ?? 0;
        return row;
      });
    }

    return { annees, rubriques, parAnnee, parMois };
  }
}
