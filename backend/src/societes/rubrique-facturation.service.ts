import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRubriqueFacturationDto, UpdateRubriqueFacturationDto } from "./dto/rubrique-facturation.dto";

// Catalogue des rubriques de facturation (2026-09) — voir demande
// utilisateur : "le type de facture n'est pas les rubriques de facture.
// les rubriques font référence aux différentes lignes de facturation
// (installation, licence, carte, récupération de données...)". Chaque
// ligne d'une FactureAbonnement peut se rattacher à une rubrique de ce
// catalogue (voir FactureAbonnementLigne.rubriqueCode) — géré librement
// par le Super Admin, jamais figé.
@Injectable()
export class RubriqueFacturationService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.rubriqueFacturation.findMany({ orderBy: { ordre: "asc" } });
  }

  async create(dto: CreateRubriqueFacturationDto) {
    try {
      return await this.prisma.rubriqueFacturation.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`Une rubrique de code "${dto.code}" existe déjà.`);
      }
      throw err;
    }
  }

  async update(code: string, dto: UpdateRubriqueFacturationDto) {
    const r = await this.prisma.rubriqueFacturation.findUnique({ where: { code } });
    if (!r) throw new NotFoundException(`Rubrique ${code} introuvable`);
    return this.prisma.rubriqueFacturation.update({ where: { code }, data: dto });
  }

  // Une rubrique déjà utilisée sur au moins une ligne de facture n'est
  // jamais supprimée (l'historique resterait avec un code orphelin sans
  // libellé consultable) — voir demande utilisateur : rubriques ajoutables
  // librement, mais une facture émise doit rester lisible dans le temps.
  // "Désactiver" (actif=false, via update) reste possible et masque la
  // rubrique des nouveaux formulaires sans toucher à l'historique.
  async remove(code: string) {
    const r = await this.prisma.rubriqueFacturation.findUnique({ where: { code } });
    if (!r) throw new NotFoundException(`Rubrique ${code} introuvable`);
    const utilisee = await this.prisma.factureAbonnementLigne.count({ where: { rubriqueCode: code } });
    if (utilisee > 0) {
      throw new BadRequestException(`Impossible de supprimer "${r.libelle}" — ${utilisee} ligne(s) de facture l'utilisent déjà. Désactivez-la plutôt (elle disparaîtra des nouveaux formulaires).`);
    }
    await this.prisma.rubriqueFacturation.delete({ where: { code } });
    return { code };
  }
}
