import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@prisma/client";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MouvementsService } from "../mouvements/mouvements.service";
import { NotificationsService } from "../notifications/notifications.service";
import { verifierAge } from "../mouvements/age-limite.util";
import { CreateAssureDto } from "./dto/create-assure.dto";
import { UpdateAssureDto } from "./dto/update-assure.dto";
import { CreatePriseEnChargeDto } from "./dto/create-prise-en-charge.dto";
import { UpdatePriseEnChargeDto } from "./dto/update-prise-en-charge.dto";
import { ImportedPersonRowDto, ImportPopulationDto } from "./dto/import-population.dto";
import { creerGenerateurMatricule } from "./matricule.util";
import { CreateFactureLigneDto, RUBRIQUES_PLAFONNEES } from "./dto/create-facture-ligne.dto";
import { UpdateFactureLigneDto } from "./dto/update-facture-ligne.dto";
import { CreateRemboursementLigneDto } from "../remboursements/dto/create-remboursement-ligne.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";

const UPLOADS_PHOTOS_DIR = path.join(UPLOADS_ROOT, "photos");
const UPLOADS_REMBOURSEMENTS_DIR = path.join(UPLOADS_ROOT, "remboursements");

// Liste des participants (2026-09) — `contrat`/`membres` étaient chargés en
// entier (include) alors que ApiAssureSante/mapAssure (frontend) ne lisent
// que des champs scalaires de AssureSante lui-même (police = contratId brut,
// jamais l'objet contrat) : sur un vrai volume de production, l'hydratation
// Prisma des Decimal de `contrat` pour chaque ligne rendait cet endpoint
// injouable (187s mesurés en prod sans filtre). Même diagnostic déjà posé
// sur StatistiquesService — voir mémoire project-performance-optimisations.
const SELECT_ASSURE_LISTE = {
  id: true, nom: true, prenom: true, telephone: true, matricule: true, contratId: true,
  beneficiaires: true, cotisation: true, statut: true, dateNaissance: true, statutMatrimonial: true,
  numeroAssure: true, qrCode: true, statutCarte: true, dateAffiliation: true, dateRadiation: true,
  motifRadiation: true, photo: true, familleId: true, typeAssure: true, scolarise: true,
  nationalite: true, sexe: true, adresse: true, nomJeuneFille: true, lieuNaissance: true,
  email: true, telephoneFixe: true, autreNumero: true, fax: true,
} satisfies Prisma.AssureSanteSelect;

// TPS — 9,5% de la base de remboursement assurance, prélevée uniquement
// chez les prestataires assujettis (voir Prestataire.tpsAssujetti). Exportée
// (2026-09) — voir demande utilisateur : "le taux de la TPS est connu et
// est déjà paramétré dans le système... il faut le faire apparaitre sur les
// documents où il doit apparaitre" (DocumentsService.renderReglement,
// affichage de la colonne "% tps" pour un prestataire assujetti, même
// quand le montant tps de la ligne est nul).
export const TAUX_TPS = 9.5;

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Blocage de saisie post-résiliation (2026-09) — voir demande utilisateur :
// "si un contrat est résilié... seules les prestations faites avant la date
// de résiliation peuvent être saisies. mais tout ce qui fait après la date
// de résiliation ne pourra pas être saisie sauf si l'administrateur ouvre
// temporairement." `dateFin` sert de date de résiliation/fermeture des
// droits (voir AvenantsService.appliquer, type Résiliation, qui l'aligne
// désormais sur la veille de la date d'effet de l'avenant).
// `saisieApresResiliationAutorisee` est la dérogation temporaire (bouton
// dédié sur la fiche du contrat, voir ContratsService.toggleDerogationSaisie)
// — appelée ici pour CHAQUE création de prestation/prise en charge, quel
// que soit le point d'entrée (saisie interne, portail prestataire, portail
// membre, agent IA) puisque tous convergent vers creerLigneCommune ou
// createPriseEnCharge ci-dessous.
function verifierSaisieAutorisee(
  contrat: { statut: string; dateFin: string; saisieApresResiliationAutorisee: boolean },
  datePrestation: string,
) {
  if (contrat.statut !== "Résilié" || contrat.saisieApresResiliationAutorisee) return;
  const dResiliation = parseDateFr(contrat.dateFin);
  const dPrestation = parseDateFr(datePrestation);
  if (dResiliation && dPrestation && dPrestation > dResiliation) {
    throw new BadRequestException(
      `Ce contrat est résilié depuis le ${contrat.dateFin} — seules les prestations datées avant ou à cette date peuvent être saisies. Un administrateur peut autoriser temporairement la saisie au-delà, depuis la fiche du contrat.`,
    );
  }
}

// Blocage de saisie après retrait d'un assuré (2026-09) — voir demande
// utilisateur : "l'application doit permettre le retrait d'une population
// avec la date à laquelle cela a été fait. Ce qui fait que toutes les
// prestations faites avant la date de retrait peuvent continuellement être
// saisies. Mais s'il y a des prestations à la date de retrait ou après
// cette date, l'application ne peut plus les prendre en charge." Même
// principe que verifierSaisieAutorisee ci-dessus mais au niveau de LA
// PERSONNE plutôt que du contrat entier — valable pour tout exercice et
// pour Maladie comme Assistance (même journal, même contrat). Source :
// le DERNIER mouvement AvenantAssure (Incorporation/Retrait) de cet assuré
// sur ce contrat — même journal que population-historique.util.ts.
async function verifierAssureNonRetire(prisma: PrismaService, contratId: string, assureId: string, datePrestation: string) {
  const dernier = await prisma.avenantAssure.findFirst({
    where: { contratId, assureId },
    orderBy: [{ dateEffet: "desc" }, { avenant: { createdAt: "desc" } }],
  });
  if (!dernier || dernier.action !== "Retrait") return;
  const dRetrait = parseDateFr(dernier.dateEffet);
  const dPrestation = parseDateFr(datePrestation);
  if (dRetrait && dPrestation && dPrestation >= dRetrait) {
    throw new BadRequestException(
      `Cet assuré a été retiré de ce contrat le ${dernier.dateEffet} — seules les prestations datées avant cette date peuvent être saisies pour lui.`,
    );
  }
}

function formatNom(s: string): string {
  return s.trim().toUpperCase();
}

