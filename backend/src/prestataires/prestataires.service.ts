import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";

@Injectable()
export class PrestatairesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.prestataire.findMany({ include: { grillesTarifaires: true } });
  }

  async findOne(id: string) {
    const prestataire = await this.prisma.prestataire.findUnique({
      where: { id },
      include: { grillesTarifaires: true, prisesEnCharge: true },
    });
    if (!prestataire) throw new NotFoundException(`Prestataire ${id} introuvable`);
    return prestataire;
  }

  create(dto: CreatePrestataireDto) {
    return this.prisma.prestataire.create({ data: { id: randomUUID(), ...dto } });
  }

  async update(id: string, dto: UpdatePrestataireDto) {
    await this.findOne(id);
    return this.prisma.prestataire.update({ where: { id }, data: dto });
  }

  /** Suspension d'un prestataire (fraude, surtarification, non-respect des délais). */
  async suspendre(id: string, motif: string) {
    await this.findOne(id);
    return this.prisma.prestataire.update({
      where: { id },
      data: { statutConvention: "Suspendu", motifSuspension: motif },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.prestataire.delete({ where: { id } });
    return { id };
  }
}
