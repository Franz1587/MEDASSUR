import { randomUUID } from "crypto";
import ExcelJS from "exceljs";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContratDto } from "./dto/create-contrat.dto";
import { UpdateContratDto } from "./dto/update-contrat.dto";
import { ReplaceGarantiesDto } from "./dto/replace-garanties.dto";
import { MouvementPopulationDto } from "./dto/mouvement-population.dto";
import { BasculerPopulationDto } from "./dto/basculer-population.dto";
import { ImportContratRowDto } from "./dto/import-contrats.dto";
import { UpdateExerciceDto } from "./dto/update-exercice.dto";
import { UpdateExercicePrimeDto } from "./dto/update-exercice-prime.dto";
import { withComputedPrime, primeAffichee } from "./prime.util";
import { MouvementsService } from "../mouvements/mouvements.service";
import { reconstituerPopulation } from "../mouvements/population-historique.util";
import { normaliserDateImport } from "../lib/date-import.util";
import { texteBrutDeCellule } from "../lib/excel-cell.util";
import { correspondApproximativement, meilleurCandidat, motsNonApparies, ressembleAUnParticulier } from "../lib/fuzzy-name-match.util";
import { genererIdNumerique } from "../lib/numeric-id.util";
import { CompagniesService } from "../compagnies/compagnies.service";
import { TenantContext } from "../tenant/tenant-context";

// Import en masse (2026-08) — en-têtes du modèle .xlsx, mêmes conventions
// que ClientsService (correspondance par en-tête, pas par index).
const COLONNES_IMPORT_CONTRAT: { header: string; key: keyof ImportContratRowDto }[] = [
  { header: "Souscripteur (nom exact ou id)", key: "souscripteur" },
  { header: "Compagnie (nom exact ou id)", key: "compagnie" },
  { header: "Branche (Maladie ou Assistance)", key: "branche" },
  { header: "Date d'effet (JJ/MM/AAAA)", key: "dateDebut" },
  { header: "Date d'échéance (JJ/MM/AAAA)", key: "dateFin" },
  { header: "Prime totale (FCFA)", key: "prime" },
  { header: "Statut (Actif, En renouvellement, Expiré)", key: "statut" },
  { header: "Périodicité (Mensuel, Trimestriel, Semestriel, Annuel)", key: "periodicite" },
  { header: "Numéro de police (facultatif — auto si vide)", key: "numeroPolice" },
];

// Le "( … )" de chaque en-tête n'est qu'une indication (format attendu,
// exemple) — jamais exigé au caractère près (voir même correctif sur
// import.service.ts, ImportService.normaliserEntete — texte d'aide altéré
// par un outil tiers dans un vrai fichier utilisateur, faisant échouer la
// reconnaissance d'une colonne entière).
function normaliserEnteteContrat(s: string): string {
  return s.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim().replace(/\s+/g, " ");
}

// Statut d'un contrat importé (2026-08 — voir demande utilisateur :
// "l'import des contrats n'a pas tenu compte des statuts... un contrat en
// 'Terminé' signifie que le contrat n'est plus actif" — précisé ensuite :
// "inactif dans le sens du contrat résilié") — le vocabulaire réel de
// l'application est Actif/En renouvellement/Expiré/Résilié (ce dernier
// normalement atteint via un Avenant "Résiliation", voir
// AvenantsService.appliquer, mais un import direct l'écrit tout aussi
// légitimement — reprise d'antériorité, pas de workflow d'avenant à
// rejouer). Un statut NON reconnu retombait silencieusement sur "Actif" —
// le contraire de ce qu'un statut comme "Terminé" représente — désormais
// traduit vers son équivalent réel avant ce repli.
const STATUTS_CONTRAT_VALIDES = ["Actif", "En renouvellement", "Expiré", "Résilié"];
const SYNONYMES_STATUT_CONTRAT: Record<string, string> = {
  TERMINE: "Résilié",
};
function normaliserStatutContrat(valeur: string | undefined): string {
  const v = (valeur ?? "").trim();
  if (STATUTS_CONTRAT_VALIDES.includes(v)) return v;
  const cle = v.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return SYNONYMES_STATUT_CONTRAT[cle] ?? "Actif";
}

// Découpage en exercices de 12 mois (2026-08) — voir demande utilisateur :
// "pour l'import de contrat, si l'intervalle de date est à cheval entre
// plusieurs années, créer systématiquement plusieurs exercices... sachant
// qu'un contrat d'assurance dure 12 mois." Un import reprenant un
// historique (ex. souscripteur assuré depuis 2023, une seule ligne
// dateDebut=01/01/2023 → dateFin=31/12/2025) doit donc produire 3 lignes
// Exercice successives, jamais une seule qui étirerait un "exercice" sur
// plusieurs années. Le déclencheur est la DURÉE (> 12 mois), pas le simple
// franchissement d'un 31/12 — un contrat "normal" du 01/11 au 31/03 reste
// une seule tranche.
function parseDateFrTranche(s: string): Date | null {
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}
function formatDateFrTranche(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}
// Tacite reconduction (2026-08 — voir demande utilisateur : "un contrat ne
// peut pas être actif au courant d'une année n+1 avec les dates de l'année
// de sa première souscription... créer les exercices en partant de
// l'année de mise en place du contrat, de l'année en cours et du statut
// du contrat") — un contrat encore Actif/En renouvellement se renouvelle
// automatiquement à sa date anniversaire, même si la date de fin déclarée
// dans le fichier importé est déjà dépassée : le DERNIER exercice doit
// couvrir la date du jour, jamais s'arrêter dans le passé pour un contrat
// qui reste actif. Un contrat Expiré/Résilié, lui, s'arrête bien à la date
// déclarée — sa fin met fin à la tacite reconduction. L'exercice courant
// reste une VRAIE période de 12 mois calée sur l'anniversaire (jamais
// tronquée à "aujourd'hui").
function etendrePourTaciteReconduction(debut: Date, finDeclaree: Date, statut: string | undefined): Date {
  const statutActif = statut === "Actif" || statut === "En renouvellement";
  const aujourdHui = new Date();
  if (!statutActif || finDeclaree >= aujourdHui) return finDeclaree;
  const anniversaire = new Date(debut);
  while (anniversaire <= aujourdHui) anniversaire.setFullYear(anniversaire.getFullYear() + 1);
  const finEtendue = new Date(anniversaire);
  finEtendue.setDate(finEtendue.getDate() - 1);
  return finEtendue;
}

