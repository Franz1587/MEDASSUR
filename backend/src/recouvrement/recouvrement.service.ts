import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const NIVEAUX = ["Relance 1", "Relance 2", "Mise en demeure", "Contentieux"];

@Injectable()
export class RecouvrementService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.impaye.findMany({ include: { client: true, contrat: true } });
  }

  private async findOneOrThrow(id: string) {
    const i = await this.prisma.impaye.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Impayé ${id} introuvable`);
    return i;
  }

  async relancer(id: string) {
    const i = await this.findOneOrThrow(id);
    const idx = NIVEAUX.indexOf(i.niveau);
    const niveau = idx >= 0 && idx < NIVEAUX.length - 1 ? NIVEAUX[idx + 1] : i.niveau;
    return this.prisma.impaye.update({
      where: { id }, data: { niveau, statut: "En cours" },
      include: { client: true, contrat: true },
    });
  }

  async relancerTous() {
    const enCours = await this.prisma.impaye.findMany({ where: { statut: "En cours" } });
    for (const i of enCours) {
      const idx = NIVEAUX.indexOf(i.niveau);
      const niveau = idx >= 0 && idx < NIVEAUX.length - 1 ? NIVEAUX[idx + 1] : i.niveau;
      await this.prisma.impaye.update({ where: { id: i.id }, data: { niveau } });
    }
    return { relances: enCours.length };
  }

  async resoudre(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.impaye.update({
      where: { id }, data: { statut: "Résolu" },
      include: { client: true, contrat: true },
    });
  }
}
