import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ParametresOffre } from "../cotation/contenu-offre";
import { CreateAppelOffresDto } from "./dto/create-appel-offres.dto";
import { UpdateAppelOffresDto } from "./dto/update-appel-offres.dto";
import { CreatePropositionDto } from "./dto/create-proposition.dto";
import { UpdatePropositionDto } from "./dto/update-proposition.dto";
import { UploadAppelOffresDocumentDto } from "./dto/upload-document.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

// Même mécanique que Compagnie.logo (CompagniesService.uploadLogo) — fichier
// réel écrit sur disque, servi statiquement via /uploads (voir main.ts) —
// GedDocument, lui, ne stocke aucun fichier réel (métadonnées seules).
const UPLOADS_APPEL_OFFRES_DIR = path.join(UPLOADS_ROOT, "appel-offres");

const INCLUDE = {
  propositions: { include: { cotations: { include: { compagnie: { select: { id: true, nom: true } } } } } },
  prospect: true,
  cotations: { include: { compagnie: { select: { id: true, nom: true, logo: true } } }, orderBy: { dateCreation: "desc" as const } },
  documents: { orderBy: { createdAt: "desc" as const } },
};

@Injectable()
export class AppelOffresService {
  constructor(private prisma: PrismaService, private storage: StorageService, private parametresEntreprise: ParametresEntrepriseService) {}

  findAll() {
    return this.prisma.appelOffres.findMany({ include: INCLUDE, orderBy: { dateCreation: "desc" } });
  }

  async findOne(id: string) {
    const ao = await this.prisma.appelOffres.findUnique({ where: { id }, include: INCLUDE });
    if (!ao) throw new NotFoundException(`Appel d'offres ${id} introuvable`);
    return ao;
  }