function decouperEnExercices(dateDebut: string, dateFin: string, statut?: string): { dateDebut: string; dateFin: string }[] {
  const debut = parseDateFrTranche(dateDebut);
  let finGlobale = parseDateFrTranche(dateFin);
  // Non parsable = laissé tel quel (repli déjà en place ailleurs, jamais
  // ici de tentative de correction). Un intervalle "vide"/inversé
  // (finGlobale <= debut) DOIT quand même passer par la tacite
  // reconduction avant ce repli — sinon un recalibrage repartant du
  // lendemain d'une échéance corrigée (dateDebut === dateFin, voir
  // recalibrerExercice ci-dessous) ne s'étendrait jamais.
  if (!debut || !finGlobale) return [{ dateDebut, dateFin }];
  finGlobale = etendrePourTaciteReconduction(debut, finGlobale, statut);
  if (finGlobale <= debut) return [{ dateDebut, dateFin: formatDateFrTranche(finGlobale) }];

  const tranches: { dateDebut: string; dateFin: string }[] = [];
  let debutTranche = debut;
  while (debutTranche < finGlobale) {
    const finTheorique = new Date(debutTranche);
    finTheorique.setFullYear(finTheorique.getFullYear() + 1);
    finTheorique.setDate(finTheorique.getDate() - 1);
    const finTranche = finTheorique < finGlobale ? finTheorique : finGlobale;
    tranches.push({ dateDebut: formatDateFrTranche(debutTranche), dateFin: formatDateFrTranche(finTranche) });
    debutTranche = new Date(finTranche);
    debutTranche.setDate(debutTranche.getDate() + 1);
  }
  return tranches;
}

@Injectable()
export class ContratsService {
  constructor(private prisma: PrismaService, private mouvements: MouvementsService, private compagnies: CompagniesService) {}

  // `estTest: false` par défaut (2026-09) — voir schema.prisma Contrat.estTest :
  // un contrat de test (famille test prestataire) reste invisible de tout
  // écran/Combobox interne qui liste les contrats, sans exception à
  // prévoir côté appelant.
  async findAll(compagnieId?: string) {
    const contrats = await this.prisma.contrat.findMany({
      where: { estTest: false, ...(compagnieId ? { compagnieId } : {}) },
      include: {
        client: true, compagnie: true, garanties: true,
        // Prime affichée en liste (2026-09) — voir demande utilisateur :
        // "la prime de la dernière prime active ou de la dernière période
        // du contrat même s'il est clôturé" — un contrat Résilié ne doit
        // jamais afficher 0 FCFA sous prétexte que Contrat.prime n'a
        // jamais été renseignée (legacy/reprise), s'il existe un Exercice
        // avec une prime réelle. Seuls numero/statut/prime sont
        // nécessaires (voir primeAffichee ci-dessous).
        exercices: { select: { numero: true, statut: true, prime: true }, orderBy: { numero: "desc" } },
      },
    });
    return contrats.map(({ exercices, ...c }) => ({ ...c, prime: primeAffichee(c.prime, exercices) }));
  }

  async findOne(id: string) {
    const contrat = await this.prisma.contrat.findUnique({
      where: { id },
      include: { client: true, compagnie: true, garanties: true },
    });
    if (!contrat) throw new NotFoundException(`Contrat ${id} introuvable`);
    return contrat;
  }

  // Portail client (2026-08) — un souscripteur ne voit QUE les contrats de
  // son propre Client, tous, sans filtre supplémentaire (voir demande
  // utilisateur : "les seuls contrats auquel un souscripteur client doit
  // avoir accès sont uniquement ses contrats à lui").
  findAllForClient(clientId: string) {
    return this.prisma.contrat.findMany({
      where: { clientId },
      include: { client: true, compagnie: true, garanties: true },
      orderBy: { dateDebut: "desc" },
    });
  }

  async findOneForClient(id: string, clientId: string) {
    const contrat = await this.findOne(id);
    if (contrat.clientId !== clientId) throw new ForbiddenException(`Contrat ${id} inaccessible`);
    return contrat;
  }

  // Numéro de police (2026-08) — référence propre à la compagnie, unique
  // PAR compagnie (voir schema.prisma Contrat.numeroPolice), au format
  // <préfixe fixe de la compagnie><suffixe numérique croissant> — ex. NSIA
  // "1000" + 8545 => "10008545", BGFI ASSURANCES "R060" + 3158 =>
  // "R0603158" (préfixe alphanumérique, voir demande utilisateur — le
  // préfixe est DISTINCT du `code` de la compagnie, les deux ne coïncident
  // pas systématiquement). Calculé à chaque appel à partir du plus GRAND
  // suffixe déjà enregistré pour cette compagnie (jamais un compteur
  // séparé) pour que la reprise d'antériorité (numéros saisis
  // manuellement ou importés en masse, pas forcément dans l'ordre ni sans
  // trous) reste toujours respectée — voir demande utilisateur : "classer
  // par ordre... et à partir du dernier, générer les numéros à la suite".
  // Reste une SIMPLE SUGGESTION, toujours modifiable à la saisie (voir
  // demande utilisateur : "toujours permettre une saisie manuelle").
  async prochainNumeroPolice(compagnieId: string): Promise<string> {
    const compagnie = await this.prisma.compagnie.findUnique({ where: { id: compagnieId }, select: { code: true, prefixeNumeroPolice: true } });
    const prefixe = compagnie?.prefixeNumeroPolice?.trim();

    const contrats = await this.prisma.contrat.findMany({
      where: { compagnieId, numeroPolice: { not: null } },
      select: { numeroPolice: true },
    });

    if (prefixe) {
      // Seuls les numéros commençant par CE préfixe comptent — un
      // historique mélangeant plusieurs formats (avant l'introduction du
      // préfixe, ou saisi différemment) ne doit pas fausser la suite.
      const suffixes = contrats
        .map((c) => c.numeroPolice!)
        .filter((n) => n.startsWith(prefixe))
        .map((n) => Number(n.slice(prefixe.length)))
        .filter((n) => Number.isFinite(n));
      const prochainSuffixe = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 1;
      return `${prefixe}${prochainSuffixe}`;
    }

    // Repli (préfixe non paramétré) — ancien comportement : numéro
    // purement numérique, à partir du plus grand déjà utilisé, ou du code
    // compagnie, ou 1.
    const valeursNumeriques = contrats
      .map((c) => Number(c.numeroPolice))
      .filter((n) => Number.isFinite(n));
    if (valeursNumeriques.length > 0) {
      return String(Math.max(...valeursNumeriques) + 1);
    }
    const codeNumerique = compagnie?.code != null ? Number(compagnie.code) : NaN;
    return String(Number.isFinite(codeNumerique) ? codeNumerique + 1 : 1);
  }

