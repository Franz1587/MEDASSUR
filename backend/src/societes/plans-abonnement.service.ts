import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePlanAbonnementDto } from "./dto/create-plan-abonnement.dto";
import { UpdatePlanAbonnementDto } from "./dto/update-plan-abonnement.dto";

// Catalogue des plans d'abonnement (2026-09) — voir demande utilisateur :
// "il revient au super Admin de donner accès à ces modules là en fonction
// du type d'abonnement souscrit". Géré exclusivement par le Super Admin
// (voir PlansAbonnementController) ; ne fait que PRÉ-REMPLIR
// SocieteAssurance.modules à l'affectation (voir SocietesService.update) —
// modifier un plan existant ne change RIEN aux sociétés qui l'utilisent
// déjà (même principe que RoleModuleTemplate, jamais relu après coup).
@Injectable()
export class PlansAbonnementService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.planAbonnement.findMany({
      orderBy: { ordre: "asc" },
      include: { _count: { select: { societes: true } } },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.planAbonnement.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan d'abonnement ${id} introuvable`);
    return plan;
  }

  async create(dto: CreatePlanAbonnementDto) {
    try {
      return await this.prisma.planAbonnement.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Un plan nommé "${dto.nom}" existe déjà.`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdatePlanAbonnementDto) {
    await this.findOne(id);
    try {
      return await this.prisma.planAbonnement.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Un plan nommé "${dto.nom}" existe déjà.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    const plan = await this.prisma.planAbonnement.findUnique({ where: { id }, include: { _count: { select: { societes: true } } } });
    if (!plan) throw new NotFoundException(`Plan d'abonnement ${id} introuvable`);
    if (plan._count.societes > 0) {
      throw new BadRequestException(`Impossible de supprimer "${plan.nom}" — ${plan._count.societes} société(s) l'utilisent encore.`);
    }
    await this.prisma.planAbonnement.delete({ where: { id } });
    return { id };
  }
}