// Convention imposée : première lettre en majuscule, le reste en minuscule
// — appliquée mot par mot (prénoms composés : "Nehemie Abigail").
function formatPrenom(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function nomComplet(nom: string, prenom?: string | null): string {
  return prenom ? `${nom} ${prenom}` : nom;
}

// Statut import population (2026-09) — voir demande utilisateur : "le jour
// où on va importer la liste des participants et ayants droit, l'application
// ajoutera simplement ceux qui ne sont pas là et mettra à jour le statut
// (ACTIF ou INACTIF)." Le vocabulaire réel de AssureSante.statut est
// Actif|Suspendu|Radié (jamais "Inactif" littéralement) — "Inactif" de
// l'utilisateur correspond à "Suspendu" (bascule réversible, même principe
// que SanteService.suspendreAssure), jamais à "Radié" (sortie définitive
// tracée, distincte). Tolérant : une valeur non reconnue (colonne absente,
// texte imprévu) ne doit jamais écraser silencieusement le statut existant.
function normaliserStatutImport(valeur?: string): "Actif" | "Suspendu" | undefined {
  const v = (valeur ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (v === "ACTIF" || v === "ACTIVE" || v === "ACTIVE(VE)") return "Actif";
  if (v === "INACTIF" || v === "INACTIVE" || v === "SUSPENDU" || v === "SUSPENDUE") return "Suspendu";
  return undefined;
}

type ResolutionTelephone =
  | { ok: true }
  | { conflict: "block" | "confirm"; famille: { id: string; nom: string; prenom: string | null } };

@Injectable()
export class SanteService {
  constructor(private prisma: PrismaService, private mouvements: MouvementsService, private notifications: NotificationsService, private storage: StorageService) {}

  // Notifie le compte portail (assuré principal ou ayant droit délégué) lié
  // à cet assuré, s'il en existe un (2026-08) — voir demande utilisateur :
  // "la notification doit signaler... les demandes ou les saisies de
  // facture des prestations (pour l'assuré et ses ayants droit)". Silencieux
  // si l'assuré n'a pas encore de compte portail (voir DelegationsFamilleService/
  // ComptesMobileService) — ne bloque jamais l'opération métier en cours.
  private async notifierAssure(assureId: string, message: string): Promise<void> {
    const compte = await this.prisma.user.findUnique({ where: { assureSanteId: assureId } });
    if (!compte) return;
    await this.notifications.create("Assuré", compte.id, message).catch(() => undefined);
  }

  // `contratId` (optionnel) scope la liste à la population d'un seul
  // contrat — utilisé par le picker assuré/ayant droit de la saisie de
  // facture (src/features/prises-en-charge), qui n'a jamais à proposer tous
  // les assurés du système une fois le contrat de la facture choisi.
  // Recherche avancée (2026-09 — voir demande utilisateur : "ajouter des
  // filtres de recherche avancée dans l'onglet... participant... prenant
  // en compte plusieurs facteurs de recherche"). Un critère peut matcher un
  // AYANT DROIT (ex. le prénom d'un enfant) alors que l'écran affiche des
  // FAMILLES (une ligne = l'assuré principal, dépliable) — la recherche
  // relève donc d'abord les lignes qui matchent, PUIS recharge la famille
  // ENTIÈRE de chacune (racine + tous ses membres) pour ne jamais renvoyer
  // un ayant droit orphelin de son assuré principal à l'affichage.
  async findAssures(filtres?: { contratId?: string; nom?: string; matricule?: string; typeAssure?: string; statut?: string; sexe?: string }) {
    const criteresAvances = !!(filtres?.nom || filtres?.matricule || filtres?.typeAssure || filtres?.statut || filtres?.sexe);
    if (!criteresAvances) {
      return this.prisma.assureSante.findMany({ where: filtres?.contratId ? { contratId: filtres.contratId } : undefined, select: SELECT_ASSURE_LISTE });
    }
    const where: Prisma.AssureSanteWhereInput = {
      ...(filtres?.contratId ? { contratId: filtres.contratId } : {}),
      ...(filtres?.typeAssure ? { typeAssure: filtres.typeAssure } : {}),
      ...(filtres?.statut ? { statut: filtres.statut } : {}),
      ...(filtres?.sexe ? { sexe: filtres.sexe } : {}),
      ...(filtres?.matricule ? { matricule: { contains: filtres.matricule, mode: "insensitive" } } : {}),
      ...(filtres?.nom
        ? { OR: [{ nom: { contains: filtres.nom, mode: "insensitive" } }, { prenom: { contains: filtres.nom, mode: "insensitive" } }] }
        : {}),
    };
    const correspondances = await this.prisma.assureSante.findMany({ where, select: { id: true, familleId: true } });
    if (correspondances.length === 0) return [];
    const racinesIds = [...new Set(correspondances.map((m) => m.familleId ?? m.id))];
    return this.prisma.assureSante.findMany({
      where: { OR: [{ id: { in: racinesIds } }, { familleId: { in: racinesIds } }] },
      select: SELECT_ASSURE_LISTE,
    });
  }

  // Portail client (2026-08) — mêmes bénéficiaires que findAssures, mais
  // cloisonnés aux contrats du client connecté (voir ContratsService.
  // findAllForClient, même principe de cloisonnement). contratId optionnel
  // resserre encore la liste à un seul de ses contrats, mais reste vérifié
  // comme lui appartenant avant tout filtrage.
  async findAssuresForClient(clientId: string, contratId?: string) {
    if (contratId) {
      const contrat = await this.prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
      if (!contrat || contrat.clientId !== clientId) throw new ForbiddenException(`Contrat ${contratId} inaccessible`);
    }
    return this.prisma.assureSante.findMany({
      where: { contrat: { clientId }, ...(contratId ? { contratId } : {}) },
      include: { contrat: true, membres: true },
    });
  }

  async findAssureOne(id: string) {
    const a = await this.prisma.assureSante.findUnique({ where: { id }, include: { contrat: true, membres: true } });
    if (!a) throw new NotFoundException(`Assuré ${id} introuvable`);
    return a;
  }

  // Un numéro de téléphone n'est jamais porté que par une racine de famille
  // (familleId NULL). "block" = la personne concernée est elle-même une
  // racine (AS) → deux familles ne peuvent pas partager un numéro, refusé
  // sans confirmation possible. "confirm" = la personne est un CJ/EF → le
  // rattachement à la famille trouvée doit être confirmé explicitement.
  private async resolveTelephone(telephone: string | undefined, estAssurePrincipal: boolean, excludeId?: string): Promise<ResolutionTelephone> {
    const tel = telephone?.trim();
    if (!tel) return { ok: true };
    const existant = await this.prisma.assureSante.findFirst({
      where: { telephone: tel, familleId: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, nom: true, prenom: true },
    });
    if (!existant) return { ok: true };
    return { conflict: estAssurePrincipal ? "block" : "confirm", famille: existant };
  }

  private messageConflitTelephone(tel: string, famille: { nom: string; prenom: string | null }): string {
    return `Le numéro ${tel} est déjà utilisé par la famille de ${nomComplet(famille.nom, famille.prenom)} (assuré principal) — un numéro de téléphone ne peut être associé qu'à une seule famille.`;
  }

  // Verrou anti-doublon de population (2026-08) — un même matricule sur
  // deux contrats différents est toujours une duplication (jamais une
  // famille légitime à confirmer, contrairement au téléphone) : blocage
  // net. La bascule (SanteService.basculerAssureVersContrat) est la seule
  // façon légitime de faire passer une personne d'un contrat à un autre.
  private async resolveMatricule(matricule: string | undefined, contratId: string, excludeId?: string) {
    const mat = matricule?.trim();
    if (!mat) return null;
    return this.prisma.assureSante.findFirst({
      where: { matricule: mat, contratId: { not: contratId }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, contratId: true, nom: true, prenom: true },
    });
  }

  private messageConflitMatricule(mat: string, autre: { contratId: string; nom: string; prenom: string | null }): string {
    return `Le matricule ${mat} est déjà utilisé sur le contrat ${autre.contratId} par ${nomComplet(autre.nom, autre.prenom)} — une même personne ne peut pas être rattachée à deux contrats. Utilisez le transfert (fiche du participant) pour la faire passer d'un contrat à l'autre.`;
  }

  async createAssure(dto: CreateAssureDto) {
    const estAssurePrincipal = !dto.familleId && (dto.typeAssure ?? "AS").toUpperCase() === "AS";
    const resolution = await this.resolveTelephone(dto.telephone, estAssurePrincipal);
    if ("conflict" in resolution) {
      const tel = dto.telephone!.trim();
      if (resolution.conflict === "block") {
        throw new BadRequestException(this.messageConflitTelephone(tel, resolution.famille));
      }
      if (!dto.confirmerFamilleExistante) {
        throw new ConflictException({
          message: `Ce numéro est déjà associé à la famille de ${nomComplet(resolution.famille.nom, resolution.famille.prenom)} — confirmez pour rattacher cette personne à cette famille.`,
          famille: resolution.famille,
        });
      }
    }

    const doublonMatricule = await this.resolveMatricule(dto.matricule, dto.contratId);
    if (doublonMatricule) {
      throw new BadRequestException(this.messageConflitMatricule(dto.matricule!.trim(), doublonMatricule));
    }

    // Passe par MouvementsService (voir backend/src/mouvements) — le même
    // point d'entrée que l'écran Contrats "Gérer les assurés" — pour que
    // toute affiliation, individuelle ou groupée, ajuste bien les compteurs
    // de population/prime du contrat et génère un avenant d'incorporation.
    const { crees } = await this.mouvements.appliquerMouvement(
      dto.contratId,
      dto.dateAffiliation,
      [{
        nom: dto.nom, prenom: dto.prenom, matricule: dto.matricule,
        beneficiaires: dto.beneficiaires, cotisation: dto.cotisation,
        dateNaissance: dto.dateNaissance, statutMatrimonial: dto.statutMatrimonial,
        typeAssure: dto.typeAssure, scolarise: dto.scolarise, familleId: dto.familleId, telephone: dto.telephone,
        sexe: dto.sexe, adresse: dto.adresse, nomJeuneFille: dto.nomJeuneFille,
        lieuNaissance: dto.lieuNaissance, email: dto.email, telephoneFixe: dto.telephoneFixe,
        autreNumero: dto.autreNumero, fax: dto.fax,
      }],
      [],
    );
    return crees[0];
  }

  // Édition individuelle (fiche participant) — le téléphone n'est éditable
  // que sur une racine de famille (voir schema.prisma, commentaire familleId).
  async updateAssure(id: string, dto: UpdateAssureDto) {
    const existant = await this.findAssureOne(id);

    if (dto.telephone !== undefined) {
      if (existant.familleId !== null) {
        throw new BadRequestException("Le numéro de téléphone est porté par l'assuré principal de la famille — modifiez-le depuis sa fiche.");
      }
      const tel = dto.telephone.trim();
      if (tel) {
        const resolution = await this.resolveTelephone(tel, true, id);
        if ("conflict" in resolution) {
          throw new BadRequestException(this.messageConflitTelephone(tel, resolution.famille));
        }
      }
    }

    if (dto.dateNaissance !== undefined || dto.scolarise !== undefined) {
      const erreurAge = verifierAge(
        existant.contrat,
        { typeAssure: existant.typeAssure, dateNaissance: dto.dateNaissance ?? existant.dateNaissance, scolarise: dto.scolarise ?? existant.scolarise },
        new Date(),
      );
      if (erreurAge) throw new BadRequestException(erreurAge);
    }

    return this.prisma.assureSante.update({
      where: { id },
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        telephone: dto.telephone !== undefined ? dto.telephone.trim() || null : undefined,
        dateNaissance: dto.dateNaissance,
        statutMatrimonial: dto.statutMatrimonial,
        sexe: dto.sexe,
        scolarise: dto.scolarise,
        adresse: dto.adresse,
        nomJeuneFille: dto.nomJeuneFille,
        lieuNaissance: dto.lieuNaissance,
        email: dto.email,
        telephoneFixe: dto.telephoneFixe,
        autreNumero: dto.autreNumero,
        fax: dto.fax,
      },
      include: { contrat: true, membres: true },
    });
  }

  async uploadPhoto(id: string, file: Express.Multer.File) {
    await this.findAssureOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("photos", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_PHOTOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_PHOTOS_DIR, filename), file.buffer);
    }
    return this.prisma.assureSante.update({
      where: { id },
      data: { photo: filename },
      include: { contrat: true, membres: true },
    });
  }

  async deletePhoto(id: string) {
    const a = await this.findAssureOne(id);
    if (a.photo) {
      if (this.storage.actif) await this.storage.delete("photos", a.photo);
      else await fs.promises.unlink(path.join(UPLOADS_PHOTOS_DIR, a.photo)).catch(() => undefined);
    }
    return this.prisma.assureSante.update({
      where: { id },
      data: { photo: null },
      include: { contrat: true, membres: true },
    });
  }

  // Blocage physique de la carte ("Désactiver la carte") — ne touche pas
  // `statut` (distinct de "Suspendre", suspendreAssure ci-dessous). Cascade
  // aux ayants droit si `id` est une racine de famille, même principe que
  // suspendreAssure/retirerDuContrat : bloquer/débloquer le principal
  // bloque/débloque toute sa famille en même temps.
  async toggleCarte(id: string) {
    const a = await this.findAssureOne(id);
    const bloque = a.statutCarte !== "Bloquée";
    const cible = bloque ? "Bloquée" : "Active";
    const ids = a.familleId === null ? [a.id, ...a.membres.filter((m) => m.statut !== "Radié").map((m) => m.id)] : [a.id];
    await this.prisma.assureSante.updateMany({ where: { id: { in: ids }, statut: { not: "Radié" } }, data: { statutCarte: cible } });
    return this.findAssureOne(id);
  }

  // Blocage temporaire réversible ("Suspendre") — aucun avenant, aucun
  // impact sur la population/prime du contrat (contrairement à
  // retirerDuContrat ci-dessous, la sortie définitive). Cascade aux ayants
  // droit si `id` est une racine de famille, cohérent avec la règle "un
  // assuré principal = 1 famille" déjà appliquée à la radiation.
  async suspendreAssure(id: string, suspendre: boolean) {
    const a = await this.findAssureOne(id);
    const nouveauStatut = suspendre ? "Suspendu" : "Actif";
    const ids = a.familleId === null ? [a.id, ...a.membres.filter((m) => m.statut !== "Radié").map((m) => m.id)] : [a.id];
    await this.prisma.assureSante.updateMany({ where: { id: { in: ids }, statut: { not: "Radié" } }, data: { statut: nouveauStatut } });
    return this.findAssureOne(id);
  }

  // Sortie définitive tracée ("Retirer du contrat") — radiation douce avec
  // impact sur la prime/population du contrat et génération d'un avenant de
  // retrait, via le même MouvementsService que l'écran Contrats. Remplace
  // removeAssure (suppression physique) comme cible de l'action "Radier" /
  // "Retirer du contrat" de l'écran Participants.
  async retirerDuContrat(id: string, dateEffet: string, motif?: string) {
    const a = await this.findAssureOne(id);
    const { radies } = await this.mouvements.appliquerMouvement(a.contratId, dateEffet, [], [{ assureId: id, motif }]);
    return radies;
  }

  // Bascule vers un autre contrat — même fiche conservée (voir
  // MouvementsService.basculerVersContrat), c'est la seule façon légitime
  // de faire passer une personne d'un contrat à l'autre sans déclencher le
  // verrou anti-doublon (matricule déjà rattaché ailleurs). Modélisée par
  // deux avenants réels — Retrait sur l'ancien contrat, Incorporation sur
  // le nouveau — pas un type d'avenant à part.
  async basculerAssureVersContrat(id: string, contratDestinationId: string, avecFamille: boolean, dateEffet: string) {
    return this.mouvements.basculerVersContrat(id, contratDestinationId, avecFamille, dateEffet);
  }

  // Historique des mouvements (avenants Incorporation/Retrait) concernant
  // cette personne — onglet "Statut & mouvements" du profil Participants.
  mouvementsDe(assureId: string) {
    return this.prisma.avenantAssure.findMany({
      where: { assureId },
      include: { avenant: true },
      orderBy: { avenant: { createdAt: "desc" } },
    });
  }

  // Suppression physique — conservée pour corriger une ligne créée par
  // erreur (ex: doublon de saisie), mais n'est plus la cible de "Retirer du
  // contrat" côté Participants (voir retirerDuContrat, radiation douce
  // tracée) : une suppression physique ne peut jamais apparaître dans un
  // rapport "qui a été retiré durant telle période".
  async removeAssure(id: string) {
    await this.findAssureOne(id);
    await this.prisma.assureSante.delete({ where: { id } });
    return { id };
  }

  // Les lignes arrivent déjà scindées (Nom/Prénom) et éventuellement
  // corrigées à la main côté client (aperçu éditable, onglet Population).
  // Chaque "AS" (Assuré principal) démarre une nouvelle famille ; les CJ
  // (Conjoint) et EF (Enfant) qui suivent jusqu'au prochain "AS" en
  // deviennent les membres (familleId = l'AS). Toute ligne dont le
  // matricule correspond déjà à un assuré du contrat bascule en mode mise
  // à jour (import différé : ajout ultérieur de photo/téléphone) au lieu
  // de dupliquer. Les lignes en erreur (nom manquant, conflit téléphone,
  // matricule en doublon dans le fichier) sont exclues et reportées avec
  // leur motif — le reste du fichier est importé normalement.
  async importPopulation(dto: ImportPopulationDto) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: dto.contratId } });
    if (!contrat) throw new NotFoundException(`Contrat ${dto.contratId} introuvable`);

    const existants = await this.prisma.assureSante.findMany({
      where: { contratId: dto.contratId },
      select: { id: true, matricule: true, familleId: true, telephone: true, prenom: true, dateNaissance: true, statut: true },
    });
    const existantParMatricule = new Map(existants.map((e) => [e.matricule, e]));

    type Rejet = { ligne: number; matricule?: string; nom?: string; motif: string };
    const rejets: Rejet[] = [];
    type LigneAcceptee = { row: ImportedPersonRowDto; nom: string; prenom?: string; type: string; id: string; matricule: string; familleId: string | null; isNew: boolean };
    const accepted: LigneAcceptee[] = [];
    const matriculesVusEnLigne = new Map<string, number>();

    // Résolution EN LOTS des vérifications anti-doublon (2026-09 — voir
    // demande utilisateur : "chaque import puisse générer une écriture de
    // plus de 50000 lignes... sans planter le système") — une requête
    // chacune pour TOUTES les valeurs du lot plutôt qu'un await par ligne
    // dans la boucle ci-dessous (qui reste, elle, séquentielle : le
    // regroupement familial dépend de l'ORDRE des lignes, voir
    // `currentFamilyId`, donc ne peut pas être parallélisé).
    const matriculesDuLot = [...new Set(dto.rows.map((l) => l.matricule?.trim()).filter((m): m is string => !!m))];
    const telephonesDuLot = [...new Set(dto.rows.map((l) => l.telephone?.trim()).filter((t): t is string => !!t))];
    const conflitsMatricule = matriculesDuLot.length > 0
      ? await this.prisma.assureSante.findMany({ where: { matricule: { in: matriculesDuLot }, contratId: { not: dto.contratId } }, select: { id: true, matricule: true, contratId: true, nom: true, prenom: true } })
      : [];
    const conflitsTelephone = telephonesDuLot.length > 0
      ? await this.prisma.assureSante.findMany({ where: { telephone: { in: telephonesDuLot }, familleId: null }, select: { id: true, telephone: true, nom: true, prenom: true } })
      : [];
    const conflitMatriculeParValeur = new Map(conflitsMatricule.map((c) => [c.matricule, c]));
    const conflitTelephoneParValeur = new Map(conflitsTelephone.filter((c) => c.telephone).map((c) => [c.telephone as string, c]));

    let currentFamilyId: string | null = null;

    // UN SEUL générateur pour tout le lot (2026-09) — voir matricule.util.ts.
    // Le lot entier peut compter des dizaines de milliers de lignes sans
    // matricule saisi ; rescanner la base à chaque ligne y verrait toujours
    // le même "dernier matricule" (rien n'est committé avant la fin de
    // l'import) et produirait des doublons.
    const genererMatricule = await creerGenerateurMatricule(this.prisma);

    for (let i = 0; i < dto.rows.length; i++) {
      const line = dto.rows[i];
      const ligneNo = i + 2; // ligne 1 = en-tête
      if (!line.nom?.trim()) { rejets.push({ ligne: ligneNo, motif: "Nom manquant" }); continue; }

      const type = (line.typeAssure ?? "").trim().toUpperCase();
      const nom = formatNom(line.nom);
      const prenom = line.prenom?.trim() ? formatPrenom(line.prenom) : undefined;
      const matricule = line.matricule?.trim();
      const estAS = type === "AS" || !currentFamilyId;

      const existant = matricule ? existantParMatricule.get(matricule) : undefined;
      if (existant) {
        if (estAS) currentFamilyId = existant.familleId ?? existant.id;
        accepted.push({ row: line, nom, prenom, type: type || (estAS ? "AS" : "EF"), id: existant.id, matricule: existant.matricule, familleId: existant.familleId, isNew: false });
        continue;
      }

      if (matricule) {
        if (matriculesVusEnLigne.has(matricule)) {
          rejets.push({ ligne: ligneNo, matricule, nom, motif: `Matricule en doublon dans le fichier importé (déjà utilisé à la ligne ${matriculesVusEnLigne.get(matricule)}).` });
          continue;
        }
        matriculesVusEnLigne.set(matricule, ligneNo);

        const doublonMatricule = conflitMatriculeParValeur.get(matricule);
        if (doublonMatricule) {
          rejets.push({ ligne: ligneNo, matricule, nom, motif: this.messageConflitMatricule(matricule, doublonMatricule) });
          continue;
        }
      }

      const tel = line.telephone?.trim();
      if (tel) {
        const doublonTelephone = conflitTelephoneParValeur.get(tel);
        if (doublonTelephone) {
          const motif = estAS
            ? `Numéro de téléphone ${tel} déjà utilisé par la famille de ${nomComplet(doublonTelephone.nom, doublonTelephone.prenom)} — impossible pour un assuré principal (un numéro = une famille).`
            : `Numéro de téléphone ${tel} déjà associé à la famille de ${nomComplet(doublonTelephone.nom, doublonTelephone.prenom)} — confirmation individuelle requise (fiche du participant), ligne ignorée en import de masse.`;
          rejets.push({ ligne: ligneNo, matricule, nom, motif });
          continue;
        }
      }

      const typeResolu = type || (estAS ? "AS" : "EF");
      const erreurAge = verifierAge(contrat, { typeAssure: typeResolu, dateNaissance: line.dateNaissance, scolarise: false }, new Date());
      if (erreurAge) {
        rejets.push({ ligne: ligneNo, matricule, nom, motif: erreurAge });
        continue;
      }

      // 12 caractères (2026-09, était 6) — voir mouvements.service.ts pour
      // le même correctif : sur une table qui compte déjà des milliers de
      // lignes, 6 caractères hexa (24 bits) laissait une probabilité de
      // collision réelle avec un id existant, faisant échouer tout le lot
      // du createMany (une seule collision annule l'import entier — constaté
      // en production, l'import réussissait au 2e essai avec un nouveau tirage).
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
      const id = `ASS-${suffix}`;
      const genMatricule = matricule || genererMatricule();
      if (estAS) currentFamilyId = id;
      accepted.push({ row: line, nom, prenom, type: typeResolu, id, matricule: genMatricule, familleId: estAS ? null : currentFamilyId, isNew: true });
    }

    if (accepted.length === 0) {
      if (rejets.length > 0) return { imported: 0, updated: 0, rejected: rejets, resultats: [] };
      throw new BadRequestException("Aucune ligne exploitable dans le fichier importé.");
    }

    let imported = 0;
    let updated = 0;
    const resultats: { matricule: string; id: string }[] = accepted.map((item) => ({ matricule: item.matricule, id: item.id }));

    // Écriture en masse (2026-09) — voir demande utilisateur : "l'application
    // devient lente... il faudrait que peu importe le poids et le flux,
    // [les données] puissent remonter rapidement... valable pour l'import."
    // La version précédente ouvrait UNE transaction interactive puis
    // exécutait un create()/update() PAR LIGNE, séquentiellement (un aller-
    // retour réseau par ligne — 35 000 lignes = 35 000 allers-retours, la
    // cause probable de la lenteur constatée sur les gros imports). La
    // grande majorité d'un import de reprise de données est composée de
    // NOUVELLES personnes : `createMany` les insère en UNE seule requête
    // SQL (VALUES multiples) au lieu de N. Les mises à jour de fiches
    // déjà existantes (bien moins nombreuses en pratique, un simple
    // complément de champs optionnels manquants) restent nécessairement
    // ligne par ligne (Prisma ne sait pas faire un UPDATE en masse avec
    // une valeur différente par ligne sans SQL brut), mais lancées par
    // lots CONCURRENTS (Promise.all, chacune sur sa propre connexion du
    // pool) plutôt que séquentiellement sur une connexion unique de
    // transaction — un réel gain de parallélisme, impossible dans une
    // transaction interactive (une seule connexion, donc sérialisée quoi
    // qu'il arrive côté JS).
    const nouveaux = accepted.filter((item) => item.isNew);
    const aMettreAJour = accepted.filter((item) => !item.isNew);

    if (nouveaux.length > 0) {
      await this.prisma.assureSante.createMany({
        data: nouveaux.map((item) => ({
          id: item.id,
          contratId: dto.contratId,
          beneficiaires: 0,
          cotisation: 0,
          statut: normaliserStatutImport(item.row.statut) ?? "Actif",
          numeroAssure: `MED-SAN-${item.id.slice(4)}`,
          qrCode: `QR-MED-${item.id.slice(4)}`,
          statutCarte: "Active",
          matricule: item.matricule,
          nom: item.nom,
          prenom: item.prenom,
          sexe: item.row.sexe?.trim(),
          dateNaissance: item.row.dateNaissance?.trim(),
          telephone: item.familleId ? undefined : item.row.telephone?.trim() || undefined,
          typeAssure: item.type,
          familleId: item.familleId,
        })),
      });
      imported = nouveaux.length;

      // Journal Incorporation (2026-09) — voir demande utilisateur : "il
      // faut fixer le fait que la liste puisse aussi se générer par rapport
      // à un mouvement de production... cette liste doit pouvoir être
      // éditée plusieurs fois... et retrouver la même liste à l'identique."
      // Piège déjà documenté dans population-historique.util.ts : contrairement
      // à SanteService.createAssure (saisie manuelle, passe par
      // MouvementsService.appliquerMouvement), un import CSV créait les
      // lignes AssureSante SANS AUCUN avenant — population "fondatrice"
      // invisible du journal AvenantAssure, donc impossible à reconstituer/
      // imprimer comme un mouvement figé. Comblé ici avec le même schéma
      // qu'appliquerMouvement (voir mouvements.service.ts) : un avenant
      // "Incorporation" + son journal, en createMany (pas de round-trip par
      // ligne) pour rester valable sur un lot de plusieurs dizaines de
      // milliers de personnes. dateEffet = date de début du contrat : une
      // population importée à la mise en place est réputée présente depuis
      // l'origine (même convention que le repli de reconstituerPopulation
      // pour un fondateur jamais tracé par un avenant).
      const avenantImportId = `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      await this.prisma.avenant.create({
        data: {
          id: avenantImportId, contratId: dto.contratId, type: "Incorporation",
          description: `Import de ${nouveaux.length} personne(s)`,
          primeAvant: Number(contrat.prime), primeApres: Number(contrat.prime),
          dateEffet: contrat.dateDebut, statut: "Appliqué", exerciceNumero: contrat.exerciceNumero,
        },
      });
      await this.prisma.avenantAssure.createMany({
        data: nouveaux.map((item) => ({
          id: `AVA-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          avenantId: avenantImportId, contratId: dto.contratId, assureId: item.id, nom: item.nom, prenom: item.prenom ?? null,
          matricule: item.matricule, typeAssure: item.type, action: "Incorporation", dateEffet: contrat.dateDebut,
        })),
      });
    }

    const LOT_MAJ = 25;
    for (let i = 0; i < aMettreAJour.length; i += LOT_MAJ) {
      const lot = aMettreAJour.slice(i, i + LOT_MAJ);
      const compteurs = await Promise.all(lot.map(async (item) => {
        const original = existantParMatricule.get(item.matricule);
        const data: Prisma.AssureSanteUpdateInput = {};
        if (item.row.dateNaissance?.trim() && !original?.dateNaissance) data.dateNaissance = item.row.dateNaissance.trim();
        if (item.prenom && !original?.prenom) data.prenom = item.prenom;
        if (item.row.telephone?.trim() && !original?.telephone && item.familleId === null) data.telephone = item.row.telephone.trim();
        // Statut (2026-09) — voir normaliserStatutImport ci-dessus. Jamais
        // sur une personne déjà "Radié" (sortie définitive tracée, même
        // garde-fou que suspendreAssure) — sinon une liste de population
        // qui ne la mentionne plus la ramènerait silencieusement active.
        const statutImporte = normaliserStatutImport(item.row.statut);
        if (statutImporte && original?.statut !== "Radié" && original?.statut !== statutImporte) data.statut = statutImporte;
        if (Object.keys(data).length === 0) return 0;
        await this.prisma.assureSante.update({ where: { id: item.id }, data });
        return 1;
      }));
      updated += compteurs.reduce((s, c) => s + c, 0);
    }

    return { imported, updated, rejected: rejets, resultats };
  }

  // `assureIds` (optionnel) permet au profil Participants de récupérer en un
  // seul appel les PEC de toute une famille (assuré principal + ayants
  // droit) plutôt que de tout charger puis filtrer côté client. `contratId`
  // (optionnel, prioritaire sur `assureIds`) permet à l'onglet Consommations
  // d'un contrat de récupérer directement toutes les PEC du contrat via son
  // contratId dénormalisé (voir PriseEnCharge.contratId, posé une fois à la
  // création — reste rattaché au contrat en vigueur au moment des faits même
  // si l'assuré bascule ensuite vers un autre contrat).
  findPrisesEnCharge(assureIds?: string[], contratId?: string, gestionnaireId?: string) {
    const where: Prisma.PriseEnChargeWhereInput = {
      ...(contratId ? { contratId } : assureIds && assureIds.length > 0 ? { assureId: { in: assureIds } } : {}),
      ...(gestionnaireId ? { gestionnaireId } : {}),
    };
    return this.prisma.priseEnCharge.findMany({
      where,
      // select ciblé (2026-09, était include: {assure, prestataireRef,
      // accordPrealable, acteMedical} en entier) — voir demande utilisateur :
      // "je veux la rapidité, la fluidité" ; mesuré en production sans
      // filtre : 93 Mo de JSON, 14,8s. `prestataireRef`/`accordPrealable`
      // n'étaient même pas lus par ApiPriseEnCharge côté frontend (voir
      // src/services/sante.service.ts) — uniquement `assure.nom` et
      // `acteMedical.categorieGarantie`. Même diagnostic que
      // SanteService.findAssures (voir mémoire project-performance-optimisations).
      select: {
        id: true, assureId: true, contratId: true, prestataire: true, type: true, montant: true, statut: true, date: true,
        modePaiement: true, statutControleMedical: true, motifRejet: true, prescriptionRef: true, factureRef: true,
        baseRemboursement: true, tauxRemboursement: true, franchise: true, plafondApplique: true, resteACharge: true,
        ordrePaiement: true, accordPrealableId: true, scoreFraude: true, gestionnaireId: true, remboursementId: true,
        factureId: true,
        assure: { select: { nom: true, prenom: true } },
        acteMedical: { select: { categorieGarantie: true, libelle: true, famille: true } },
      },
    });
  }

  // Vérifie l'enveloppe partagée d'une rubrique de garantie (ex: Dentisterie
  // Orthodontie + Soins conservateurs) avant d'enregistrer une prise en
  // charge — correspondance texte best-effort entre PriseEnCharge.type et
  // Garantie.libelle (pas de FK stricte), somme sur l'exercice courant
  // (fenêtre dateDebut/dateFin actuelle du contrat).
  private async verifierPlafondPartage(assureId: string, type: string, montant: number) {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureId }, include: { contrat: { include: { garanties: true } } } });
    if (!assure) return;

    const typeLower = type.trim().toLowerCase();
    const garantieCorrespondante = assure.contrat.garanties.find((g) => g.libelle.trim().toLowerCase() === typeLower)
      ?? assure.contrat.garanties.find((g) => typeLower.includes(g.libelle.trim().toLowerCase()) || g.libelle.trim().toLowerCase().includes(typeLower));
    if (!garantieCorrespondante?.plafondMontant) return;

    const enveloppe = assure.contrat.garanties.filter(
      (g) => g.categorie === garantieCorrespondante.categorie && g.plafondMontant?.toString() === garantieCorrespondante.plafondMontant?.toString(),
    );
    const libellesEnveloppe = enveloppe.map((g) => g.libelle.trim().toLowerCase());

    // Fenêtre annuelle ou biennale selon plafondPeriode ("An" | "2 Ans") —
    // même règle que calculerPartPlafonnee (voir demande utilisateur).
    const estBiennal = garantieCorrespondante.plafondPeriode?.trim().toLowerCase() === "2 ans";
    const dateFinFenetre = parseDateFr(assure.contrat.dateFin) ?? new Date();
    const dateDebutFenetre = estBiennal
      ? new Date(dateFinFenetre.getFullYear() - 2, dateFinFenetre.getMonth(), dateFinFenetre.getDate() + 1)
      : (parseDateFr(assure.contrat.dateDebut) ?? new Date(dateFinFenetre.getFullYear(), 0, 1));

    // Rejeté ET Annulé exclus (2026-09) — voir demande utilisateur : "le
    // cumul de la police n'est pas harmonisé avec le reste des données de
    // la police". Une ligne Annulé n'a jamais été payée, au même titre
    // qu'une ligne Rejeté (voir schema.prisma PriseEnCharge.motifAnnulation :
    // "exclue des totaux facturés") — seul Rejeté était exclu ici jusqu'ici.
    const prisesExistantes = await this.prisma.priseEnCharge.findMany({
      where: { assureId, contratId: assure.contratId, statut: { notIn: ["Rejeté", "Annulé"] } },
    });
    const dejaConsomme = prisesExistantes
      .filter((p) => {
        if (!libellesEnveloppe.includes(p.type.trim().toLowerCase())) return false;
        const dLigne = parseDateFr(p.date);
        return dLigne != null && dLigne >= dateDebutFenetre && dLigne <= dateFinFenetre;
      })
      .reduce((sum, p) => sum + Number(p.montant), 0);

    const plafond = Number(garantieCorrespondante.plafondMontant);
    if (dejaConsomme + montant > plafond) {
      throw new BadRequestException(
        `Plafond partagé "${garantieCorrespondante.categorie}" (${plafond.toLocaleString("fr-FR")} F CFA/${garantieCorrespondante.plafondPeriode ?? "an"}) dépassé pour cet assuré sur l'exercice en cours : déjà consommé ${dejaConsomme.toLocaleString("fr-FR")} F CFA.`,
      );
    }
  }

  // Extrait un pourcentage d'un champ texte libre du Contrat (le formulaire
  // suggère "80%" en placeholder, mais ne l'impose pas — beaucoup de
  // contrats sont saisis avec juste "80") — renvoie null si non parsable
  // plutôt que d'échouer, la prise en charge reste alors modifiable
  // manuellement. Le "%" est optionnel : sans ça, une valeur saisie sans le
  // signe (ex. "90") ne matchait jamais et calculerPartAssuranceLigne
  // renvoyait silencieusement {} — base de remboursement/TPS jamais
  // calculées, sans aucune erreur visible (voir Règlement, où la ligne
  // apparaissait à 0 F CFA).
  private parseTauxPourcent(texte: string | null | undefined): number | null {
    if (!texte) return null;
    const m = /(\d+(?:[.,]\d+)?)\s*%?/.exec(texte);
    return m ? Number(m[1].replace(",", ".")) : null;
  }

  // Taux applicable selon secteur du prestataire + nature ambulatoire/
  // hospitalisation — factorisé entre calculerRemboursement (flux
  // Remboursement, inchangé) et calculerPartAssuranceLigne (flux Facture,
  // voir plus bas) pour ne pas dupliquer la lecture des 4 champs de taux du
  // Contrat.
  //
  // Taux ayants droit (2026-08) — VRAIMENT en option (voir demande
  // utilisateur : "la règle est que le taux de l'assuré principal est
  // celui qui s'applique également à ces ayants droit") : les 4 champs
  // "...AyantDroit" du Contrat ne sont consultés QUE si estAyantDroit est
  // vrai, et seulement s'ils sont explicitement renseignés — sinon (valeur
  // vide, cas par défaut) un CJ/EF suit exactement le même taux que
  // l'assuré principal, sans aucun changement de comportement.
  // Rendu public (2026-08) — voir demande utilisateur : "tenir compte de la
  // spécificité des taux pour le type de prestataire (Public/Privé)" :
  // réutilisé par PortailPrestataireController pour afficher à l'écran
  // d'identification le VRAI taux qui s'appliquerait chez CET établissement
  // (Ambulatoire/Hospitalisation), plutôt que Garantie.tauxAssure qui ne
  // varie pas par secteur et ne reflète donc pas le calcul réel.
  tauxParSecteur(
    estHospitalisation: boolean, secteur: string | null | undefined, estAyantDroit: boolean,
    contrat: {
      tauxAmbulatoirePublique: string | null; tauxAmbulatoirePrivee: string | null;
      tauxHospitalisationPublique: string | null; tauxHospitalisationPrivee: string | null;
      tauxAmbulatoirePubliqueAyantDroit: string | null; tauxAmbulatoirePriveeAyantDroit: string | null;
      tauxHospitalisationPubliqueAyantDroit: string | null; tauxHospitalisationPriveeAyantDroit: string | null;
    },
  ): number | null {
    if (!secteur) return null;
    const estPublic = secteur === "Public";
    if (estAyantDroit) {
      const texteAyantDroit = estHospitalisation
        ? (estPublic ? contrat.tauxHospitalisationPubliqueAyantDroit : contrat.tauxHospitalisationPriveeAyantDroit)
        : (estPublic ? contrat.tauxAmbulatoirePubliqueAyantDroit : contrat.tauxAmbulatoirePriveeAyantDroit);
      const tauxAyantDroit = this.parseTauxPourcent(texteAyantDroit);
      if (tauxAyantDroit !== null) return tauxAyantDroit;
    }
    const texte = estHospitalisation
      ? (estPublic ? contrat.tauxHospitalisationPublique : contrat.tauxHospitalisationPrivee)
      : (estPublic ? contrat.tauxAmbulatoirePublique : contrat.tauxAmbulatoirePrivee);
    return this.parseTauxPourcent(texte);
  }

  // Calcule automatiquement le remboursement selon le secteur (Public/
  // Privé) du prestataire consulté et le type de soin — "Hospitalisation"
  // suit tauxHospitalisationPublique/Privee, tout le reste (Consultation,
  // Pharmacie, Analyses, Dentaire...) est considéré ambulatoire et suit
  // tauxAmbulatoirePublique/Privee. Ne calcule rien (objet vide, laissé
  // pour saisie manuelle) si le prestataire n'a pas de secteur renseigné ou
  // si le taux correspondant du contrat est absent/non parsable.
  private async calculerRemboursement(
    dto: CreatePriseEnChargeDto,
    contrat: {
      tauxAmbulatoirePublique: string | null; tauxAmbulatoirePrivee: string | null;
      tauxHospitalisationPublique: string | null; tauxHospitalisationPrivee: string | null;
      tauxAmbulatoirePubliqueAyantDroit: string | null; tauxAmbulatoirePriveeAyantDroit: string | null;
      tauxHospitalisationPubliqueAyantDroit: string | null; tauxHospitalisationPriveeAyantDroit: string | null;
    },
    estAyantDroit: boolean,
  ) {
    if (!dto.prestataireId) return {};
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId }, select: { secteur: true } });
    const taux = this.tauxParSecteur(dto.type === "Hospitalisation", prestataire?.secteur, estAyantDroit, contrat);
    if (taux === null) return {};
    const baseRemboursement = Math.round((dto.montant * taux) / 100);
    return { tauxRemboursement: taux, baseRemboursement, resteACharge: dto.montant - baseRemboursement };
  }

  // Calcul au plafond restant pour une rubrique plafonnée (Optique,
  // Dentisterie, Kinésithérapie & Cure thermale, Maternité, Transport,
  // Autre — la taxonomie Garantie.categorie) : trouve la Garantie du
  // contrat pour cette catégorie, somme la consommation déjà engagée par cet
  // assuré sur la fenêtre du contrat en cours (lignes non rejetées, en
  // excluant la ligne en cours d'édition le cas échéant), et PLAFONNE la
  // part assurance au restant disponible plutôt que de bloquer la saisie —
  // volontairement plus permissif que verifierPlafondPartage (qui, elle,
  // reste inchangée pour le flux Remboursement existant).
  private async calculerPartPlafonnee(assureId: string, contratId: string, categorie: string, montant: number, ligneIdAExclure?: string) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: contratId }, include: { garanties: true } });
    if (!contrat) return {};
    const garantie = contrat.garanties.find((g) => g.categorie === categorie && g.plafondMontant != null);
    if (!garantie?.plafondMontant) return {};

    // Fenêtre de consommation — annuelle (contrat en cours) par défaut, ou
    // biennale (2 ans) selon Garantie.plafondPeriode ("An" | "2 Ans", voir
    // l'éditeur du tableau de garanties) : certaines rubriques ne se
    // réinitialisent que tous les 2 ans, pas à chaque renouvellement annuel
    // (voir demande utilisateur). Le contrat étant prolongé EN PLACE à
    // chaque renouvellement — jamais un nouveau contratId, voir
    // AvenantsService.appliquer — dateDebut/dateFin ne couvrent que la
    // DERNIÈRE période annuelle : une garantie biennale doit donc regarder
    // plus loin en arrière que le contrat en cours pour retrouver la
    // consommation de l'année précédente. Comparaison par vraies dates
    // (parseDateFr), pas par comparaison lexicographique de "jj/mm/aaaa"
    // (fausse dès que le jour et le mois ne varient pas dans le même sens
    // que l'année).
    const estBiennal = garantie.plafondPeriode?.trim().toLowerCase() === "2 ans";
    const dateFinFenetre = parseDateFr(contrat.dateFin) ?? new Date();
    const dateDebutFenetre = estBiennal
      ? new Date(dateFinFenetre.getFullYear() - 2, dateFinFenetre.getMonth(), dateFinFenetre.getDate() + 1)
      : (parseDateFr(contrat.dateDebut) ?? new Date(dateFinFenetre.getFullYear(), 0, 1));

    // Rejeté ET Annulé exclus (2026-09) — même correction que
    // verifierPlafondPartage ci-dessus, voir demande utilisateur "le cumul
    // de la police n'est pas harmonisé".
    const lignes = await this.prisma.priseEnCharge.findMany({
      where: { assureId, contratId, statut: { notIn: ["Rejeté", "Annulé"] }, ...(ligneIdAExclure ? { id: { not: ligneIdAExclure } } : {}) },
    });
    const dejaConsomme = lignes
      .filter((l) => {
        if (l.type !== categorie) return false;
        const dLigne = parseDateFr(l.date);
        return dLigne != null && dLigne >= dateDebutFenetre && dLigne <= dateFinFenetre;
      })
      .reduce((s, l) => s + Number(l.baseRemboursement ?? 0), 0);

    const plafond = Number(garantie.plafondMontant);
    const plafondRestant = Math.max(0, plafond - dejaConsomme);
    const baseRemboursement = Math.min(montant, plafondRestant);
    // Message de reste sur plafond (2026-08) — traduit le tableau de
    // garanties en langage clair pour le gestionnaire/l'assuré, à la fois
    // sur le Certificat de Prise en Charge et en direct à la saisie d'une
    // ligne de facture (voir demande utilisateur, formulations imposées).
    const resteApresCetteDemande = Math.max(0, plafondRestant - baseRemboursement);
    // Espace ASCII classique ( ), pas le séparateur de milliers
    // toLocaleString("fr-FR") (espace fine insécable  ) — illisible
    // une fois rendu dans un PDF en police standard (voir DocumentsService.fmt).
    const resteFormate = Math.round(resteApresCetteDemande).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const messagePlafond = resteApresCetteDemande > 0
      ? `Reste sur plafond de la Rubrique ${resteFormate} pour la prochaine prise en charge.`
      : "Plafond atteint pour la prochaine prise en charge, les frais seront totalement à la charge du bénéficiaire.";
    return { plafondApplique: plafond, baseRemboursement, resteACharge: montant - baseRemboursement, plafondRestant, messagePlafond };
  }

  // Point d'entrée du calcul pour une ligne de Facture (typePrestation dans
  // TYPES_PRESTATION, voir create-facture-ligne.dto.ts) — branche entre
  // calcul au pourcentage (Ambulatoire/Hospitalisation) et calcul au
  // plafond restant (rubriques plafonnées).
  //
  // Plafonnement au tarif de référence de l'acte (2026-08, ActeMedical.
  // prixDefaut = tarif reconnu par l'assurance/le courtier) — un
  // prestataire peut facturer plus cher que ce tarif ; dans ce cas la part
  // assurance (taux% ou plafond de rubrique) se calcule sur le tarif de
  // référence, JAMAIS sur les frais réels facturés, et le dépassement
  // (frais réel - tarif) reste entièrement à la charge de l'assuré, en plus
  // du ticket modérateur habituel. `montant` reste toujours les frais réels
  // (ou les frais réels nets d'un rejet partiel, voir creerLigneFacture) —
  // resteACharge est donc systématiquement recalculé ici à partir de CE
  // montant, jamais du montant plafonné utilisé pour la base. Mêmes règles
  // en saisie de facture et en accord préalable (voir demande utilisateur).
  // quantite (2026-08) — voir demande utilisateur : "la saisie de la
  // pharmacie repose sur trois critères : le médicament, le prix et la
  // quantité" : `montant` reste le TOTAL (déjà quantité × prix unitaire,
  // calculé côté client), donc le plafonnement au tarif de référence de
  // l'acte doit lui aussi porter sur prixDefaut × quantite — sinon un achat
  // de plusieurs boîtes du même médicament se retrouverait plafonné au prix
  // d'une seule unité.
  async calculerPartAssuranceLigne(assureId: string, contratId: string, typePrestation: string, montant: number, prestataireId?: string | null, ligneIdAExclure?: string, acteMedicalId?: string | null, quantite = 1) {
    let montantEffectif = montant;
    let familleActe: string | null = null;
    if (acteMedicalId) {
      const acte = await this.prisma.acteMedical.findUnique({ where: { id: acteMedicalId }, select: { prixDefaut: true, famille: true } });
      if (acte) {
        montantEffectif = Math.min(montant, Number(acte.prixDefaut) * quantite);
        familleActe = acte.famille;
      }
    }

    let part: Record<string, unknown>;
    if (RUBRIQUES_PLAFONNEES.includes(typePrestation)) {
      part = await this.calculerPartPlafonnee(assureId, contratId, typePrestation, montantEffectif, ligneIdAExclure);
    } else if (!prestataireId) {
      part = {};
    } else {
      const contrat = await this.prisma.contrat.findUnique({
        where: { id: contratId },
        select: {
          tauxAmbulatoirePublique: true, tauxAmbulatoirePrivee: true, tauxHospitalisationPublique: true, tauxHospitalisationPrivee: true,
          tauxAmbulatoirePubliqueAyantDroit: true, tauxAmbulatoirePriveeAyantDroit: true, tauxHospitalisationPubliqueAyantDroit: true, tauxHospitalisationPriveeAyantDroit: true,
        },
      });
      const prestataire = contrat ? await this.prisma.prestataire.findUnique({ where: { id: prestataireId }, select: { secteur: true } }) : null;
      const assure = contrat ? await this.prisma.assureSante.findUnique({ where: { id: assureId }, select: { typeAssure: true } }) : null;
      // Pharmacie (2026-08) — voir demande utilisateur : "les taux qui
      // s'appliqueront ici sont ceux des structures privées" : le taux
      // ambulatoire/hospitalisation appliqué à un médicament (ActeMedical.
      // famille === "PHARMACIE") est TOUJOURS celui du secteur Privé,
      // indépendamment du secteur réellement enregistré sur le prestataire.
      const secteurEffectif = familleActe === "PHARMACIE" ? "Privé" : prestataire?.secteur;
      const taux = contrat ? this.tauxParSecteur(typePrestation === "Hospitalisation", secteurEffectif, assure?.typeAssure !== "AS", contrat) : null;
      part = taux === null ? {} : { tauxRemboursement: taux, baseRemboursement: Math.round((montantEffectif * taux) / 100) };
    }

    if ("baseRemboursement" in part) {
      part.resteACharge = montant - Number(part.baseRemboursement);
    }
    return part;
  }

  // TPS (2026-08) — 9,5% de la base de remboursement, prélevée uniquement
  // chez les prestataires assujettis (Prestataire.tpsAssujetti), et
  // seulement sur la fenêtre [tpsDateEffet, tpsDateArret] (arrêt optionnel
  // = toujours actif une fois la date d'effet passée) évaluée à la date de
  // la prestation. Même chez un prestataire assujetti, la chambre/
  // hébergement et les médicaments restent exonérés (ActeMedical.
  // exonereTps). Résultat figé sur la ligne à la saisie — jamais recalculé
  // en direct depuis ces réglages, qui peuvent changer ensuite (voir
  // schema.prisma PriseEnCharge.montantTps).
  private async calculerTps(prestataireId: string | null | undefined, acteMedicalId: string | null | undefined, baseRemboursement: number, dateLigne: string): Promise<number> {
    if (!prestataireId || baseRemboursement <= 0) return 0;
    const prestataire = await this.prisma.prestataire.findUnique({
      where: { id: prestataireId }, select: { tpsAssujetti: true, tpsDateEffet: true, tpsDateArret: true },
    });
    if (!prestataire?.tpsAssujetti) return 0;
    const dLigne = parseDateFr(dateLigne);
    const effet = parseDateFr(prestataire.tpsDateEffet);
    const arret = parseDateFr(prestataire.tpsDateArret);
    if (effet && dLigne && dLigne < effet) return 0;
    if (arret && dLigne && dLigne > arret) return 0;
    if (acteMedicalId) {
      const acte = await this.prisma.acteMedical.findUnique({ where: { id: acteMedicalId }, select: { exonereTps: true } });
      if (acte?.exonereTps) return 0;
    }
    return Math.round((baseRemboursement * TAUX_TPS) / 100);
  }

  // Ajoute une ligne à une Facture existante — voir FacturesService, qui
  // gère l'en-tête. Le rapprochement avec un AccordPrealable (référence de
  // prise en charge) est vérifié ici : l'accord doit appartenir au même
  // assuré, sinon la ligne serait rattachée à un dossier qui ne le concerne
  // pas.
  // `ignorerDoublonMemeJour` (2026-08) — voir demande utilisateur : "la
  // deuxième pharmacie pourra servir le reste" — le traitement partiel
  // multi-prestataire d'un bon (PrescriptionsService.traiter) facture
  // légitimement le MÊME acte, le MÊME jour, pour le MÊME assuré, en
  // plusieurs fois (une fois par prestataire contributeur). Le garde-fou
  // anti-doublon ci-dessous reste actif pour la saisie manuelle normale
  // ("Nouvelle prestation") — le traitement d'un bon a déjà son propre
  // garde-fou, plus strict : la quantité cumulée ne peut jamais dépasser la
  // quantité prescrite (voir PrescriptionLigne.quantiteTraitee).
  // `exigerAffection` (2026-08, défaut true) — voir demande utilisateur :
  // "l'application fera que on doit renseigner le code d'affection pour
  // chaque ligne de saisie de la facture." Vrai pour toute saisie MANUELLE
  // (interne ou portail prestataire "Nouvelle prestation") ; désactivé
  // uniquement par PrescriptionsService.traiter, qui hérite déjà le code
  // affection de la Prescription d'origine sans jamais le faire ressaisir
  // par le prestataire traitant.
  async creerLigneFacture(factureId: string, dto: CreateFactureLigneDto, opts?: { ignorerDoublonMemeJour?: boolean; exigerAffection?: boolean; baseRemboursementImpose?: number }) {
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId }, include: { prestataire: true } });
    if (!facture) throw new NotFoundException(`Facture ${factureId} introuvable`);
    const ligne = await this.creerLigneCommune(
      { contratId: facture.contratId, prestataireId: facture.prestataireId, prestataireNom: facture.prestataire.nom, factureId, modePaiement: "TiersPayant", appliquerTps: true },
      dto, opts,
    );
    // "la saisie de facture des prestations" (2026-08) — voir demande
    // utilisateur : le prestataire a facturé un soin de cet assuré, saisi
    // ici par le gestionnaire côté interne (FactureSaisie.tsx).
    await this.notifierAssure(dto.assureId, `Une facture de ${facture.prestataire.nom} a été enregistrée pour vous (${dto.typePrestation}, ${dto.datePrestation}).`);
    return ligne;
  }

  // Remboursement — même moteur de calcul que Facture (2026-08) — voir
  // demande utilisateur : "on doit avoir le même écran de saisie de
  // facture avec les mêmes règles d'ajout des actes et des personnes ayant
  // consommé". Seule différence structurelle : PAS de prestataire au
  // niveau de l'en-tête (le paiement va à l'assuré principal ou au
  // souscripteur, voir model Remboursement) — chaque LIGNE peut avoir SON
  // PROPRE prestataire (l'assuré a pu consulter plusieurs structures
  // différentes), optionnel : lié au réseau conventionné (Combobox, calcul
  // du taux identique à une Facture) ou simple texte libre si la structure
  // n'est pas conventionnée (voir demande utilisateur historique : "cas où
  // l'assuré a avancé les frais — structure non conventionnée, ou tiers
  // payant indisponible"). Jamais de TPS : elle ne s'applique qu'au
  // règlement d'un prestataire, jamais au remboursement direct de l'assuré.
  async creerLigneRemboursement(remboursementId: string, dto: CreateRemboursementLigneDto, opts?: { exigerAffection?: boolean }) {
    const remb = await this.prisma.remboursement.findUnique({ where: { id: remboursementId } });
    if (!remb) throw new NotFoundException(`Remboursement ${remboursementId} introuvable`);
    if (remb.statut === "Annulée") throw new BadRequestException("Déclaration annulée — impossible d'ajouter une ligne.");
    let prestataireId: string | null = null;
    let prestataireNom: string | null = dto.prestataireNom?.trim() || null;
    if (dto.prestataireId) {
      const p = await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId } });
      if (!p) throw new NotFoundException(`Prestataire ${dto.prestataireId} introuvable`);
      prestataireId = p.id;
      prestataireNom = p.nom;
    }
    if (!prestataireNom) throw new BadRequestException("Le prestataire (recherché dans le réseau, ou saisi librement s'il n'est pas conventionné) est obligatoire.");
    const ligne = await this.creerLigneCommune(
      { contratId: remb.contratId, prestataireId, prestataireNom, remboursementId, modePaiement: "Remboursement", appliquerTps: false },
      dto, { ...opts, ignorerDoublonMemeJour: true }, // même acte le même jour chez plusieurs membres d'une famille est courant en remboursement
    );
    await this.notifierAssure(dto.assureId, `Un remboursement a été enregistré pour vous (${dto.typePrestation}, ${dto.datePrestation}).`);
    return ligne;
  }

  // Cœur commun Facture/Remboursement (2026-08) — toutes les règles de
  // validation et le calcul de la part assurance sont strictement partagés,
  // seul le contexte (contrat/prestataire/en-tête/TPS) diffère selon
  // l'appelant. Voir creerLigneFacture et creerLigneRemboursement.
  // `ignorerDoublonMemeJour` (2026-08) — voir demande utilisateur : "la
  // deuxième pharmacie pourra servir le reste" — le traitement partiel
  // multi-prestataire d'un bon (PrescriptionsService.traiter) facture
  // légitimement le MÊME acte, le MÊME jour, pour le MÊME assuré, en
  // plusieurs fois (une fois par prestataire contributeur). Le garde-fou
  // anti-doublon ci-dessous reste actif pour la saisie manuelle normale
  // ("Nouvelle prestation") — le traitement d'un bon a déjà son propre
  // garde-fou, plus strict : la quantité cumulée ne peut jamais dépasser la
  // quantité prescrite (voir PrescriptionLigne.quantiteTraitee).
  // `exigerAffection` (2026-08, défaut true) — voir demande utilisateur :
  // "l'application fera que on doit renseigner le code d'affection pour
  // chaque ligne de saisie de la facture." Vrai pour toute saisie MANUELLE
  // (interne ou portail prestataire "Nouvelle prestation") ; désactivé
  // uniquement par PrescriptionsService.traiter, qui hérite déjà le code
  // affection de la Prescription d'origine sans jamais le faire ressaisir
  // par le prestataire traitant.
  private async creerLigneCommune(
    ctx: { contratId: string; prestataireId: string | null; prestataireNom: string; factureId?: string; remboursementId?: string; modePaiement: "TiersPayant" | "Remboursement"; appliquerTps: boolean },
    dto: CreateFactureLigneDto,
    opts?: { ignorerDoublonMemeJour?: boolean; exigerAffection?: boolean; baseRemboursementImpose?: number },
  ) {
    // Blocage de saisie post-résiliation (2026-09) — voir
    // verifierSaisieAutorisee ci-dessus. Couvre à la fois les lignes de
    // Facture (saisie interne + portail prestataire) et de Remboursement
    // (portail membre), les deux convergeant ici.
    const contratRef = await this.prisma.contrat.findUniqueOrThrow({
      where: { id: ctx.contratId },
      select: { statut: true, dateFin: true, saisieApresResiliationAutorisee: true },
    });
    verifierSaisieAutorisee(contratRef, dto.datePrestation);
    await verifierAssureNonRetire(this.prisma, ctx.contratId, dto.assureId, dto.datePrestation);
    // Deux modes de tarification mutuellement exclusifs (2026-08) —
    // forfaitaire (catalogue ActeMedical) ou codification (lettre clé +
    // coefficient), voir demande utilisateur.
    if (!dto.acteMedicalId && !dto.lettreCleCode) {
      throw new BadRequestException("Un acte médical (forfait) ou une lettre clé (codification) est obligatoire.");
    }
    // Blocage des doublons (2026-08) — voir demande utilisateur : "bloquer
    // la saisie d'une même prestation faite le même jour pour le même acte
    // et pour le même bénéficiaire... il faudrait que l'acte soit 100% le
    // même pour qu'il ne puisse pas être validé deux fois". Ne s'applique
    // qu'aux actes du catalogue (acteMedicalId identifiant stable) — une
    // ligne codifiée (lettre clé) n'a pas d'identité d'acte comparable ici.
    // Une ligne déjà "Annulé" ou "Rejeté" ne compte pas comme doublon : une
    // correction d'erreur redevient une saisie neuve légitime.
    if (dto.acteMedicalId && !opts?.ignorerDoublonMemeJour) {
      const doublon = await this.prisma.priseEnCharge.findFirst({
        where: { assureId: dto.assureId, date: dto.datePrestation, acteMedicalId: dto.acteMedicalId, statut: { notIn: ["Annulé", "Rejeté"] } },
      });
      if (doublon) throw new BadRequestException("Cet acte a déjà été saisi le même jour pour ce bénéficiaire.");
    }
    if (dto.accordPrealableId) {
      const accord = await this.prisma.accordPrealable.findUnique({ where: { id: dto.accordPrealableId } });
      if (!accord) throw new NotFoundException(`Accord préalable ${dto.accordPrealableId} introuvable`);
      if (accord.assureId !== dto.assureId) throw new BadRequestException("Cet accord préalable ne concerne pas l'assuré sélectionné.");
    }
    // Code affection CNAMGS + nature de l'affection (2026-08) — voir
    // demande utilisateur : "il fallait créer une rubrique nature de
    // l'affection dans la saisie de la facture" — jamais de saisie libre,
    // même catalogue que Prescription.codeAffection. Obligatoires sauf
    // exemption explicite (voir `exigerAffection` ci-dessus).
    if (opts?.exigerAffection !== false && (!dto.codeAffection || !dto.natureMaladie)) {
      throw new BadRequestException("Le code affection et la nature de l'affection sont obligatoires.");
    }
    if (dto.codeAffection) {
      const codeAffection = await this.prisma.codeAffection.findUnique({ where: { code: dto.codeAffection } });
      if (!codeAffection) throw new BadRequestException(`Code affection "${dto.codeAffection}" inconnu.`);
    }
    // Rejet possible dès la saisie (2026-08) — un seul système de saisie
    // (montantRejete), plus de bascule Accepté/Rejeté séparée (voir demande
    // utilisateur) : rejet total = montantRejete >= montant, rejet partiel
    // = montantRejete < montant. statutInitial reste accepté pour
    // compatibilité mais n'est plus envoyé par le formulaire.
    const rejeteeALaSaisie = dto.statutInitial === "Rejeté" || (!!dto.montantRejete && dto.montantRejete >= dto.montant);
    if ((dto.statutInitial === "Rejeté" || !!dto.montantRejete) && !dto.motifRejet?.trim()) {
      throw new BadRequestException("Un motif est obligatoire en cas de rejet, total ou partiel.");
    }
    // Montant retenu pour le calcul de la part assurance/assuré : les frais
    // réels nets du montant rejeté (voir demande utilisateur — "le montant
    // du rejet doit être retiré du montant des frais réel avant de pouvoir
    // calculer la part de l'assurance et celle de l'assuré").
    const montantPourCalcul = rejeteeALaSaisie ? 0 : Math.max(0, dto.montant - (dto.montantRejete ?? 0));
    // Reprise d'antériorité (2026-09 — voir demande utilisateur : "le
    // montant qui remonte est le résultat après le calcul des parts...
    // c'est déjà le net à payer") — un import de factures migre des
    // données d'un ancien système où le montant net à payer est DÉJÀ
    // connu/tranché, jamais à recalculer depuis les taux du contrat
    // MedAssur (qui, de toute façon, ne sont pas forcément renseignés sur
    // un contrat repris — voir project-import-format-tolerance memory).
    // Même principe que la décision déjà tranchée d'un AccordPrealable
    // repris (voir importerAccordsPrealables, import.service.ts).
    const part: Record<string, unknown> = opts?.baseRemboursementImpose !== undefined
      ? { baseRemboursement: opts.baseRemboursementImpose }
      : await this.calculerPartAssuranceLigne(dto.assureId, ctx.contratId, dto.typePrestation, montantPourCalcul, ctx.prestataireId, undefined, dto.acteMedicalId, dto.quantite ?? 1);
    const baseRemboursement = "baseRemboursement" in part ? Number(part.baseRemboursement) : 0;
    // plafondRestant/messagePlafond sont des indications d'affichage (voir
    // demande utilisateur), pas des colonnes du modèle PriseEnCharge — à ne
    // jamais transmettre à Prisma.
    delete part.plafondRestant; delete part.messagePlafond;
    if (opts?.baseRemboursementImpose !== undefined) part.resteACharge = montantPourCalcul - baseRemboursement;
    const montantTps = ctx.appliquerTps ? await this.calculerTps(ctx.prestataireId, dto.acteMedicalId, baseRemboursement, dto.datePrestation) : 0;
    return this.prisma.priseEnCharge.create({
      data: {
        id: `PC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        assureId: dto.assureId, contratId: ctx.contratId,
        prestataire: ctx.prestataireNom, prestataireId: ctx.prestataireId,
        factureId: ctx.factureId, remboursementId: ctx.remboursementId,
        acteMedicalId: dto.acteMedicalId, accordPrealableId: dto.accordPrealableId,
        type: dto.typePrestation, montant: dto.montant, date: dto.datePrestation,
        modePaiement: ctx.modePaiement, statutControleMedical: "Non requis",
        statut: rejeteeALaSaisie ? "Rejeté" : "Déclaré", motifRejet: (rejeteeALaSaisie || dto.montantRejete) ? dto.motifRejet : undefined,
        montantRejete: dto.montantRejete,
        quantite: dto.quantite ?? 1, lettreCleCode: dto.lettreCleCode, coefficient: dto.coefficient,
        nSinistre: dto.nSinistre, nDeclaration: dto.nDeclaration, natureMaladie: dto.natureMaladie, codeAffection: dto.codeAffection,
        medecinId: dto.medecinId,
        ...part, montantTps,
      },
      include: { assure: true, acteMedical: true, accordPrealable: true },
    });
  }

  // Modification d'une ligne déjà saisie (2026-08) — l'écran de saisie de
  // facture doit permettre de rouvrir n'importe quelle ligne déjà ajoutée
  // pour la corriger (voir demande utilisateur : "qu'on puisse voir les
  // lignes qui ont déjà été saisies afin que s'il y a des modifications à
  // faire, on puisse le faire"). Réservé aux lignes pas encore "Rejeté" au
  // sens plein (rejet manuel via rejeterLigneFacture) — l'écran ne propose
  // d'ailleurs le bouton "Modifier" que dans ce cas, pour ne jamais
  // ré-ouvrir/ré-accepter silencieusement une ligne déjà tranchée.
  async modifierLigneFacture(ligneId: string, dto: UpdateFactureLigneDto & { prestataireId?: string | null; prestataireNom?: string }) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId } });
    if (!ligne) throw new NotFoundException(`Ligne ${ligneId} introuvable`);
    if (dto.codeAffection !== undefined) {
      const codeAffection = await this.prisma.codeAffection.findUnique({ where: { code: dto.codeAffection } });
      if (!codeAffection) throw new BadRequestException(`Code affection "${dto.codeAffection}" inconnu.`);
    }

    if (dto.montantRejete && !(dto.motifRejet ?? ligne.motifRejet)?.trim()) {
      throw new BadRequestException("Un motif est obligatoire pour un rejet partiel.");
    }

    // Prestataire par ligne (2026-08) — voir demande utilisateur (Remboursement) :
    // chaque ligne peut avoir SON PROPRE prestataire, distinct des lignes de
    // Facture (prestataire fixé une fois sur l'en-tête, jamais modifié ici).
    // Sans effet pour une ligne de Facture — le formulaire ne transmet
    // jamais ces champs dans ce cas.
    let prestataireUpdate: { prestataire?: string; prestataireId?: string | null } = {};
    let prestataireIdEffectif = ligne.prestataireId;
    if (dto.prestataireId !== undefined || dto.prestataireNom !== undefined) {
      if (dto.prestataireId) {
        const p = await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId } });
        if (!p) throw new NotFoundException(`Prestataire ${dto.prestataireId} introuvable`);
        prestataireUpdate = { prestataireId: p.id, prestataire: p.nom };
        prestataireIdEffectif = p.id;
      } else if (dto.prestataireNom?.trim()) {
        prestataireUpdate = { prestataireId: null, prestataire: dto.prestataireNom.trim() };
        prestataireIdEffectif = null;
      }
    }

    // Rejet total dérivé de montantRejete >= montant, même règle qu'à la
    // création (voir creerLigneFacture) — recalculé dès que l'un des deux
    // change, pour que la ligne redevienne "Déclaré" si le rejet est levé.
    let nouveauStatut: string | undefined;
    if (dto.montant !== undefined || dto.montantRejete !== undefined) {
      const montantFinal = dto.montant ?? Number(ligne.montant);
      const montantRejeteFinal = dto.montantRejete !== undefined ? dto.montantRejete : (ligne.montantRejete != null ? Number(ligne.montantRejete) : 0);
      nouveauStatut = montantRejeteFinal > 0 && montantRejeteFinal >= montantFinal ? "Rejeté" : "Déclaré";
    }

    let part: Record<string, unknown> = {};
    const prestataireChange = prestataireUpdate.prestataireId !== undefined;
    if (dto.typePrestation !== undefined || dto.montant !== undefined || dto.montantRejete !== undefined || dto.acteMedicalId !== undefined || prestataireChange) {
      const typePrestation = dto.typePrestation ?? ligne.type;
      const montant = dto.montant ?? Number(ligne.montant);
      const montantRejete = dto.montantRejete !== undefined ? dto.montantRejete : (ligne.montantRejete != null ? Number(ligne.montantRejete) : 0);
      const acteMedicalId = dto.acteMedicalId !== undefined ? dto.acteMedicalId : ligne.acteMedicalId;
      const montantPourCalcul = nouveauStatut === "Rejeté" ? 0 : Math.max(0, montant - montantRejete);
      const quantiteFinale = dto.quantite !== undefined ? dto.quantite : (ligne.quantite ?? 1);
      part = await this.calculerPartAssuranceLigne(
        dto.assureId ?? ligne.assureId, ligne.contratId, typePrestation, montantPourCalcul, prestataireIdEffectif, ligneId, acteMedicalId, quantiteFinale,
      );
      // plafondRestant/messagePlafond sont des indications d'affichage,
      // jamais des colonnes du modèle PriseEnCharge (voir creerLigneFacture).
      delete part.plafondRestant; delete part.messagePlafond;
    }

    // TPS recalculée dès que l'un des facteurs qui l'influence change —
    // même principe que baseRemboursement ci-dessus (voir calculerTps).
    // Jamais recalculée pour un Remboursement (toujours 0, voir
    // creerLigneRemboursement) — une ligne rattachée à une Facture a
    // toujours ligne.factureId non-null, seul cas où ça s'applique.
    if (ligne.factureId && (dto.typePrestation !== undefined || dto.montant !== undefined || dto.montantRejete !== undefined || dto.acteMedicalId !== undefined || prestataireChange)) {
      const baseRemboursement = "baseRemboursement" in part ? Number(part.baseRemboursement) : (ligne.baseRemboursement != null ? Number(ligne.baseRemboursement) : 0);
      const acteMedicalId = dto.acteMedicalId !== undefined ? dto.acteMedicalId : ligne.acteMedicalId;
      const dateLigne = dto.datePrestation ?? ligne.date;
      part = { ...part, montantTps: await this.calculerTps(prestataireIdEffectif, acteMedicalId, baseRemboursement, dateLigne) };
    }

    return this.prisma.priseEnCharge.update({
      where: { id: ligneId },
      data: {
        assureId: dto.assureId, type: dto.typePrestation, montant: dto.montant, date: dto.datePrestation,
        acteMedicalId: dto.acteMedicalId, accordPrealableId: dto.accordPrealableId,
        montantRejete: dto.montantRejete, motifRejet: dto.motifRejet, statut: nouveauStatut,
        ...prestataireUpdate,
        quantite: dto.quantite, lettreCleCode: dto.lettreCleCode, coefficient: dto.coefficient,
        nSinistre: dto.nSinistre, nDeclaration: dto.nDeclaration, natureMaladie: dto.natureMaladie, codeAffection: dto.codeAffection,
        ...part,
      },
      include: { assure: true, acteMedical: true, accordPrealable: true },
    });
  }

  async rejeterLigneFacture(ligneId: string, motifRejet: string) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId } });
    if (!ligne) throw new NotFoundException(`Ligne ${ligneId} introuvable`);
    return this.prisma.priseEnCharge.update({
      where: { id: ligneId },
      data: { statut: "Rejeté", motifRejet },
      include: { assure: true, acteMedical: true, accordPrealable: true },
    });
  }

  // Annulation d'une ligne (2026-08) — voir demande utilisateur : "on doit
  // pouvoir annuler une prestation faite par erreur". Jamais une
  // suppression (voir supprimerLigneFacture ci-dessous, réservée aux
  // lignes jamais soumises) : la ligne reste visible, avec son motif, pour
  // garder l'historique — voir demande utilisateur : "l'application doit
  // garder l'historique des factures modifiées". Même garde qu'une facture
  // entière (FacturesService.annuler) : un règlement déjà payé ne doit
  // jamais pouvoir être silencieusement rétracté.
  async annulerLigneFacture(ligneId: string, motif: string) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId }, include: { bordereau: true } });
    if (!ligne) throw new NotFoundException(`Ligne ${ligneId} introuvable`);
    if (ligne.statut === "Annulé") throw new BadRequestException("Cette ligne est déjà annulée.");
    if (ligne.bordereau?.statut === "Payé") throw new BadRequestException("Impossible d'annuler : cette ligne est déjà réglée (bordereau payé).");
    if (!motif?.trim()) throw new BadRequestException("Un motif est obligatoire pour annuler une prestation.");
    return this.prisma.priseEnCharge.update({
      where: { id: ligneId },
      data: { statut: "Annulé", motifAnnulation: motif },
      include: { assure: true, acteMedical: true, accordPrealable: true },
    });
  }

  async supprimerLigneFacture(ligneId: string) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId }, include: { facture: true, remboursement: true } });
    if (!ligne) throw new NotFoundException(`Ligne ${ligneId} introuvable`);
    if (ligne.facture?.statut === "Soumise") throw new BadRequestException("Facture déjà soumise — impossible de retirer une ligne.");
    if (ligne.remboursement?.statut === "Soumise") throw new BadRequestException("Déclaration déjà soumise — impossible de retirer une ligne.");
    await this.prisma.priseEnCharge.delete({ where: { id: ligneId } });
    return { id: ligneId };
  }

  // gestionnaireId optionnel (2026-08) — une demande de remboursement
  // soumise en libre-service depuis le portail assuré n'a pas de
  // gestionnaire interne à l'origine (voir PortailMembreController).
  async createPriseEnCharge(dto: CreatePriseEnChargeDto, gestionnaireId?: string) {
    await this.verifierPlafondPartage(dto.assureId, dto.type, dto.montant);
    const assure = await this.findAssureOne(dto.assureId);
    verifierSaisieAutorisee(assure.contrat, dto.date);
    await verifierAssureNonRetire(this.prisma, assure.contratId, dto.assureId, dto.date);
    const remboursement = await this.calculerRemboursement(dto, assure.contrat, assure.typeAssure !== "AS");
    return this.prisma.priseEnCharge.create({
      data: {
        id: `PC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        assureId: dto.assureId, contratId: assure.contratId, prestataire: dto.prestataire, prestataireId: dto.prestataireId,
        type: dto.type, montant: dto.montant, date: dto.date, modePaiement: dto.modePaiement, acteMedicalId: dto.acteMedicalId,
        statut: "Déclaré", statutControleMedical: "Non requis", gestionnaireId,
        ...remboursement,
      },
      include: { assure: true, prestataireRef: true, accordPrealable: true },
    });
  }

  // Pièces jointes d'une demande de remboursement (2026-08) — même principe
  // que AccordPrealableService.uploadDocument : fichier écrit sur disque,
  // seul le nom est stocké en base, un des 4 champs *Fichier selon `type`.
  async uploadRemboursementDocument(id: string, type: "prescription" | "facture" | "quittance" | "autre", file: Express.Multer.File) {
    const pec = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!pec) throw new NotFoundException(`Prise en charge ${id} introuvable`);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || "";
    const filename = `${id}-${type}-${randomUUID().slice(0, 6)}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("remboursements", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_REMBOURSEMENTS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_REMBOURSEMENTS_DIR, filename), file.buffer);
    }
    const champ = { prescription: "prescriptionFichier", facture: "factureFichier", quittance: "quittanceFichier", autre: "autreFichier" }[type];
    return this.prisma.priseEnCharge.update({ where: { id }, data: { [champ]: filename } });
  }

  // Une facture/remboursement reste modifiable après saisie (voir écran
  // Factures). Recalcule le remboursement automatique (voir
  // calculerRemboursement) uniquement si un facteur qui l'influence change
  // (prestataire ou type de soin ou montant) — sinon les valeurs existantes
  // sont conservées telles quelles.
  async updatePriseEnCharge(id: string, dto: UpdatePriseEnChargeDto) {
    const existante = await this.prisma.priseEnCharge.findUnique({ where: { id } });
    if (!existante) throw new NotFoundException(`Prise en charge ${id} introuvable`);

    const influenceRemboursement = dto.prestataireId !== undefined || dto.type !== undefined || dto.montant !== undefined;
    let remboursement = {};
    if (influenceRemboursement) {
      const assure = await this.findAssureOne(existante.assureId);
      remboursement = await this.calculerRemboursement(
        { ...existante, ...dto, assureId: existante.assureId } as CreatePriseEnChargeDto,
        assure.contrat,
        assure.typeAssure !== "AS",
      );
    }

    const mise = await this.prisma.priseEnCharge.update({
      where: { id },
      data: {
        prestataire: dto.prestataire, prestataireId: dto.prestataireId,
        type: dto.type, montant: dto.montant, date: dto.date, modePaiement: dto.modePaiement,
        statut: dto.statut,
        ...remboursement,
      },
      include: { assure: true, prestataireRef: true, accordPrealable: true },
    });
    // Traitement d'une demande de remboursement/facture par le gestionnaire
    // (2026-08) — voir demande utilisateur : "la saisie de facture des
    // prestations" couvre aussi son traitement, pas seulement sa saisie
    // initiale. Uniquement quand le statut change réellement, pour ne pas
    // spammer sur une simple correction de montant.
    if (dto.statut !== undefined && dto.statut !== existante.statut) {
      await this.notifierAssure(existante.assureId, `Votre ${existante.modePaiement === "Remboursement" ? "demande de remboursement" : "prise en charge"} (${id}) est passée au statut "${dto.statut}".`);
    }
    return mise;
  }
}