  // Référence lisible (2026-08) — voir demande utilisateur : même code
  // numérique que les souscripteurs ("tu as corrigé le code pour le client
  // D.G.D.I, mais pas pour les contrats importés"). AA (année) + compteur
  // séquentiel sur 4 chiffres, propre compteur "contrat" dans
  // CompteurDocument (jamais partagé avec celui des clients). L'id reste
  // affiché tel quel dans plusieurs écrans/modales (ex. "Gestion des
  // assurés — {contrat.id}") — d'où l'importance qu'il soit lisible ; le
  // vrai "N° Police" propre à chaque compagnie reste `numeroPolice`,
  // distinct et inchangé (voir prochainNumeroPolice ci-dessus).
  private async genererIdContrat(): Promise<string> {
    return genererIdNumerique(this.prisma, "contrat");
  }

  // Affaire Nouvelle : le contrat naît avec exerciceNumero=1 et une ligne
  // Exercice miroir — chaque Renouvellement ultérieur en ajoutera une nouvelle.
  // Type de société (2026-09) — défense en profondeur : une société
  // Mutuelle/Compagnie n'a pas de vrai assureur externe à choisir (voir
  // SocieteAssurance.compagnieInterneId, auto-provisionné à la création) —
  // si le formulaire Contrat n'a pas fourni compagnieId (cas normal pour
  // ces sociétés, le sélecteur y est masqué), on le résout ici plutôt que
  // de faire confiance au frontend seul. Sans effet pour une société
  // Courtier (compagnieInterneId toujours null).
  private async resoudreCompagnieId(compagnieId?: string): Promise<string | undefined> {
    if (compagnieId) return compagnieId;
    const societeId = TenantContext.getSocieteId();
    if (!societeId) return compagnieId;
    const societe = await this.prisma.societeAssurance.findUnique({ where: { id: societeId }, select: { compagnieInterneId: true } });
    return societe?.compagnieInterneId ?? compagnieId;
  }

  async create(dto: CreateContratDto, gestionnaireId?: string) {
    dto.compagnieId = (await this.resoudreCompagnieId(dto.compagnieId)) ?? dto.compagnieId;
    const id = await this.genererIdContrat();
    const data = withComputedPrime(dto);
    const numeroPolice = dto.numeroPolice?.trim() || (await this.prochainNumeroPolice(dto.compagnieId));
    let contrat;
    try {
      contrat = await this.prisma.contrat.create({ data: { id, ...data, numeroPolice, gestionnaireId }, include: { client: true, compagnie: true, garanties: true } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Le numéro de police "${numeroPolice}" est déjà utilisé pour cette compagnie.`);
      }
      throw err;
    }
    await this.prisma.exercice.create({
      data: {
        contratId: id, numero: 1,
        dateDebut: contrat.dateDebut, dateFin: contrat.dateFin,
        periodicite: contrat.periodicite, prime: contrat.prime, statut: "Actif",
      },
    });
    return contrat;
  }

  async update(id: string, dto: UpdateContratDto) {
    const avant = await this.findOne(id);
    const data = withComputedPrime(dto);
    try {
      // Correction de période (2026-09) — voir demande utilisateur : "si on
      // corrige la première période, les autres périodes y compris la
      // période active doivent s'actualiser" (tacite reconduction : un
      // exercice qui se termine un 31/12 doit être suivi d'un exercice
      // reprenant au 01/01 suivant, pas de la date anniversaire du premier
      // exercice). Un simple recopiage direct dateDebut/dateFin → Contrat
      // (version précédente de ce correctif) ne recalculait rien et
      // pouvait même désynchroniser Contrat et Exercice si la date saisie
      // ne respectait pas la tacite reconduction — c'est ce qui faisait
      // "revenir à l'ancienne date" au réaffichage. La période passe donc
      // maintenant par le MÊME moteur de cascade que "corriger l'exercice"
      // (recalibrerExercice ci-dessous), ciblé sur l'exercice actuellement
      // actif (avant.exerciceNumero) : celui-ci recalcule lui-même
      // dateDebut/dateFin/exerciceNumero du contrat en sortie — exclus
      // donc explicitement de cette première écriture pour ne pas les
      // écraser avec la valeur brute, non cascadée.
      if (data.dateDebut !== undefined || data.dateFin !== undefined) {
        const { dateDebut: _dateDebut, dateFin: _dateFin, ...autresChamps } = data;
        await this.prisma.contrat.update({ where: { id }, data: autresChamps });
        await this.recalibrerExercice(id, avant.exerciceNumero, {
          dateDebut: (data.dateDebut ?? avant.dateDebut) as string,
          dateFin: (data.dateFin ?? avant.dateFin) as string,
        });
        await this.appliquerBasculeResiliation(id, avant.statut, data.statut);
        return this.findOne(id);
      }
      const contrat = await this.prisma.contrat.update({ where: { id }, data, include: { client: true, compagnie: true, garanties: true } });
      await this.appliquerBasculeResiliation(id, avant.statut, data.statut);
      return contrat;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Le numéro de police "${dto.numeroPolice}" est déjà utilisé pour cette compagnie.`);
      }
      throw err;
    }
  }

  // Statuts de contrat considérés "inactifs" — voir aussi
  // dashboard.service.ts (contratsInactifs = contratsExpires + contratsResilies),
  // même vocabulaire. "En renouvellement" reste un contrat en vigueur,
  // jamais traité comme inactif ici.
  private static readonly STATUTS_CONTRAT_INACTIFS = ["Résilié", "Expiré"];

