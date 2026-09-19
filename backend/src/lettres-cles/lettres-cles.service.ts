import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLettreCleDto } from "./dto/create-lettre-cle.dto";
import { UpdateLettreCleDto } from "./dto/update-lettre-cle.dto";

// Nomenclature à lettres clés (2026-08) — catalogue paramétrable, voir
// schema.prisma LettreCle. KC/KA/K Loc (chirurgien/anesthésiste/location du
// bloc) sont un trio particulier dont seul le KC porte un coefficient saisi
// librement à l'acte — KA et K Loc dérivent leur coefficient à la volée
// (KC/2, puis KC+KA), voir CODES_BUNDLE_CHIRURGICAL ci-dessous, consommé par
// le frontend (FactureSaisie/AccordPrealable) pour proposer la génération
// automatique du trio.
export const CODES_BUNDLE_CHIRURGICAL = ["KC", "KA", "K Loc"];

@Injectable()
export class LettresClesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.lettreCle.findMany({ orderBy: { code: "asc" } });
  }

  async findOne(code: string) {
    const l = await this.prisma.lettreCle.findUnique({ where: { code } });
    if (!l) throw new NotFoundException(`Lettre clé ${code} introuvable`);
    return l;
  }

  async create(dto: CreateLettreCleDto) {
    const existant = await this.prisma.lettreCle.findUnique({ where: { code: dto.code } });
    if (existant) throw new BadRequestException(`La lettre clé "${dto.code}" existe déjà.`);
    return this.prisma.lettreCle.create({ data: dto });
  }

  async update(code: string, dto: UpdateLettreCleDto) {
    await this.findOne(code);
    return this.prisma.lettreCle.update({ where: { code }, data: dto });
  }

  async remove(code: string) {
    await this.findOne(code);
    const utiliseeLigne = await this.prisma.priseEnCharge.findFirst({ where: { lettreCleCode: code } });
    if (utiliseeLigne) throw new BadRequestException(`"${code}" est déjà utilisée sur au moins une ligne de facture — désactivez-la plutôt que de la supprimer.`);
    const utiliseeActe = await this.prisma.acteMedical.findFirst({ where: { lettreCleCode: code } });
    if (utiliseeActe) throw new BadRequestException(`"${code}" est rattachée à au moins un acte du catalogue (ex. "${utiliseeActe.libelle}") — désactivez-la plutôt que de la supprimer.`);
    await this.prisma.lettreCle.delete({ where: { code } });
    return { code };
  }
}