  create(dto: CreateAppelOffresDto) {
    const id = `AO-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.appelOffres.create({
      data: { id, ...dto, statut: "En cours", dateCreation: new Date().toLocaleDateString("fr-FR") },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateAppelOffresDto) {
    await this.findOne(id);
    await this.prisma.appelOffres.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  async ajouterProposition(appelOffresId: string, dto: CreatePropositionDto) {
    await this.findOne(appelOffresId);
    const { cotationIds, ...champs } = dto;
    const created = await this.prisma.propositionCommerciale.create({
      data: { appelOffresId, ...champs, statut: "Envoyée" },
    });
    if (cotationIds && cotationIds.length > 0) {
      await this.prisma.cotation.updateMany({ where: { id: { in: cotationIds } }, data: { propositionId: created.id } });
    }
    return this.findOne(appelOffresId);
  }

  private async findPropositionOrThrow(appelOffresId: string, propositionId: string) {
    const proposition = await this.prisma.propositionCommerciale.findUnique({ where: { id: propositionId } });
    if (!proposition || proposition.appelOffresId !== appelOffresId) {
      throw new NotFoundException(`Proposition ${propositionId} introuvable pour l'appel d'offres ${appelOffresId}`);
    }
    return proposition;
  }

  async modifierProposition(appelOffresId: string, propositionId: string, dto: UpdatePropositionDto) {
    await this.findPropositionOrThrow(appelOffresId, propositionId);
    const { cotationIds, ...champs } = dto;
    await this.prisma.propositionCommerciale.update({ where: { id: propositionId }, data: champs });
    if (cotationIds) {
      // Détache tout ce qui était rattaché, puis rattache exactement la
      // sélection reçue — la liste envoyée est toujours la liste complète
      // souhaitée, jamais un delta (même principe que les "replace" listes
      // de CompagniesService).
      await this.prisma.cotation.updateMany({ where: { propositionId }, data: { propositionId: null } });
      if (cotationIds.length > 0) {
        await this.prisma.cotation.updateMany({ where: { id: { in: cotationIds } }, data: { propositionId } });
      }
    }
    return this.findOne(appelOffresId);
  }

  async supprimerProposition(appelOffresId: string, propositionId: string) {
    await this.findPropositionOrThrow(appelOffresId, propositionId);
    await this.prisma.cotation.updateMany({ where: { propositionId }, data: { propositionId: null } });
    await this.prisma.propositionCommerciale.delete({ where: { id: propositionId } });
    return this.findOne(appelOffresId);
  }

  async uploaderDocument(appelOffresId: string, file: Express.Multer.File, dto: UploadAppelOffresDocumentDto) {
    await this.findOne(appelOffresId);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || "";
    const fichier = `${randomUUID()}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("appel-offres", fichier, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_APPEL_OFFRES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_APPEL_OFFRES_DIR, fichier), file.buffer);
    }
    await this.prisma.appelOffresDocument.create({
      data: {
        // Multer décode le nom de fichier en latin1 : « Santé » arrivait en « SantÃ© ».
        appelOffresId, fichier, nom: Buffer.from(file.originalname, "latin1").toString("utf8"), type: dto.type,
        compagnieId: dto.compagnieId, tailleOctets: file.size,
      },
    });
    return this.findOne(appelOffresId);
  }

  // Paramètres du document « Offre santé » : ceux déjà enregistrés pour cet
  // appel d'offres, sinon des valeurs par défaut — les champs propres au
  // cabinet (rédacteur, téléphones, chargée clientèle…) repris de la
  // dernière offre enregistrée pour ne pas les ressaisir à chaque fois.
  async parametresOffre(id: string, userId?: string): Promise<ParametresOffre> {
    const ao = await this.findOne(id);
    if (ao.parametresOffre) return ao.parametresOffre as unknown as ParametresOffre;
    const [p, user, precedent] = await Promise.all([
      this.parametresEntreprise.findOne(),
      userId ? this.prisma.user.findUnique({ where: { id: userId } }) : null,
      this.prisma.appelOffres.findFirst({ where: { parametresOffre: { not: Prisma.DbNull }, NOT: { id } }, orderBy: { dateCreation: "desc" } }),
    ]);
    const prec = (precedent?.parametresOffre ?? null) as unknown as ParametresOffre | null;
    const maintenant = new Date(), an = maintenant.getFullYear();
    const mois = maintenant.toLocaleDateString("fr-FR", { month: "long" });
    const nomSociete = (p?.nom ?? "").toUpperCase();
    return {
      titreDocument: `OFFRES SANTES ${an + 1}`,
      exercice: `EXERCICE ${an}`,
      date: `le ${maintenant.getDate()} ${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${an}`,
      redacteur: prec?.redacteur ?? [nomSociete, `${p?.boitePostale ?? ""} ${(p?.ville ?? "").toUpperCase()}`.trim()],
      chargeClientele: prec?.chargeClientele ?? user?.nom ?? "",
      telephone: prec?.telephone ?? p?.telephone ?? "",
      telecopie: prec?.telecopie ?? "",
      adresseAssure: `${p?.ville ?? "Libreville"}/ Gabon`,
      periode: `du 01.01.${an + 1} au 31.12.${an + 1}`,
      duree: "Un an",
      mentionSignature: prec?.mentionSignature ?? `POUR ${nomSociete} SA`,
      lieuSignature: prec?.lieuSignature ?? p?.ville ?? "Libreville",
      pagesPresentation: prec?.pagesPresentation ?? nomSociete.includes("RUCHE"),
      annexeReseau: prec?.annexeReseau ?? true,
    };
  }

  async enregistrerParametresOffre(id: string, params: ParametresOffre) {
    await this.findOne(id);
    await this.prisma.appelOffres.update({ where: { id }, data: { parametresOffre: params as unknown as Prisma.InputJsonValue } });
    return this.parametresOffre(id);
  }

  async supprimerDocument(appelOffresId: string, documentId: string) {
    const document = await this.prisma.appelOffresDocument.findUnique({ where: { id: documentId } });
    if (!document || document.appelOffresId !== appelOffresId) {
      throw new NotFoundException(`Document ${documentId} introuvable pour l'appel d'offres ${appelOffresId}`);
    }
    if (this.storage.actif) await this.storage.delete("appel-offres", document.fichier);
    else await fs.promises.unlink(path.join(UPLOADS_APPEL_OFFRES_DIR, document.fichier)).catch(() => undefined);
    // Les cotations lues par ARIANA dans ce document partent avec lui.
    await this.prisma.cotation.deleteMany({ where: { documentSourceId: documentId } });
    await this.prisma.appelOffresDocument.delete({ where: { id: documentId } });
    return this.findOne(appelOffresId);
  }
}