  // Bascule population Actif/Suspendu au fil d'un changement direct de
  // statut (2026-09) — voir demande utilisateur : "dès qu'un contrat est
  // terminé ou résilié, les assurés et les ayants droit passent directement
  // en statut inactif." Couvrait jusqu'ici UNIQUEMENT "Résilié" (voir
  // demande utilisateur d'origine : "si un contrat est résilié, toute sa
  // population passe en inactif") — élargi ici à "Expiré" (un contrat
  // arrivé à échéance sans renouvellement est tout aussi "terminé" pour sa
  // population). Même règle que le "type Résiliation" d'AvenantsService.
  // appliquer (voir ce fichier), mais ici pour le changement de statut fait
  // directement depuis l'onglet Informations générales (select Statut)
  // plutôt que par avenant. Symétrique : sortir un contrat d'un statut
  // inactif réactive sa population — sinon un statut corrigé par erreur
  // laisserait tout le monde bloqué en "Suspendu" sans action de rattrapage
  // possible. Jamais les personnes déjà "Radié" (sortie définitive,
  // distincte de cette bascule réversible).
  private async appliquerBasculeResiliation(contratId: string, statutAvant: string, statutApres: string | undefined) {
    if (statutApres === undefined || statutApres === statutAvant) return;
    const etaitInactif = ContratsService.STATUTS_CONTRAT_INACTIFS.includes(statutAvant);
    const devientInactif = ContratsService.STATUTS_CONTRAT_INACTIFS.includes(statutApres);
    if (devientInactif && !etaitInactif) {
      await this.prisma.assureSante.updateMany({ where: { contratId, statut: { not: "Radié" } }, data: { statut: "Suspendu" } });
    } else if (etaitInactif && !devientInactif) {
      await this.prisma.assureSante.updateMany({ where: { contratId, statut: "Suspendu" }, data: { statut: "Actif" } });
    }
  }

  // Dérogation de saisie post-résiliation (2026-09) — voir demande
  // utilisateur : bouton "Permettre la saisie des prestations et des
  // prises en charge après la date de résiliation ou fermeture des
  // droits." Purement déclaratif (aucun impact sur statut/dates) : lu par
  // SanteService.verifierSaisieAutorisee pour lever temporairement le
  // blocage par date sur ce contrat précis, à désactiver manuellement une
  // fois la saisie terminée.
  async toggleDerogationSaisie(id: string, autoriser: boolean) {
    await this.findOne(id);
    return this.prisma.contrat.update({ where: { id }, data: { saisieApresResiliationAutorisee: autoriser } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.contrat.delete({ where: { id } });
    return { id };
  }

  async replaceGaranties(id: string, dto: ReplaceGarantiesDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.garantie.deleteMany({ where: { contratId: id } }),
      this.prisma.garantie.createMany({ data: dto.garanties.map((g) => ({ ...g, contratId: id })) }),
    ]);
    return this.findOne(id);
  }

  // Écran dédié "Gestion des assurés" (distinct de la création du contrat) —
  // ajoute et/ou retire des personnes sur un contrat déjà existant. Simple
  // wrapper : toute la logique (création/radiation douce, compteurs de
  // population/prime, avenant + traçabilité structurée par personne) vit
  // dans MouvementsService, point d'entrée UNIQUE partagé avec les actions
  // individuelles de l'écran Participants (voir backend/src/mouvements) —
  // les deux écrans doivent produire exactement la même traçabilité.
  async mouvementPopulation(id: string, dto: MouvementPopulationDto) {
    await this.findOne(id);
    const { contrat, avenants } = await this.mouvements.appliquerMouvement(
      id,
      dto.dateEffet,
      (dto.ajouts ?? []).map((a) => ({
        nom: a.nom, prenom: a.prenom, matricule: a.matricule, beneficiaires: a.beneficiaires,
        cotisation: a.cotisation, dateNaissance: a.dateNaissance, typeAssure: a.typeAssure,
      })),
      (dto.retraitIds ?? []).map((assureId) => ({ assureId, motif: "Retrait (avenant)" })),
    );
    return { contrat, avenants };
  }

  // Bascule de tout ou partie de la population de ce contrat vers un
  // autre — voir MouvementsService.basculerPopulationVersContrat (cas
  // typique : contrat résilié dont la population, jamais radiée
  // automatiquement, est reprise des années plus tard par un nouveau
  // contrat, même souscripteur ou un autre).
  async basculerPopulation(id: string, dto: BasculerPopulationDto) {
    await this.findOne(id);
    return this.mouvements.basculerPopulationVersContrat(id, dto.contratDestinationId, dto.assureIds, dto.dateEffet);
  }

  // Historique "quelle compagnie à quelle période" — voir Exercice.compagnieId
  // et AvenantsService.appliquer (type "Changement de Compagnie"), qui
  // scinde l'exercice en cours plutôt que d'écraser l'historique.
  async historiqueCompagnie(id: string) {
    await this.findOne(id);
    return this.prisma.exercice.findMany({
      where: { contratId: id },
      orderBy: { createdAt: "asc" },
      include: { compagnie: true },
    });
  }

  // Correction manuelle d'un exercice + recalibrage en cascade (2026-08 —
  // voir demande utilisateur : "il peut arriver que les données de
  // l'import de date d'un exercice ne soit pas correct, on doit pouvoir
  // aller modifier pour que l'application fasse un récalibrage au niveau
  // des échéances et des dates d'effet"). L'exercice visé garde les dates
  // données TELLES QUELLES (aucune contrainte de durée) ; tout ce qui le
  // suivait est supprimé puis régénéré depuis sa nouvelle échéance — même
  // moteur que l'import (decouperEnExercices/tacite reconduction), pour
  // qu'un contrat encore Actif/En renouvellement continue de couvrir la
  // date du jour, et qu'un contrat Résilié/Expiré s'arrête bien là.
  async recalibrerExercice(contratId: string, numero: number, dto: UpdateExerciceDto) {
    const contrat = await this.findOne(contratId);
    const cible = await this.prisma.exercice.findFirst({ where: { contratId, numero } });
    if (!cible) throw new NotFoundException(`Exercice n°${numero} introuvable pour ce contrat.`);

    const dateDebut = normaliserDateImport(dto.dateDebut) || dto.dateDebut;
    const dateFin = normaliserDateImport(dto.dateFin) || dto.dateFin;
    const finCorrigee = parseDateFrTranche(dateFin);
    if (!parseDateFrTranche(dateDebut) || !finCorrigee) {
      throw new BadRequestException("Dates invalides — format attendu JJ/MM/AAAA.");
    }

    const statutActif = contrat.statut === "Actif" || contrat.statut === "En renouvellement";
    const debutSuivant = new Date(finCorrigee);
    debutSuivant.setDate(debutSuivant.getDate() + 1);
    const aujourdHui = new Date();

    // Tranches à recréer après l'exercice corrigé — uniquement si le
    // contrat est encore actif ET qu'il reste effectivement un écart
    // jusqu'à aujourd'hui (sinon l'exercice corrigé redevient lui-même le
    // dernier, rien à régénérer après).
    const tranchesSuivantes = statutActif && debutSuivant <= aujourdHui
      ? decouperEnExercices(formatDateFrTranche(debutSuivant), formatDateFrTranche(debutSuivant), contrat.statut)
      : [];

    await this.prisma.$transaction([
      this.prisma.exercice.update({ where: { id: cible.id }, data: { dateDebut, dateFin } }),
      this.prisma.exercice.deleteMany({ where: { contratId, numero: { gt: numero } } }),
    ]);

    if (tranchesSuivantes.length > 0) {
      await this.prisma.exercice.createMany({
        data: tranchesSuivantes.map((t, idx) => ({
          contratId, numero: numero + 1 + idx,
          dateDebut: t.dateDebut, dateFin: t.dateFin,
          periodicite: cible.periodicite, prime: cible.prime, compagnieId: cible.compagnieId,
          statut: idx === tranchesSuivantes.length - 1 ? "Actif" : "Clôturé",
        })),
      });
    } else {
      await this.prisma.exercice.update({ where: { id: cible.id }, data: { statut: statutActif ? "Actif" : "Clôturé" } });
    }

    const dernier = tranchesSuivantes[tranchesSuivantes.length - 1] ?? { dateDebut, dateFin };
    await this.prisma.contrat.update({
      where: { id: contratId },
      data: { dateDebut: dernier.dateDebut, dateFin: dernier.dateFin, exerciceNumero: numero + tranchesSuivantes.length },
    });

    return this.historiqueCompagnie(contratId);
  }

