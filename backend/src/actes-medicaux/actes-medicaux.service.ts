import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateActeMedicalDto } from "./dto/create-acte-medical.dto";
import { UpdateActeMedicalDto } from "./dto/update-acte-medical.dto";

@Injectable()
export class ActesMedicauxService {
  constructor(private prisma: PrismaService) {}

  findAll(famille?: string) {
    return this.prisma.acteMedical.findMany({
      where: famille ? { famille } : undefined,
      orderBy: [{ famille: "asc" }, { libelle: "asc" }],
      include: { lettreCle: true },
    });
  }

  async findOne(id: string) {
    const acte = await this.prisma.acteMedical.findUnique({ where: { id }, include: { lettreCle: true } });
    if (!acte) throw new NotFoundException(`Acte médical ${id} introuvable`);
    return acte;
  }

  async create(dto: CreateActeMedicalDto) {
    if (!dto.lettreCleCode && dto.prixDefaut == null) {
      throw new BadRequestException("Le prix par défaut est obligatoire pour un acte non codifié à une lettre clé.");
    }
    const data = await this.resoudrePrixCodifie(dto);
    return this.prisma.acteMedical.create({ data: data as Prisma.ActeMedicalCreateInput });
  }

  async update(id: string, dto: UpdateActeMedicalDto) {
    await this.findOne(id);
    const data = await this.resoudrePrixCodifie(dto);
    return this.prisma.acteMedical.update({ where: { id }, data: data as Prisma.ActeMedicalUpdateInput });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.acteMedical.delete({ where: { id } });
    return { id };
  }

  // Prix forfaitaire manuel OU codifié à la lettre clé (2026-08) — quand
  // lettreCleCode est renseigné, prixDefaut est TOUJOURS recalculé ici,
  // jamais saisi à la main (voir demande utilisateur : "le système remonte
  // son coefficient... son prix sera automatique : 1800 x 100 = 180000").
  private async resoudrePrixCodifie(dto: CreateActeMedicalDto | UpdateActeMedicalDto): Promise<Record<string, unknown>> {
    if (dto.lettreCleCode === undefined) return { ...dto };
    if (!dto.lettreCleCode) return { ...dto, lettreCleCode: null, coefficient: null };
    if (dto.coefficient == null) {
      throw new BadRequestException("Le coefficient est obligatoire pour un acte codifié à une lettre clé.");
    }
    const lettreCle = await this.prisma.lettreCle.findUnique({ where: { code: dto.lettreCleCode } });
    if (!lettreCle) throw new BadRequestException(`Lettre clé "${dto.lettreCleCode}" introuvable.`);
    return { ...dto, prixDefaut: dto.coefficient * Number(lettreCle.valeurUnitaire) };
  }
}
