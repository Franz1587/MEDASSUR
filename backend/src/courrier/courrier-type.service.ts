import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCourrierTypeDto } from "./dto/create-courrier-type.dto";
import { UpdateCourrierTypeDto } from "./dto/update-courrier-type.dto";

// Modèles de courrier paramétrables (2026-08) — voir schema.prisma
// CourrierType. Même forme que LettresClesService (catalogue paramétrable
// simple).
@Injectable()
export class CourrierTypeService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.courrierType.findMany({ orderBy: { libelle: "asc" } });
  }

  async findOne(id: string) {
    const t = await this.prisma.courrierType.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Modèle de courrier ${id} introuvable`);
    return t;
  }

  create(dto: CreateCourrierTypeDto) {
    return this.prisma.courrierType.create({ data: dto });
  }

  async update(id: string, dto: UpdateCourrierTypeDto) {
    await this.findOne(id);
    return this.prisma.courrierType.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const utilise = await this.prisma.courrier.findFirst({ where: { typeId: id } });
    if (utilise) throw new BadRequestException(`Ce modèle est déjà utilisé par au moins un courrier (ex. "${utilise.reference}") — désactivez-le plutôt que de le supprimer.`);
    await this.prisma.courrierType.delete({ where: { id } });
    return { id };
  }
}
