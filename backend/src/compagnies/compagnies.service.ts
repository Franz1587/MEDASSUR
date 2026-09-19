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
      await this.prisma.compagnie.create({ data: { id, nom: client.nom, pays: client.pays, clientId } });
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

  create(dto: CreateCompagnieDto) {
    const id = `CMP-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.compagnie.create({ data: { id, ...dto } }).then(() => this.findOne(id));
  }

  async update(id: string, dto: UpdateCompagnieDto) {
    await this.findOne(id);
    await this.prisma.compagnie.update({ where: { id }, data: dto });
    return this.findOne(id);
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
