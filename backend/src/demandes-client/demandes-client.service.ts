import * as fs from "fs";
import * as path from "path";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MouvementsService, type AjoutMouvement } from "../mouvements/mouvements.service";
import type { RoleId } from "../auth/role.enum";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { CreateDemandeClientDto } from "./dto/create-demande-client.dto";
import { DecisionDemandeClientDto } from "./dto/decision-demande-client.dto";
import { numeroPolice } from "../lib/police.util";

// Même dossier que SanteService.UPLOADS_PHOTOS_DIR — une photo ajoutée ici
// est transmise TELLE QUELLE à l'AssureSante réellement créée à
// l'approbation (voir decider ci-dessous), sans copie de fichier.
const UPLOADS_PHOTOS_DIR = path.join(UPLOADS_ROOT, "photos");

// Rôles internes qui gèrent la population des contrats (voir src/auth/
// roles.ts allowedModules "avenants"/"participants") — reçoivent une
// notification à chaque demande client et sont seuls habilités à trancher,
// même principe que ROLES_NOTIFIES_PORTAIL dans AccordPrealableService.
export const ROLES_GESTION_DEMANDES_CLIENT: RoleId[] = ["administrateur", "directeur_technique", "gestionnaire_production"];

function libelleBeneficiaires(dto: CreateDemandeClientDto): string {
  if (dto.type === "Retrait") return `Retrait — ${dto.assureId}`;
  const noms = (dto.beneficiaires ?? []).map((b) => b.nom).join(", ");
  return `Incorporation — ${noms}`;
}

