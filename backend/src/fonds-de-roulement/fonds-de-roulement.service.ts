import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFondsDeRoulementDto } from "./dto/create-fonds-de-roulement.dto";
import { ConsommerDto } from "./dto/consommer.dto";

function computeStatut(restant: number, seuilAlerte: number): string {
  if (restant <= 0) return "Épuisé";
  if (restant <= seuilAlerte) return "Alerte";
  return "Normal";
}

@Injectable()
export class FondsDeRoulementService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.fondsDeRoulement.findMany({ include: { contrat: { include: { client: true } } } });
  }

  create(dto: CreateFondsDeRoulementDto) {
    return this.prisma.fondsDeRoulement.create({
      data: { ...dto, montantConsomme: 0, statut: "Normal" },
      include: { contrat: { include: { client: true } } },
    });
  }

  async consommer(id: string, dto: ConsommerDto) {
    const f = await this.prisma.fondsDeRoulement.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`Fonds de roulement ${id} introuvable`);

    const montantConsomme = Number(f.montantConsomme) + dto.montant;
    const restant = Number(f.montantInitial) - montantConsomme;
    const statut = computeStatut(restant, Number(f.seuilAlerte));

    return this.prisma.fondsDeRoulement.update({
      where: { id }, data: { montantConsomme, statut },
      include: { contrat: { include: { client: true } } },
    });
  }
}
