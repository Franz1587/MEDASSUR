import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AvenantsService } from "../avenants/avenants.service";
import { CreateResiliationDto } from "./dto/create-resiliation.dto";

const INCLUDE = { contrat: { include: { client: true } } } as const;

// Vocabulaire externe historique de cet écran ("Demandée"/"Validée"/
// "Effective") <-> vocabulaire interne partagé par tous les avenants
// ("Brouillon"/"Validé"/"Appliqué") — voir schema.prisma Avenant.statut.
const STATUT_EXTERNE: Record<string, string> = { "Brouillon": "Demandée", "Validé": "Validée", "Appliqué": "Effective" };
const STATUT_INTERNE: Record<string, string> = { "Demandée": "Brouillon", "Validée": "Validé", "Effective": "Appliqué" };

interface AvenantResiliation {
  id: string;
  contratId: string;
  motif: string | null;
  dateEffet: string;
  ristourne: Prisma.Decimal | null;
  initiateur: string | null;
  statut: string;
  contrat: { branche: string; client: { nom: string } };
}

// Simple adaptateur de lecture/écriture sur `Avenant` (type "Résiliation")
// — plus de table `Resiliation` propre (voir schema.prisma). Contrôleur,
// routes, DTO et forme de réponse inchangés pour ne rien casser côté
// frontend.
@Injectable()
export class ResiliationsService {
  constructor(private prisma: PrismaService, private avenants: AvenantsService) {}

  private mapper(a: AvenantResiliation) {
    return {
      id: a.id,
      contratId: a.contratId,
      motif: a.motif ?? "",
      dateEffet: a.dateEffet,
      ristourne: a.ristourne ?? 0,
      initiateur: a.initiateur ?? "",
      statut: STATUT_EXTERNE[a.statut] ?? a.statut,
      contrat: a.contrat,
    };
  }

  async findAll() {
    const avenants = await this.prisma.avenant.findMany({
      where: { type: "Résiliation" },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return avenants.map((a) => this.mapper(a));
  }

  private async findOneOrThrow(id: string) {
    const a = await this.prisma.avenant.findUnique({ where: { id }, include: INCLUDE });
    if (!a || a.type !== "Résiliation") throw new NotFoundException(`Résiliation ${id} introuvable`);
    return a;
  }

  async findOne(id: string) {
    return this.mapper(await this.findOneOrThrow(id));
  }

  async create(dto: CreateResiliationDto) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: dto.contratId } });
    if (!contrat) throw new NotFoundException("Contrat introuvable");
    const primeAvant = Number(contrat.prime);
    const created = await this.avenants.create({
      contratId: dto.contratId,
      type: "Résiliation",
      description: `Résiliation — ${dto.motif}`,
      primeAvant,
      primeApres: primeAvant - dto.ristourne,
      dateEffet: dto.dateEffet,
      statut: STATUT_INTERNE[dto.statut] ?? "Brouillon",
      motif: dto.motif, ristourne: dto.ristourne, initiateur: dto.initiateur,
    });
    return this.mapper(created);
  }

  async valider(id: string) {
    await this.findOneOrThrow(id);
    return this.mapper(await this.avenants.setStatut(id, "Validé"));
  }

  // La résiliation est un type d'avenant : "rendre effective" ==
  // "appliquer" l'avenant (voir AvenantsService.appliquer, qui met le
  // contrat en statut "Résilié" pour ce type précis).
  async rendreEffective(id: string) {
    await this.findOneOrThrow(id);
    return this.mapper(await this.avenants.appliquer(id));
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    return this.avenants.remove(id);
  }
}
