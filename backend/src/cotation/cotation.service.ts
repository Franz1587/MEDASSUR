import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCotationDto } from "./dto/create-cotation.dto";
import { UpdateCotationDto } from "./dto/update-cotation.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";

// Même taux que documents.service.ts (TAUX_TAXE_GABON) — redéclaré ici pour
// ne pas introduire de dépendance entre modules pour une seule constante.
const TAUX_TAXE_GABON = 0.08;

// Logo du client pour les cotations sans appel d'offres (donc sans Prospect
// à rattacher, voir CrmService.uploadLogo pour le même pattern) — repli
// utilisé par DocumentsService.renderCotationOffre.
const UPLOADS_LOGOS_DIR = path.join(UPLOADS_ROOT, "logos-cotations");

const INCLUDE = {
  compagnie: { select: { id: true, nom: true, logo: true } },
  appelOffres: { select: { id: true, clientNom: true } },
  garanties: { orderBy: { ordre: "asc" as const } },
} as const;

@Injectable()
export class CotationService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  findAll(appelOffresId?: string) {
    return this.prisma.cotation.findMany({
      where: appelOffresId ? { appelOffresId } : undefined,
      include: INCLUDE,
      orderBy: { dateCreation: "desc" },
    });
  }

  async findOne(id: string) {
    const cotation = await this.prisma.cotation.findUnique({ where: { id }, include: INCLUDE });
    if (!cotation) throw new NotFoundException(`Cotation ${id} introuvable`);
    return cotation;
  }

  create(dto: CreateCotationDto, gestionnaireId?: string) {
    const montantCartes = dto.montantCartes ?? 0;
    const montantAccessoires = dto.montantAccessoires ?? 0;
    const montantTaxe = Math.round((dto.primeNette + montantCartes + montantAccessoires) * TAUX_TAXE_GABON);
    const primeTTC = dto.primeNette + montantCartes + montantAccessoires + montantTaxe;

    return this.prisma.cotation.create({
      data: {
        id: `COT-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        appelOffresId: dto.appelOffresId,
        compagnieId: dto.compagnieId,
        gestionnaireId,
        branche: dto.branche,
        clientNom: dto.clientNom,
        population: dto.population,
        territorialite: dto.territorialite,
        tauxCouvertureAmbulatoire: dto.tauxCouvertureAmbulatoire,
        tauxCouvertureHospitalisation: dto.tauxCouvertureHospitalisation,
        exclusions: dto.exclusions,
        clauseAjustement: dto.clauseAjustement,
        limiteAgeAdulte: dto.limiteAgeAdulte,
        limiteAgeEnfant: dto.limiteAgeEnfant,
        plafondFamilial: dto.plafondFamilial,
        conditionsFermete: dto.conditionsFermete,
        primeNette: dto.primeNette,
        montantCartes,
        montantAccessoires,
        montantTaxe,
        primeTTC,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
        garanties: {
          create: dto.garanties.map((g, ordre) => ({ ...g, ordre })),
        },
      },
      include: INCLUDE,
    });
  }

  // Toute cotation reste modifiable après enregistrement (voir écran
  // Cotation, bouton "Modifier" sur une ligne du tableau historique) —
  // recalcule montantTaxe/primeTTC comme à la création, et remplace
  // entièrement les garanties si une nouvelle liste est fournie (même
  // pattern "remplace toute la liste" que CompagniesService).
  async update(id: string, dto: UpdateCotationDto) {
    const existing = await this.prisma.cotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Cotation ${id} introuvable`);

    const primeNette = dto.primeNette ?? Number(existing.primeNette);
    const montantCartes = dto.montantCartes ?? Number(existing.montantCartes);
    const montantAccessoires = dto.montantAccessoires ?? Number(existing.montantAccessoires);
    const montantTaxe = Math.round((primeNette + montantCartes + montantAccessoires) * TAUX_TAXE_GABON);
    const primeTTC = primeNette + montantCartes + montantAccessoires + montantTaxe;

    await this.prisma.$transaction([
      this.prisma.cotation.update({
        where: { id },
        data: {
          appelOffresId: dto.appelOffresId,
          compagnieId: dto.compagnieId,
          branche: dto.branche,
          clientNom: dto.clientNom,
          population: dto.population,
          territorialite: dto.territorialite,
          tauxCouvertureAmbulatoire: dto.tauxCouvertureAmbulatoire,
          tauxCouvertureHospitalisation: dto.tauxCouvertureHospitalisation,
          exclusions: dto.exclusions,
          clauseAjustement: dto.clauseAjustement,
          limiteAgeAdulte: dto.limiteAgeAdulte,
          limiteAgeEnfant: dto.limiteAgeEnfant,
          plafondFamilial: dto.plafondFamilial,
          conditionsFermete: dto.conditionsFermete,
          primeNette, montantCartes, montantAccessoires, montantTaxe, primeTTC,
        },
      }),
      ...(dto.garanties
        ? [
          this.prisma.cotationGarantieLigne.deleteMany({ where: { cotationId: id } }),
          this.prisma.cotationGarantieLigne.createMany({
            data: dto.garanties.map((g, ordre) => ({ ...g, cotationId: id, ordre })),
          }),
        ]
        : []),
    ]);

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.cotation.delete({ where: { id } });
    return { id };
  }

  // Même pattern que CompagniesService.uploadLogo/deleteLogo — utilisé
  // uniquement quand la cotation n'a pas d'appel d'offres (donc pas de
  // Prospect propre, voir CrmService.uploadLogo pour ce cas).
  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("logos-cotations", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_LOGOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_LOGOS_DIR, filename), file.buffer);
    }
    await this.prisma.cotation.update({ where: { id }, data: { logo: filename } });
    return this.findOne(id);
  }

  async deleteLogo(id: string) {
    const c = await this.findOne(id);
    if (c.logo) {
      if (this.storage.actif) await this.storage.delete("logos-cotations", c.logo);
      else await fs.promises.unlink(path.join(UPLOADS_LOGOS_DIR, c.logo)).catch(() => undefined);
    }
    await this.prisma.cotation.update({ where: { id }, data: { logo: null } });
    return this.findOne(id);
  }
}
