import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Prisma } from "@prisma/client";
import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompagnieDto } from "./dto/create-compagnie.dto";
import { UpdateCompagnieDto } from "./dto/update-compagnie.dto";
import {
  ReplaceAccessoiresDto, ReplaceSurprimesAgeDto, ReplaceClausesAjustementDto,
  ReplaceTerritorialitesDto, ReplaceTauxCouvertureDto, ReplaceGarantiesCatalogueDto,
} from "./dto/replace-listes.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";

const UPLOADS_LOGOS_DIR = path.join(UPLOADS_ROOT, "logos");

const CHILD_INCLUDE = {
  contrats: { select: { prime: true } },
  accessoires: { orderBy: { ordre: "asc" as const } },
  surprimesAge: { orderBy: { ordre: "asc" as const } },
  clausesAjustement: { orderBy: { ordre: "asc" as const } },
  territorialites: { orderBy: { ordre: "asc" as const } },
  tauxCouverture: { orderBy: { ordre: "asc" as const } },
  garantiesCatalogue: { orderBy: [{ branche: "asc" as const }, { ordre: "asc" as const }] },
  compagnieMere: { select: { id: true, nom: true } },
  agence: { select: { id: true, nom: true, code: true } },
};

// Shapes the response to match what the frontend's Compagnie type expects
// (a `contrats` count + cumulative `prime`), computed from the related
// Contrat rows rather than stored redundantly.
function withAggregates<T extends { contrats: { prime: unknown }[] }>(compagnie: T) {
  const { contrats, ...rest } = compagnie;
  return {
    ...rest,
    contrats: contrats.length,
    prime: contrats.reduce((sum, c) => sum + Number(c.prime), 0),
  };
}

