import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCourrierDto } from "./dto/create-courrier.dto";

// Courrier Maladie (2026-08) — éditeur façon Word, voir demande utilisateur.
// Référence auto-générée incluant les initiales de l'agent qui génère le
// courrier (voir schema.prisma Courrier.reference, User.initiales déjà
// existant) — même esprit que ContratsService (id CTR-{année}-{6 car.}).
@Injectable()
export class CourrierService {
  constructor(private prisma: PrismaService) {}

  async findAll(filtres: {
    reference?: string; typeId?: string; destinataire?: string; auteurId?: string; du?: string; au?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filtres.reference) where.reference = { contains: filtres.reference, mode: "insensitive" };
    if (filtres.typeId) where.typeId = filtres.typeId;
    if (filtres.destinataire) where.destinataireNom = { contains: filtres.destinataire, mode: "insensitive" };
    if (filtres.auteurId) where.auteurId = filtres.auteurId;
    if (filtres.du || filtres.au) {
      where.dateCreation = {
        ...(filtres.du ? { gte: filtres.du } : {}),
        ...(filtres.au ? { lte: filtres.au } : {}),
      };
    }
    return this.prisma.courrier.findMany({
      where,
      include: { type: true, auteur: { select: { id: true, nom: true, initiales: true } }, client: true, prestataire: true, assure: true },
      orderBy: { dateCreation: "desc" },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.courrier.findUnique({
      where: { id },
      include: { type: true, auteur: { select: { id: true, nom: true, initiales: true } }, client: true, prestataire: true, assure: true },
    });
    if (!c) throw new NotFoundException(`Courrier ${id} introuvable`);
    return c;
  }

  async create(dto: CreateCourrierDto, auteurId: string) {
    const auteur = await this.prisma.user.findUnique({ where: { id: auteurId } });
    if (!auteur) throw new NotFoundException(`Utilisateur ${auteurId} introuvable`);

    const annee = new Date().getFullYear();
    const suffixe = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const reference = `COUR-${annee}-${suffixe}-${auteur.initiales}`;

    return this.prisma.courrier.create({
      data: {
        reference,
        typeId: dto.typeId ?? null,
        objet: dto.objet,
        destinataireNom: dto.destinataireNom,
        destinataireAdresse: dto.destinataireAdresse ?? null,
        clientId: dto.clientId ?? null,
        prestataireId: dto.prestataireId ?? null,
        assureId: dto.assureId ?? null,
        corps: dto.corps,
        auteurId,
        dateCreation: dto.dateCreation,
      },
      include: { type: true, auteur: { select: { id: true, nom: true, initiales: true } }, client: true, prestataire: true, assure: true },
    });
  }
}
