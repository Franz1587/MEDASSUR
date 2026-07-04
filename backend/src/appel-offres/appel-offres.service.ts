import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAppelOffresDto } from "./dto/create-appel-offres.dto";
import { CreatePropositionDto } from "./dto/create-proposition.dto";

@Injectable()
export class AppelOffresService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.appelOffres.findMany({ include: { propositions: true, prospect: true } });
  }

  async findOne(id: string) {
    const ao = await this.prisma.appelOffres.findUnique({
      where: { id },
      include: { propositions: true, prospect: true },
    });
    if (!ao) throw new NotFoundException(`Appel d'offres ${id} introuvable`);
    return ao;
  }

  create(dto: CreateAppelOffresDto) {
    return this.prisma.appelOffres.create({
      data: { id: randomUUID(), ...dto, statut: "En cours", dateCreation: new Date().toLocaleDateString("fr-FR") },
    });
  }

  async ajouterProposition(appelOffresId: string, dto: CreatePropositionDto) {
    await this.findOne(appelOffresId);
    return this.prisma.propositionCommerciale.create({
      data: { appelOffresId, ...dto, statut: "Envoyée" },
    });
  }
}
