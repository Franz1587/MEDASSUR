import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEncaissementDto } from "./dto/create-encaissement.dto";

const INCLUDE = { contrat: { include: { client: true, compagnie: true } } } as const;

// Encaissements de prime (2026-08) — voir demande utilisateur : saisie
// manuelle des paiements reçus des souscripteurs (aucun autre flux ne les
// génère aujourd'hui), source du Bordereau d'Encaissement
// (BordereauxService.encaissement).
@Injectable()
export class EncaissementsService {
  constructor(private prisma: PrismaService) {}

  findAll(contratId?: string) {
    return this.prisma.encaissementPrime.findMany({
      where: contratId ? { contratId } : undefined,
      include: INCLUDE,
      orderBy: { dateEncaissement: "desc" },
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.encaissementPrime.findUnique({ where: { id }, include: INCLUDE });
    if (!e) throw new NotFoundException(`Encaissement ${id} introuvable`);
    return e;
  }

  create(dto: CreateEncaissementDto) {
    return this.prisma.encaissementPrime.create({ data: dto, include: INCLUDE });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.encaissementPrime.delete({ where: { id } });
    return { id };
  }
}