  // Saisie de la prime détaillée d'un exercice PASSÉ (2026-09) — voir
  // demande utilisateur : "dans le cadre de la récupération des données,
  // on puisse aller saisir les primes sur les anciennes périodes afin de
  // rendre possible le calcul du S/P à ces périodes... renseigner la
  // prime par personne et les accessoires et l'outil calculera la prime
  // nette totale." Réutilise EXACTEMENT le même moteur de calcul que la
  // prime du contrat lui-même (withComputedPrime, prime.util.ts) — même
  // prorata au jour sur les dates de CET exercice — mais persiste le
  // résultat sur l'Exercice, jamais sur le Contrat (qui garde sa propre
  // prime courante intacte). Voir StatistiquesService.calculer, qui lit
  // désormais cette primeNette d'exercice pour le S/P d'une période passée
  // au lieu de toujours retomber sur Contrat.primeNette.
  // Synchronisation Contrat/Avenant (2026-09) — voir demande utilisateur :
  // "l'application ne fait pas remonter [la reprise de données/la saisie
  // manuelle des primes] sur les documents de quittance, avenant, tableau
  // de garanties, comme si les choses n'étaient pas liées... l'information
  // doit être la même peu importe l'écran". Jusqu'ici cette fonction
  // n'écrivait QUE sur Exercice, que la Quittance/l'Avenant/le Tableau de
  // garanties (documents.service.ts) ne lisent JAMAIS — Exercice/
  // primeNette n'a aucun lecteur documentaire. Corrigé pour recopier la
  // même donnée à l'endroit que chaque document lit réellement :
  //  - Contrat (si l'exercice corrigé est l'exercice EN COURS du contrat) —
  //    lu par la Quittance "Affaire Nouvelle" et le Tableau de garanties.
  //  - Avenant (si un avenant porte ce même exerciceNumero, le plus récent
  //    s'il y en a plusieurs) — lu par la Quittance d'avenant et le
  //    document Avenant. Voulu explicitement pour un exercice PASSÉ aussi
  //    (confirmé par l'utilisateur) : une correction de reprise de données
  //    doit se répercuter y compris sur un document déjà émis, plutôt que
  //    de laisser survivre une valeur périmée.
  async mettreAJourPrimeExercice(contratId: string, numero: number, dto: UpdateExercicePrimeDto) {
    const contrat = await this.findOne(contratId);
    const cible = await this.prisma.exercice.findFirst({ where: { contratId, numero } });
    if (!cible) throw new NotFoundException(`Exercice n°${numero} introuvable pour ce contrat.`);

    const calcule = withComputedPrime({ ...dto, dateDebut: cible.dateDebut, dateFin: cible.dateFin });

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
      // Le calcul complet (primeNette/primeTotaleHT/montantTaxe/
      // montantCommission/prime) n'est produit par withComputedPrime QUE
      // si une population a été saisie (voir hasPopulation) — sinon dto
      // reste tel quel, prime globale de l'exercice inchangée.
      montantCommission: calcule.montantCommission ?? null,
      montantTaxe: calcule.montantTaxe ?? null,
      primeNette: calcule.primeNette ?? null,
      primeTotaleHT: calcule.primeTotaleHT ?? null,
    };

    await this.prisma.exercice.update({
      where: { id: cible.id },
      data: { ...champsPrime, ...(calcule.prime !== undefined ? { prime: calcule.prime } : {}) },
    });

    // Contrat — uniquement si c'est l'exercice EN COURS (jamais un exercice
    // passé : le contrat représente l'état ACTUEL, pas un instantané d'une
    // période révolue).
    if (contrat.exerciceNumero === numero) {
      await this.prisma.contrat.update({
        where: { id: contratId },
        data: { ...champsPrime, ...(calcule.prime !== undefined ? { prime: calcule.prime } : {}) },
      });
    }

    // Avenant — celui qui porte ce même exerciceNumero (le plus récent s'il
    // y en a plusieurs sur la même période, ex. Incorporation puis Retrait) ;
    // `primeApres` reflète désormais la prime corrigée de son exercice,
    // `primeAvant` reste inchangé (ce qu'était la prime AVANT cet avenant
    // précis, non concerné par cette correction).
    const avenantExercice = await this.prisma.avenant.findFirst({ where: { contratId, exerciceNumero: numero }, orderBy: { createdAt: "desc" } });
    if (avenantExercice && calcule.prime !== undefined) {
      await this.prisma.avenant.update({
        where: { id: avenantExercice.id },
        data: { ...champsPrime, primeApres: calcule.prime },
      });
    }

