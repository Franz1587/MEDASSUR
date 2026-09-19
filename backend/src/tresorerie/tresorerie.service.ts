import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFluxDto } from "./dto/create-flux.dto";

@Injectable()
export class TresorerieService {
  constructor(private prisma: PrismaService) {}

  findComptes() {
    return this.prisma.compteBancaire.findMany();
  }

  findFlux() {
    return this.prisma.fluxTresorerie.findMany({ orderBy: { date: "desc" } });
  }

  async createFlux(dto: CreateFluxDto) {
    const compte = await this.prisma.compteBancaire.findUnique({ where: { id: dto.compteId } });
    if (!compte) throw new NotFoundException(`Compte ${dto.compteId} introuvable`);

    const nouveauSolde = dto.type === "Encaissement" ? Number(compte.solde) + dto.montant : Number(compte.solde) - dto.montant;
    if (nouveauSolde < 0) throw new BadRequestException("Ce décaissement dépasse le solde disponible sur ce compte.");

    await this.prisma.compteBancaire.update({ where: { id: dto.compteId }, data: { solde: nouveauSolde } });
    return this.prisma.fluxTresorerie.create({
      data: { date: dto.date, libelle: dto.libelle, type: dto.type, montant: dto.montant, rapproche: false },
    });
  }

  async rapprocher(id: string) {
    const flux = await this.prisma.fluxTresorerie.findUnique({ where: { id } });
    if (!flux) throw new NotFoundException(`Mouvement ${id} introuvable`);
    return this.prisma.fluxTresorerie.update({ where: { id }, data: { rapproche: true } });
  }
}
