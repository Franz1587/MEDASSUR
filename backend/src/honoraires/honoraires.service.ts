import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHonorairesDto } from "./dto/create-honoraires.dto";

@Injectable()
export class HonorairesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.honorairesGestion.findMany({ include: { contrat: { include: { client: true } } } });
  }

  create(dto: CreateHonorairesDto) {
    const brut = (dto.montantSinistres * dto.tauxHonoraires) / 100;
    // FCFA sans sous-unité utilisée en pratique — toujours arrondi.
    const montantHonoraires = Math.round(dto.plafond !== undefined ? Math.min(brut, dto.plafond) : brut);
    return this.prisma.honorairesGestion.create({
      data: { ...dto, montantHonoraires, statut: "En attente" },
      include: { contrat: { include: { client: true } } },
    });
  }

  async facturer(id: string) {
    const h = await this.prisma.honorairesGestion.findUnique({ where: { id } });
    if (!h) throw new NotFoundException(`Honoraires ${id} introuvables`);
    return this.prisma.honorairesGestion.update({
      where: { id }, data: { statut: "Facturé" },
      include: { contrat: { include: { client: true } } },
    });
  }
}