@Injectable()
export class CompagniesService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  // N'expose que les vraies compagnies — les profils Auto-Gestion
  // (clientId renseigné, voir schema.prisma) ont leur propre listing.
  async findAll() {
    const compagnies = await this.prisma.compagnie.findMany({ where: { clientId: null }, include: CHILD_INCLUDE });
    return compagnies.map(withAggregates);
  }

  async findAllAutoGestion() {
    const compagnies = await this.prisma.compagnie.findMany({ where: { clientId: { not: null } }, include: CHILD_INCLUDE });
    return compagnies.map(withAggregates);
  }

  // Place un souscripteur en Auto-Gestion : crée son profil "compagnie
  // virtuelle", paramétrable ensuite avec exactement le même écran que les
  // vraies compagnies (commission, accessoires, surprimes d'âge, etc.).
  async createAutoGestion(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} introuvable`);
    const id = `AUTO-${randomUUID().slice(0, 6).toUpperCase()}`;
    try {
      await this.prisma.compagnie.create({ data: { id, nom: client.nom, pays: client.pays || "Gabon", clientId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Le souscripteur ${client.nom} est déjà en auto-gestion.`);
      }
      throw err;
    }
    return this.findOne(id);
  }

  async findOne(id: string) {
    const compagnie = await this.prisma.compagnie.findUnique({ where: { id }, include: CHILD_INCLUDE });
    if (!compagnie) throw new NotFoundException(`Compagnie ${id} introuvable`);
    return withAggregates(compagnie);
  }

  async create(dto: CreateCompagnieDto) {
    const id = `CMP-${randomUUID().slice(0, 6).toUpperCase()}`;
    await this.verifierDeclinaison(dto);
    await this.prisma.compagnie.create({ data: { id, ...dto, compagnieMereId: dto.compagnieMereId || null, agenceId: dto.agenceId || null } });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateCompagnieDto) {
    const avant = await this.findOne(id);
    const data = { ...dto };
    if ("compagnieMereId" in dto) data.compagnieMereId = dto.compagnieMereId || (null as unknown as undefined);
    if ("agenceId" in dto) data.agenceId = dto.agenceId || (null as unknown as undefined);
    await this.verifierDeclinaison(
      { compagnieMereId: "compagnieMereId" in dto ? dto.compagnieMereId : avant.compagnieMereId, agenceId: "agenceId" in dto ? dto.agenceId : avant.agenceId },
      id,
    );
    await this.prisma.compagnie.update({ where: { id }, data });
    return this.findOne(id);
  }

  // Déclinaison d'agence (2026-09) — voir schema.prisma
  // Compagnie.compagnieMereId. Une déclinaison a TOUJOURS une mère ET une
  // agence (l'une sans l'autre ne veut rien dire), sa mère n'est jamais
  // elle-même une déclinaison (un seul niveau), et une mère n'a qu'UNE
  // déclinaison par agence — sinon l'imputation automatique ne saurait
  // plus laquelle choisir.
  private async verifierDeclinaison(dto: { compagnieMereId?: string | null; agenceId?: string | null }, idCourant?: string) {
    const mereId = dto.compagnieMereId || null;
    const agenceId = dto.agenceId || null;
    if (!mereId && !agenceId) return;
    if (!mereId || !agenceId) throw new BadRequestException("Une déclinaison d'agence doit préciser à la fois sa compagnie mère et son agence.");
    if (mereId === idCourant) throw new BadRequestException("Une compagnie ne peut pas être sa propre compagnie mère.");
    const mere = await this.prisma.compagnie.findUnique({ where: { id: mereId }, select: { compagnieMereId: true, nom: true } });
    if (!mere) throw new BadRequestException("Compagnie mère introuvable.");
    if (mere.compagnieMereId) throw new BadRequestException(`"${mere.nom}" est elle-même une déclinaison : choisissez la compagnie principale comme mère.`);
    const existante = await this.prisma.compagnie.findFirst({ where: { compagnieMereId: mereId, agenceId, ...(idCourant ? { id: { not: idCourant } } : {}) }, select: { nom: true } });
    if (existante) throw new ConflictException(`"${existante.nom}" est déjà la déclinaison de "${mere.nom}" pour cette agence.`);
  }

  // Compagnie à laquelle imputer un contrat géré par une agence (2026-09 —
  // voir demande utilisateur : "lorsqu'un contrat est géré par l'agence de
  // POG et est placé sur NSIA, l'application doit directement imputer le
  // contrat à NSIA ASSURANCES POG"). Combine les deux modes demandés :
  //  1. déclinaison DÉCLARÉE dans l'écran Compagnies (paramétrage propre) ;
  //  2. à défaut, et si l'agence l'autorise (Agence.creerDeclinaisonsAuto),
  //     déclinaison CRÉÉE par copie intégrale du paramétrage de la mère,
  //     nommée "<mère> <code de l'agence>" (ex. "NSIA ASSURANCES POG").
  // Retourne null quand rien n'est possible (création auto désactivée, ou
  // agence sans code ni mention pour nommer la déclinaison) — l'appelant
  // garde alors la compagnie choisie et le signale.
  async declinaisonPourAgence(mereId: string, agenceId: string): Promise<{ id: string; nom: string; creee: boolean } | null> {
    const existante = await this.prisma.compagnie.findFirst({ where: { compagnieMereId: mereId, agenceId }, select: { id: true, nom: true } });
    if (existante) return { ...existante, creee: false };

    const agence = await this.prisma.agence.findUnique({ where: { id: agenceId }, select: { code: true, mentionsImport: true, creerDeclinaisonsAuto: true } });
    if (!agence?.creerDeclinaisonsAuto) return null;
    const suffixe = agence.code?.trim() || agence.mentionsImport[0]?.trim();
    if (!suffixe) return null;

    const mere = await this.prisma.compagnie.findUnique({ where: { id: mereId }, include: CHILD_INCLUDE });
    if (!mere) return null;
    const id = `CMP-${randomUUID().slice(0, 6).toUpperCase()}`;
    const {
      id: _id, contrats: _c, accessoires, surprimesAge, clausesAjustement, territorialites, tauxCouverture, garantiesCatalogue,
      compagnieMere: _m, agence: _a, societeId: _s, clientId: _cl, logo: _l, ...champs
    } = mere;
    const nom = `${mere.nom} ${suffixe}`;
    const sansLien = <T extends { id: string; compagnieId: string | null }>(lignes: T[]) =>
      lignes.map(({ id: _i, compagnieId: _ci, ...reste }) => ({ ...reste, compagnieId: id }));
    await this.prisma.$transaction([
      this.prisma.compagnie.create({ data: { ...champs, id, nom, logo: mere.logo, compagnieMereId: mereId, agenceId } as Prisma.CompagnieUncheckedCreateInput }),
      this.prisma.compagnieAccessoireTranche.createMany({ data: sansLien(accessoires) }),
      this.prisma.compagnieSurprimeAge.createMany({ data: sansLien(surprimesAge) }),
      this.prisma.compagnieClauseAjustement.createMany({ data: sansLien(clausesAjustement) }),
      this.prisma.compagnieTerritorialite.createMany({ data: sansLien(territorialites) }),
      this.prisma.compagnieTauxCouverture.createMany({ data: sansLien(tauxCouverture) }),
      this.prisma.garantieCatalogue.createMany({ data: sansLien(garantiesCatalogue) as Prisma.GarantieCatalogueCreateManyInput[] }),
    ]);
    return { id, nom, creee: true };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.compagnie.delete({ where: { id } });
    return { id };
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("logos", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_LOGOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_LOGOS_DIR, filename), file.buffer);
    }
    await this.prisma.compagnie.update({ where: { id }, data: { logo: filename } });
    return this.findOne(id);
  }

  async deleteLogo(id: string) {
    const c = await this.findOne(id);
    if (c.logo) {
      if (this.storage.actif) await this.storage.delete("logos", c.logo);
      else await fs.promises.unlink(path.join(UPLOADS_LOGOS_DIR, c.logo)).catch(() => undefined);
    }
    await this.prisma.compagnie.update({ where: { id }, data: { logo: null } });
    return this.findOne(id);
  }

  // "Remplace toute la liste" — même pattern que ContratsService.replaceGaranties :
  // le client envoie systématiquement la liste complète à jour, supprimée
  // puis recréée en une transaction plutôt qu'un CRUD ligne par ligne.

  async replaceAccessoires(id: string, dto: ReplaceAccessoiresDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.compagnieAccessoireTranche.deleteMany({ where: { compagnieId: id } }),
      this.prisma.compagnieAccessoireTranche.createMany({
        data: dto.tranches.map((t, ordre) => ({ ...t, compagnieId: id, ordre })),
      }),
    ]);
    return this.findOne(id);
  }

  async replaceSurprimesAge(id: string, dto: ReplaceSurprimesAgeDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.compagnieSurprimeAge.deleteMany({ where: { compagnieId: id } }),
      this.prisma.compagnieSurprimeAge.createMany({
        data: dto.tranches.map((t, ordre) => ({ ...t, compagnieId: id, ordre })),
      }),
    ]);
    return this.findOne(id);
  }

  async replaceClausesAjustement(id: string, dto: ReplaceClausesAjustementDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.compagnieClauseAjustement.deleteMany({ where: { compagnieId: id } }),
      this.prisma.compagnieClauseAjustement.createMany({
        data: dto.clauses.map((c, ordre) => ({ ...c, compagnieId: id, ordre })),
      }),
    ]);
    return this.findOne(id);
  }

  async replaceTerritorialites(id: string, dto: ReplaceTerritorialitesDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.compagnieTerritorialite.deleteMany({ where: { compagnieId: id } }),
      this.prisma.compagnieTerritorialite.createMany({
        data: dto.libelles.map((l, ordre) => ({ ...l, compagnieId: id, ordre })),
      }),
    ]);
    return this.findOne(id);
  }

  async replaceTauxCouverture(id: string, dto: ReplaceTauxCouvertureDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.compagnieTauxCouverture.deleteMany({ where: { compagnieId: id } }),
      this.prisma.compagnieTauxCouverture.createMany({
        data: dto.taux.map((t, ordre) => ({ ...t, compagnieId: id, ordre })),
      }),
    ]);
    return this.findOne(id);
  }

  // Ne remplace que la branche visée (Maladie OU Assistance) — une
  // compagnie a deux catalogues de garanties distincts, voir schema.prisma.
  async replaceGarantiesCatalogue(id: string, dto: ReplaceGarantiesCatalogueDto) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.garantieCatalogue.deleteMany({ where: { compagnieId: id, branche: dto.branche } }),
      this.prisma.garantieCatalogue.createMany({
        data: dto.lignes.map((l, ordre) => ({ ...l, compagnieId: id, branche: dto.branche, ordre })),
      }),
    ]);
    return this.findOne(id);
  }
}