    return this.historiqueCompagnie(contratId);
  }

  // Population reconstituée sur une période passée (voir
  // population-historique.util.ts) + filtre statut — alimente à la fois
  // l'affichage de l'onglet Population (bouton "Rechercher") et les exports
  // PDF/Excel/Word (documents.service.ts, même fonction).
  async populationHistorique(id: string, statut?: string, du?: string, au?: string) {
    await this.findOne(id);
    const personnes = await reconstituerPopulation(this.prisma, id, du, au);
    return statut && statut !== "tous" ? personnes.filter((p) => p.statutPeriode === statut) : personnes;
  }

  // ── Import en masse (2026-08) ────────────────────────────────────────
  // Voir demande utilisateur — même principe que ClientsService : modèle
  // .xlsx, aperçu (dry-run) avant confirmation. Champs minimaux (pas de
  // population/garanties détaillées, complétées au cas par cas ensuite).

  async genererModeleImport(): Promise<Buffer> {
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet("Contrats");
    feuille.columns = COLONNES_IMPORT_CONTRAT.map((c) => ({ header: c.header, key: c.key, width: 30 }));
    feuille.getRow(1).font = { bold: true };
    // Exemple délibérément fictif (2026-08 — voir demande utilisateur :
    // "je viens de faire un test d'import de souscripteur, mais rien ne
    // remonte... vérifie le chemin pour chaque type d'import"). "SOGARA"
    // référençait un VRAI souscripteur déjà en base : un contrat testé
    // avec le modèle tel quel s'y serait RÉELLEMENT rattaché (aucun
    // contrôle anti-doublon sur un contrat, contrairement à Souscripteurs)
    // — pollution silencieuse d'une vraie fiche. Un nom manifestement
    // fictif échoue proprement ("souscripteur introuvable") si laissé tel
    // quel. `prime` en vrai nombre (pas texte), même règle que les autres
    // modèles de cet onglet.
    feuille.addRow({
      souscripteur: "EXEMPLE SOUSCRIPTEUR SARL (à remplacer)", compagnie: "BGFI ASSURANCES", branche: "Maladie",
      dateDebut: "01/01/2026", dateFin: "31/12/2026", prime: 37502719, statut: "Actif", periodicite: "Annuel",
    });
    return classeur.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
  }

  // Souscripteur "AGENCE NATIONALE ... (ANINF)" (2026-08 — voir demande
  // utilisateur : "l'acronyme entre parenthèses révèle le souscripteur tel
  // qu'il existe déjà dans la base") — l'ancien système exporte la raison
  // sociale complète suivie de son sigle entre parenthèses, alors que le
  // souscripteur est enregistré ICI sous le sigle seul ("ANINF"). Repli sur
  // ce sigle uniquement si la valeur telle quelle (id ou nom exact) ne
  // matche rien — jamais prioritaire sur une correspondance directe.
  //
  // Souscripteur "MAUREL & PROM Gabon SA P/C Collège 2 (Non Cadres)"
  // (2026-08 — voir demande utilisateur : "il s'agit du client 'Maurel &
  // Prom'... il a deux contrats répartis en notion de collège, cadres et
  // non-cadres") / "LA POSTE SA", "3M PARTNERS & CONSEILS", "ETUDE MAITRE
  // GEY BEKALE ANNE" (introuvables alors qu'ils existent, voir demande
  // utilisateur — "tous ces souscripteurs existent pourtant") : repli sur
  // un rapprochement APPROXIMATIF (voir fuzzy-name-match.util, tolère mots
  // abrégés/en plus/dans un autre ordre — "SYLVERE DENIS RETENO NDIAYE" /
  // "RETENO NDIAYE SYLVERE DENIS"). Si le nom du souscripteur trouvé est un
  // PRÉFIXE littéral de la valeur importée, le reste est renvoyé comme
  // `produitDetecte` — repris comme Contrat.produit (déjà prévu pour
  // distinguer plusieurs contrats d'un même souscripteur, ex. collèges).
  //
  // Dernier repli (2026-08 — voir demande utilisateur : "quand le nom du
  // contrat est le nom d'un particulier, cela veut dire que le contrat est
  // pour un particulier") : si RIEN ne correspond et que la valeur
  // ressemble à un nom de personne (voir ressembleAUnParticulier), signale
  // qu'un nouveau souscripteur Particulier doit être créé — jamais fait
  // ICI (cette méthode ne doit rien écrire, appelée aussi par l'aperçu) :
  // la création réelle n'a lieu qu'à la confirmation (voir importer()).
  private async resoudreClient(valeur: string): Promise<
    | { statut: "trouve"; client: { id: string; nom: string }; produitDetecte?: string }
    | { statut: "a_creer_particulier"; nom: string }
    | null
  > {
    const direct = await this.prisma.client.findFirst({ where: { OR: [{ id: valeur }, { nom: { equals: valeur, mode: "insensitive" } }] } });
    if (direct) return { statut: "trouve", client: direct };

    const sigle = valeur.match(/\(([^()]+)\)\s*$/)?.[1]?.trim();
    if (sigle) {
      const parSigle = await this.prisma.client.findFirst({ where: { nom: { equals: sigle, mode: "insensitive" } } });
      if (parSigle) return { statut: "trouve", client: parSigle };
    }

    const tousLesClients = await this.prisma.client.findMany({ select: { id: true, nom: true } });
    const client = meilleurCandidat(tousLesClients, (c) => c.nom, valeur);
    if (client) {
      const produitDetecte = motsNonApparies(client.nom, valeur) || undefined;
      return { statut: "trouve", client, produitDetecte };
    }

    if (ressembleAUnParticulier(valeur)) return { statut: "a_creer_particulier", nom: valeur.trim() };
    return null;
  }

  // Compagnie "OGAR ASSURANCES POG" (2026-08 — voir demande utilisateur :
  // "toutes les compagnies qui ont 'POG' sont exactement les mêmes
  // compagnies, la seule différence c'est qu'il s'agit des contrats créés
  // par l'agence de Port-Gentil (POG)") — rapprochement approximatif (voir
  // resoudreClient ci-dessus) parmi les VRAIES compagnies uniquement
  // (jamais un profil Auto-Gestion d'un AUTRE souscripteur).
  //
  // Auto-Gestion (2026-08 — voir demande utilisateur : "quand au niveau de
  // la compagnie, c'est le nom du souscripteur, alors il s'agit d'un
  // contrat en auto-gestion") — si la valeur "compagnie" désigne en
  // réalité le souscripteur DE CETTE LIGNE lui-même, résout (ou signale la
  // création, voir importer()) son profil "compagnie virtuelle" — voir
  // CompagniesService.createAutoGestion, jamais une écriture directe qui
  // court-circuiterait cette logique déjà réelle.
  private async resoudreCompagnie(valeur: string, client?: { id: string; nom: string }): Promise<
    | { statut: "trouve"; compagnie: { id: string; nom: string } }
    | { statut: "a_creer_auto_gestion"; clientId: string }
    | null
  > {
    const direct = await this.prisma.compagnie.findFirst({ where: { OR: [{ id: valeur }, { nom: { equals: valeur, mode: "insensitive" } }] } });
    if (direct) return { statut: "trouve", compagnie: direct };

    const vraiesCompagnies = await this.prisma.compagnie.findMany({ where: { clientId: null }, select: { id: true, nom: true } });
    const compagnie = meilleurCandidat(vraiesCompagnies, (c) => c.nom, valeur);
    if (compagnie) return { statut: "trouve", compagnie };

    if (client && correspondApproximativement(client.nom, valeur)) {
      const existante = await this.prisma.compagnie.findFirst({ where: { clientId: client.id } });
      if (existante) return { statut: "trouve", compagnie: existante };
      return { statut: "a_creer_auto_gestion", clientId: client.id };
    }

    return null;
  }

  async parseImportFile(buffer: Buffer): Promise<{ lignes: ImportContratRowDto[]; rejets: { ligne: number; motif: string }[] }> {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const feuille = classeur.worksheets[0];
    if (!feuille) throw new BadRequestException("Fichier illisible ou vide.");

    const enteteRow = feuille.getRow(1);
    const indexParCle = new Map<keyof ImportContratRowDto, number>();
    enteteRow.eachCell((cell, colNumber) => {
      const norm = normaliserEnteteContrat(String(cell.value ?? ""));
      const colonne = COLONNES_IMPORT_CONTRAT.find((c) => normaliserEnteteContrat(c.header) === norm);
      if (colonne) indexParCle.set(colonne.key, colNumber);
    });
    if (!indexParCle.has("souscripteur") || !indexParCle.has("compagnie")) {
      throw new BadRequestException(`Colonnes "Souscripteur"/"Compagnie" introuvables — utilisez le modèle téléchargeable.`);
    }

    const lignes: ImportContratRowDto[] = [];
    const rejets: { ligne: number; motif: string }[] = [];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const row = feuille.getRow(r);
      const valeur = (cle: keyof ImportContratRowDto) => {
        const idx = indexParCle.get(cle);
        if (!idx) return undefined;
        return texteBrutDeCellule(row.getCell(idx).value);
      };
      const souscripteur = valeur("souscripteur");
      const compagnie = valeur("compagnie");
      if (!souscripteur && !compagnie) continue; // ligne vide, ignorée
      if (!souscripteur || !compagnie) { rejets.push({ ligne: r, motif: "Souscripteur et compagnie sont obligatoires." }); continue; }
      const ligne = { souscripteur, compagnie } as unknown as Record<string, string | undefined>;
      for (const { key } of COLONNES_IMPORT_CONTRAT) {
        if (key === "souscripteur" || key === "compagnie") continue;
        const v = valeur(key);
        if (v !== undefined) ligne[key] = v;
      }
      // Dates d'ancien système au format Date.toString() ("Wed Jul 15
      // 00:00:00 UTC 2026") — voir demande utilisateur — traduites vers
      // JJ/MM/AAAA dès l'aperçu, pour que la ligne affichée à l'écran soit
      // déjà la valeur réellement enregistrée à la confirmation.
      if (ligne.dateDebut !== undefined) ligne.dateDebut = normaliserDateImport(ligne.dateDebut);
      if (ligne.dateFin !== undefined) ligne.dateFin = normaliserDateImport(ligne.dateFin);
      // Statut traduit dès l'aperçu (voir normaliserStatutContrat
      // ci-dessus) — pour que "Terminé" s'affiche déjà "Expiré" avant
      // confirmation, jamais une surprise découverte après coup.
      ligne.statut = normaliserStatutContrat(ligne.statut);
      const ligneTypee = ligne as unknown as ImportContratRowDto;
      const resClient = await this.resoudreClient(souscripteur);
      const clientPourCompagnie = resClient?.statut === "trouve" ? resClient.client : undefined;
      const resCompagnie = await this.resoudreCompagnie(compagnie, clientPourCompagnie);
      // `resClient`/`resCompagnie` à null = vraiment introuvable — un
      // statut "a_creer_particulier"/"a_creer_auto_gestion" N'EST PAS un
      // rejet : la ligne sera créée à la confirmation (voir importer()).
      if (!resClient) rejets.push({ ligne: r, motif: `Souscripteur "${souscripteur}" introuvable — créez-le d'abord (ou via l'import Souscripteurs).` });
      else if (!resCompagnie) rejets.push({ ligne: r, motif: `Compagnie "${compagnie}" introuvable.` });
      // Produit/collège détecté automatiquement (voir resoudreClient
      // ci-dessus) — affiché dès l'aperçu pour que la ligne confirmée soit
      // déjà celle réellement enregistrée.
      if (resClient?.statut === "trouve" && resClient.produitDetecte && !ligneTypee.produit) {
        ligneTypee.produit = resClient.produitDetecte;
      }
      lignes.push(ligneTypee);
    }
    return { lignes, rejets };
  }

  // Confirmation — un compteur en mémoire par compagnie (initialisé à
  // prochainNumeroPolice) évite que deux lignes du même fichier, pour la
  // même compagnie et sans numéro de police explicite, ne se percutent
  // (voir demande utilisateur : suite ordonnée par compagnie).
  async importer(rows: ImportContratRowDto[]): Promise<{ crees: number; rejets: { ligne: number; motif: string }[] }> {
    let crees = 0;
    const rejets: { ligne: number; motif: string }[] = [];
    const prochainParCompagnie = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const ligne = rows[i];
      const resClient = await this.resoudreClient(ligne.souscripteur);
      if (!resClient) { rejets.push({ ligne: i + 1, motif: `Souscripteur "${ligne.souscripteur}" introuvable.` }); continue; }

      // Particulier détecté automatiquement (2026-08 — voir demande
      // utilisateur : "quand le nom du contrat est le nom d'un particulier,
      // cela veut dire que le contrat est pour un particulier") — créé ICI
      // SEULEMENT (jamais à l'aperçu, voir resoudreClient), même convention
      // d'id que la création/l'import unitaire de souscripteurs.
      let client: { id: string; nom: string };
      let produitDuNom: string | undefined;
      if (resClient.statut === "a_creer_particulier") {
        try {
          const idParticulier = await genererIdNumerique(this.prisma, "client");
          client = await this.prisma.client.create({
            data: { id: idParticulier, nom: resClient.nom, type: "Particulier", pays: "Gabon", contact: resClient.nom, tel: "", email: "", statut: "Actif" },
          });
        } catch {
          rejets.push({ ligne: i + 1, motif: `Impossible de créer le souscripteur particulier "${resClient.nom}".` });
          continue;
        }
      } else {
        client = resClient.client;
        produitDuNom = resClient.produitDetecte;
      }

      const resCompagnie = await this.resoudreCompagnie(ligne.compagnie, client);
      if (!resCompagnie) { rejets.push({ ligne: i + 1, motif: `Compagnie "${ligne.compagnie}" introuvable.` }); continue; }
      // Auto-Gestion détectée automatiquement (2026-08 — voir demande
      // utilisateur : "quand au niveau de la compagnie, c'est le nom du
      // souscripteur, alors il s'agit d'un contrat en auto-gestion") —
      // réutilise le VRAI service (même règles que l'écran Auto-Gestion),
      // jamais une écriture Prisma directe qui court-circuiterait la
      // logique métier réelle.
      let compagnie: { id: string; nom: string };
      if (resCompagnie.statut === "a_creer_auto_gestion") {
        try {
          compagnie = await this.compagnies.createAutoGestion(resCompagnie.clientId);
        } catch {
          rejets.push({ ligne: i + 1, motif: `Impossible de créer le profil Auto-Gestion pour "${ligne.compagnie}".` });
          continue;
        }
      } else {
        compagnie = resCompagnie.compagnie;
      }

      const produit = ligne.produit?.trim() || produitDuNom;

      let numeroPolice = ligne.numeroPolice?.trim();
      if (!numeroPolice) {
        if (!prochainParCompagnie.has(compagnie.id)) {
          prochainParCompagnie.set(compagnie.id, Number(await this.prochainNumeroPolice(compagnie.id)));
        }
        const n = prochainParCompagnie.get(compagnie.id)!;
        numeroPolice = String(n);
        prochainParCompagnie.set(compagnie.id, n + 1);
      }

      const id = await this.genererIdContrat();
      // Re-normalisé ici aussi (pas seulement à l'aperçu) — un appel direct
      // à /contrats/import avec des dates encore au format Date.toString()
      // reste correctement traduit.
      const dateDebut = normaliserDateImport(ligne.dateDebut) || "01/01/2026";
      const dateFin = normaliserDateImport(ligne.dateFin) || "31/12/2026";
      const prime = Number(ligne.prime) || 0;
      const statut = normaliserStatutContrat(ligne.statut);
      const periodicite = ["Mensuel", "Trimestriel", "Semestriel", "Annuel"].includes(ligne.periodicite ?? "") ? ligne.periodicite! : "Annuel";
      const branche = ligne.branche === "Assistance" ? "Assistance" : "Maladie";
      // Un contrat dure 12 mois — un intervalle importé plus long (reprise
      // d'historique sur une seule ligne), OU encore actif alors que sa
      // date de fin déclarée est dépassée (tacite reconduction, voir
      // decouperEnExercices ci-dessus), est découpé en exercices
      // successifs de 12 mois. Le contrat reflète le DERNIER exercice
      // (dates courantes + numéro), exactement comme après un
      // Renouvellement (AvenantsService.appliquer) — les exercices
      // antérieurs sont créés déjà Clôturés.
      const tranches = decouperEnExercices(dateDebut, dateFin, statut);
      const derniere = tranches[tranches.length - 1];
      try {
        const contrat = await this.prisma.contrat.create({
          data: {
            id, clientId: client.id, compagnieId: compagnie.id, branche, produit,
            dateDebut: derniere.dateDebut, dateFin: derniere.dateFin,
            prime, statut, periodicite, numeroPolice, exerciceNumero: tranches.length,
          },
        });
        // Le DERNIER exercice ne peut être "Actif" que si le contrat
        // lui-même l'est encore (voir demande utilisateur — un contrat
        // Résilié/Expiré n'a plus d'exercice courant réellement actif).
        const dernierExerciceActif = statut === "Actif" || statut === "En renouvellement";
        await this.prisma.exercice.createMany({
          data: tranches.map((t, idx) => ({
            contratId: id, numero: idx + 1,
            dateDebut: t.dateDebut, dateFin: t.dateFin,
            periodicite, prime,
            statut: idx === tranches.length - 1 && dernierExerciceActif ? "Actif" : "Clôturé",
          })),
        });
        // Renouvellements pour la reprise de données (2026-09) — voir
        // demande utilisateur : "puisqu'il y a récupération des données, le
        // premier exercice doit être l'affaire nouvelle et le reste des
        // exercices sont des renouvellements à ces périodes." Le premier
        // exercice n'a besoin d'aucun avenant (la création du contrat EST
        // l'affaire nouvelle, même convention que la ligne "fondateur"
        // synthétique de l'Historique des mouvements) — mais les tranches
        // suivantes, jusqu'ici de simples lignes Exercice sans aucun
        // avenant, restaient invisibles de l'Historique des mouvements ET
        // hors de portée de ContratsService.mettreAJourPrimeExercice (qui
        // cherche justement l'avenant portant le même exerciceNumero pour y
        // répercuter une correction de prime — sans avenant, rien à
        // synchroniser). Un avenant "Renouvellement" par tranche > 1 comble
        // les deux : mouvement réel affiché + cible de synchronisation.
        if (tranches.length > 1) {
          await this.prisma.avenant.createMany({
            data: tranches.slice(1).map((t, idx) => ({
              id: `AVN-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
              contratId: id, type: "Renouvellement",
              description: `Renouvellement (reprise de données) — période ${t.dateDebut} au ${t.dateFin}`,
              primeAvant: prime, primeApres: prime,
              dateEffet: t.dateDebut, statut: "Appliqué", exerciceNumero: idx + 2,
            })),
          });
        }
        crees++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          rejets.push({ ligne: i + 1, motif: `Le numéro de police "${numeroPolice}" est déjà utilisé pour cette compagnie.` });
        } else {
          rejets.push({ ligne: i + 1, motif: "Erreur inattendue lors de la création." });
        }
      }
    }
    return { crees, rejets };
  }
}