@Injectable()
export class DemandesClientService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private mouvements: MouvementsService,
    private storage: StorageService,
  ) {}

  // Création côté portail client (2026-08) — voir demande utilisateur :
  // "initier des opérations comme des incorporations et retrait". contratId
  // doit appartenir au client connecté ; jamais de mouvement réel ici, juste
  // l'enregistrement de la demande (voir decider() pour l'application). Une
  // incorporation peut porter PLUSIEURS bénéficiaires (assuré principal +
  // ayants droit) — un seul d'entre eux au plus peut être "AS" (voir
  // demande utilisateur).
  async create(dto: CreateDemandeClientDto, demandeurId: string, clientId: string) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: dto.contratId } });
    if (!contrat) throw new NotFoundException("Contrat introuvable");
    if (contrat.clientId !== clientId) throw new ForbiddenException("Contrat inaccessible");

    if (dto.type === "Incorporation") {
      if (!dto.beneficiaires || dto.beneficiaires.length === 0) throw new BadRequestException("Au moins un bénéficiaire à incorporer est requis.");
      if (dto.beneficiaires.filter((b) => b.typeAssure === "AS").length > 1) throw new BadRequestException("Une seule personne peut être assuré principal dans la même demande.");
      for (const b of dto.beneficiaires) {
        if (b.typeAssure !== "AS" && !b.familleId && !b.familleRefLocale) {
          throw new BadRequestException(`La famille d'accueil est requise pour ${b.nom} (conjoint/enfant).`);
        }
      }
    } else if (!dto.assureId) {
      throw new BadRequestException("Le bénéficiaire à retirer est requis.");
    }

    const demande = await this.prisma.demandeClient.create({
      data: {
        id: `DCL-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        contratId: dto.contratId, type: dto.type, dateDemande: dto.dateDemande,
        assureId: dto.assureId, motifRetrait: dto.motifRetrait,
        demandeurId, clientId,
        beneficiaires: dto.beneficiaires ? { create: dto.beneficiaires.map((b) => ({ ...b })) } : undefined,
      },
      include: { assureRetrait: true, contrat: true, beneficiaires: true },
    });

    const destinataires = await this.prisma.user.findMany({ where: { roleId: { in: ROLES_GESTION_DEMANDES_CLIENT } }, select: { id: true } });
    const libelle = dto.type === "Incorporation" ? libelleBeneficiaires(dto) : `Retrait — ${demande.assureRetrait?.nom ?? dto.assureId}`;
    await Promise.all(
      destinataires.map((u) =>
        this.notifications.create("Gestionnaire", u.id, `Nouvelle demande client (${demande.id}) : ${libelle} — police ${numeroPolice(contrat)}`).catch(() => undefined),
      ),
    );
    return demande;
  }

  // Photo d'un bénéficiaire (2026-08) — voir demande utilisateur : "rendre
  // possible l'ajout des photos pour rendre possible l'édition des cartes
  // côté assurance". Chargée une fois le bénéficiaire créé (même principe
  // que AccordPrealableService.uploadDocument) ; clientId vérifie que la
  // demande porteuse appartient bien au client connecté.
  async uploadPhotoBeneficiaire(beneficiaireId: string, clientId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const beneficiaire = await this.prisma.demandeClientBeneficiaire.findUnique({ where: { id: beneficiaireId }, include: { demandeClient: true } });
    if (!beneficiaire) throw new NotFoundException(`Bénéficiaire ${beneficiaireId} introuvable`);
    if (beneficiaire.demandeClient.clientId !== clientId) throw new ForbiddenException(`Bénéficiaire ${beneficiaireId} inaccessible`);
    if (beneficiaire.demandeClient.statut !== "En attente") throw new BadRequestException("Cette demande est déjà traitée.");

    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `dcl-${beneficiaireId}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("photos", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_PHOTOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_PHOTOS_DIR, filename), file.buffer);
    }
    return this.prisma.demandeClientBeneficiaire.update({ where: { id: beneficiaireId }, data: { photo: filename } });
  }

  findMine(clientId: string) {
    return this.prisma.demandeClient.findMany({
      where: { clientId },
      include: { contrat: true, assureRetrait: true, beneficiaires: true },
      orderBy: { dateDemande: "desc" },
    });
  }

  // Côté gestionnaire — toutes les demandes, filtrables par statut.
  findAll(statut?: string) {
    return this.prisma.demandeClient.findMany({
      where: statut ? { statut } : undefined,
      include: { contrat: { include: { client: true } }, demandeur: true, assureRetrait: true, beneficiaires: true },
      orderBy: { dateDemande: "desc" },
    });
  }

  // Décision gestionnaire (2026-08) — "Accordée" transforme la demande en
  // mouvement réel via MouvementsService.appliquerMouvement, LE point
  // d'entrée unique déjà utilisé par l'écran interne "Gérer les assurés"
  // (voir mouvements.service.ts:73) — donc mêmes effets de bord (création/
  // radiation AssureSante, recalcul de prime, Avenant) qu'une saisie
  // interne directe. "Refusée" se contente d'enregistrer le motif.
  //
  // Incorporation en 2 temps quand un assuré principal ET ses ayants droit
  // sont dans la même demande (voir demande utilisateur) : l'assuré
  // principal est créé D'ABORD (son id réel n'existe pas avant), puis les
  // ayants droit marqués familleRefLocale sont rattachés à CET id — d'où
  // deux appels à appliquerMouvement (donc potentiellement deux Avenant,
  // tracés tous les deux dans avenantId).
  // Notifie tous les comptes portail rattachés au client de ce contrat
  // (2026-08) — voir demande utilisateur : "la notification doit signaler...
  // les différentes opérations faites par l'assurance sur le contrat (pour
  // le client)". Silencieux si le client n'a encore aucun compte portail.
  private async notifierClientDuContrat(contratId: string, message: string): Promise<void> {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true } });
    if (!contrat) return;
    const comptes = await this.prisma.user.findMany({ where: { clientId: contrat.clientId }, select: { id: true } });
    await Promise.all(comptes.map((u) => this.notifications.create("Client", u.id, message).catch(() => undefined)));
  }

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production". Réutilise
  // `gestionnaireId` (déjà posé définitivement à la décision, voir decider
  // ci-dessous) comme marqueur de prise en charge anticipée — même champ,
  // juste posé plus tôt : aucune migration nécessaire, et decider() qui
  // suit se contente de l'écraser avec la même valeur (le décideur EST
  // l'agent qui avait pris le dossier, dans l'immense majorité des cas).
  async prendre(id: string, userId: string) {
    const demande = await this.prisma.demandeClient.findUnique({ where: { id } });
    if (!demande) throw new NotFoundException(`Demande ${id} introuvable`);
    if (demande.gestionnaireId && demande.gestionnaireId !== userId) {
      throw new ConflictException("Déjà pris en charge par un autre agent.");
    }
    return this.prisma.demandeClient.update({ where: { id }, data: { gestionnaireId: userId } });
  }

  async decider(id: string, dto: DecisionDemandeClientDto, gestionnaireId: string) {
    const demande = await this.prisma.demandeClient.findUnique({ where: { id }, include: { beneficiaires: true } });
    if (!demande) throw new NotFoundException(`Demande ${id} introuvable`);
    if (demande.statut !== "En attente") throw new BadRequestException(`Demande ${id} déjà traitée.`);

    if (dto.decision === "Refusée") {
      const refusee = await this.prisma.demandeClient.update({
        where: { id },
        data: { statut: "Refusée", motifRefus: dto.motifRefus, dateTraitement: dto.dateEffet, gestionnaireId },
      });
      await this.notifierClientDuContrat(demande.contratId, `Votre demande de ${demande.type === "Incorporation" ? "incorporation" : "retrait"} (${id}) a été refusée${dto.motifRefus ? ` — ${dto.motifRefus}` : ""}.`);
      return refusee;
    }

    if (!dto.dateEffet) throw new BadRequestException("La date d'effet est requise pour accorder une demande.");
    const avenantIds: string[] = [];

    if (demande.type === "Incorporation") {
      if (demande.beneficiaires.length === 0) throw new BadRequestException("Demande d'incorporation incomplète (aucun bénéficiaire).");
      const cotisationDe = (beneficiaireId: string) => dto.cotisations?.find((c) => c.beneficiaireId === beneficiaireId);
      const versAjout = (b: (typeof demande.beneficiaires)[number], familleId?: string): AjoutMouvement => {
        const c = cotisationDe(b.id);
        return {
          nom: b.nom, prenom: b.prenom ?? undefined, beneficiaires: c?.beneficiaires ?? 0, cotisation: c?.cotisation ?? 0,
          dateNaissance: b.dateNaissance ?? undefined, typeAssure: b.typeAssure, familleId,
          telephone: b.telephone ?? undefined, sexe: b.sexe ?? undefined, adresse: b.adresse ?? undefined,
          scolarise: b.scolarise ?? undefined, photo: b.photo ?? undefined,
        };
      };

      const asLigne = demande.beneficiaires.find((b) => b.typeAssure === "AS");
      const dependants = demande.beneficiaires.filter((b) => b.typeAssure !== "AS");
      let idAsNouveau: string | undefined;

      if (asLigne) {
        const resultat = await this.mouvements.appliquerMouvement(demande.contratId, dto.dateEffet, [versAjout(asLigne)], []);
        idAsNouveau = resultat.crees[0]?.id;
        if (resultat.avenants[0]) avenantIds.push(resultat.avenants[0].id);
      }
      if (dependants.length > 0) {
        const ajoutsDependants = dependants.map((d) => versAjout(d, d.familleRefLocale ? idAsNouveau : d.familleId ?? undefined));
        const resultat = await this.mouvements.appliquerMouvement(demande.contratId, dto.dateEffet, ajoutsDependants, []);
        if (resultat.avenants[0]) avenantIds.push(resultat.avenants[0].id);
      }
    } else {
      if (!demande.assureId) throw new BadRequestException("Demande de retrait incomplète (bénéficiaire manquant).");
      const resultat = await this.mouvements.appliquerMouvement(demande.contratId, dto.dateEffet, [], [
        { assureId: demande.assureId, motif: demande.motifRetrait ?? undefined },
      ]);
      if (resultat.avenants[0]) avenantIds.push(resultat.avenants[0].id);
    }

    const accordee = await this.prisma.demandeClient.update({
      where: { id },
      data: { statut: "Accordée", dateTraitement: dto.dateEffet, gestionnaireId, avenantId: avenantIds.join(",") },
    });
    await this.notifierClientDuContrat(demande.contratId, `Votre demande de ${demande.type === "Incorporation" ? "incorporation" : "retrait"} (${id}) a été accordée, effective au ${dto.dateEffet}.`);
    return accordee;
  }
}
