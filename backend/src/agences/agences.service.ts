import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAgenceDto } from "./dto/create-agence.dto";

// Agence (2026-09) — voir schema.prisma Agence pour le détail de la demande
// utilisateur. CRUD volontairement minimal, même esprit que BanquesService
// (référentiel léger cloisonné par société via le middleware Prisma).
@Injectable()
export class AgencesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.agence.findMany({ orderBy: { nom: "asc" } });
  }

  async findOne(id: string) {
    const agence = await this.prisma.agence.findUnique({ where: { id } });
    if (!agence) throw new NotFoundException(`Agence ${id} introuvable`);
    return agence;
  }

  create(dto: CreateAgenceDto) {
    return this.prisma.agence.create({ data: { id: randomUUID(), ...dto } });
  }

  async update(id: string, dto: Partial<CreateAgenceDto>) {
    await this.findOne(id);
    return this.prisma.agence.update({ where: { id }, data: dto });
  }

  // Retire l'agence des agents qui y étaient rattachés avant suppression
  // (jamais de FK cassée) — un agent sans agence retombe simplement sur le
  // comportement "—" déjà existant sur le Décompte/Règlement.
  async remove(id: string) {
    await this.findOne(id);
    const nbAgents = await this.prisma.user.count({ where: { agenceId: id } });
    if (nbAgents > 0) {
      throw new BadRequestException(`${nbAgents} agent(s) sont encore rattachés à cette agence — réaffectez-les avant de la supprimer.`);
    }
    await this.prisma.agence.delete({ where: { id } });
    return { id };
  }
}
