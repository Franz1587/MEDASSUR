import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMedecinDto } from "./dto/create-medecin.dto";
import { UpdateMedecinDto } from "./dto/update-medecin.dto";

const INCLUDE_STRUCTURES = { structures: { include: { prestataire: true } } } as const;

// Professionnel de santé (2026-08) — voir demande utilisateur : "il faut à
// présent rendre possible l'ajout d'un médecin et sa spécialité dans le
// prestataire... créer un onglet professionnel de santé [rubrique
// Système]... créer des médecins, puis les lier à une clinique, hôpital...
// car un même médecin peut faire des prestations dans plusieurs structures
// médicales." Medecin est un modèle séparé de Prestataire (qui reste la
// STRUCTURE) — voir schema.prisma pour la relation plusieurs-à-plusieurs
// MedecinPrestataire.
@Injectable()
export class MedecinsService {
  constructor(private prisma: PrismaService) {}

  findAll(filtres?: { q?: string; prestataireId?: string }) {
    return this.prisma.medecin.findMany({
      where: {
        ...(filtres?.q
          ? { OR: [{ nom: { contains: filtres.q, mode: "insensitive" } }, { specialite: { contains: filtres.q, mode: "insensitive" } }, { codePraticien: { contains: filtres.q, mode: "insensitive" } }] }
          : {}),
        ...(filtres?.prestataireId ? { structures: { some: { prestataireId: filtres.prestataireId } } } : {}),
      },
      include: INCLUDE_STRUCTURES,
      orderBy: { nom: "asc" },
    });
  }

  async findOne(id: string) {
    const medecin = await this.prisma.medecin.findUnique({ where: { id }, include: INCLUDE_STRUCTURES });
    if (!medecin) throw new NotFoundException(`Médecin ${id} introuvable`);
    return medecin;
  }

  async create(dto: CreateMedecinDto) {
    const { prestataireIds, ...header } = dto;
    return this.prisma.medecin.create({
      data: {
        ...header,
        structures: prestataireIds?.length ? { create: prestataireIds.map((prestataireId) => ({ prestataireId })) } : undefined,
      },
      include: INCLUDE_STRUCTURES,
    });
  }

  async update(id: string, dto: UpdateMedecinDto) {
    await this.findOne(id);
    return this.prisma.medecin.update({ where: { id }, data: dto, include: INCLUDE_STRUCTURES });
  }

  // Suppression bloquée si le médecin a déjà été désigné bénéficiaire d'un
  // règlement (2026-08) — voir BordereauReglement.medecinId : perdre cette
  // traçabilité comptable romprait l'historique des paiements déjà émis.
  async remove(id: string) {
    await this.findOne(id);
    const nbReglements = await this.prisma.bordereauReglement.count({ where: { medecinId: id } });
    if (nbReglements > 0) {
      throw new BadRequestException(`Ce médecin est référencé par ${nbReglements} règlement(s) — désactivez-le plutôt que de le supprimer.`);
    }
    await this.prisma.medecin.delete({ where: { id } });
  }

  async lierStructure(medecinId: string, prestataireId: string) {
    await this.findOne(medecinId);
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire) throw new NotFoundException(`Prestataire ${prestataireId} introuvable`);
    await this.prisma.medecinPrestataire.upsert({
      where: { medecinId_prestataireId: { medecinId, prestataireId } },
      create: { medecinId, prestataireId },
      update: {},
    });
    return this.findOne(medecinId);
  }

  async delierStructure(medecinId: string, prestataireId: string) {
    await this.prisma.medecinPrestataire.deleteMany({ where: { medecinId, prestataireId } });
    return this.findOne(medecinId);
  }
}
