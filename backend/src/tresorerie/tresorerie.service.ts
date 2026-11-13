import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFluxDto } from "./dto/create-flux.dto";

// Plafond de la liste des flux (le frontend ne pagine pas) — voir findFlux.
const PLAFOND_FLUX = 500;

function parseDateFr(s?: string | null): number {
  if (!s) return 0;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d).getTime() : 0;
}

@Injectable()
export class TresorerieService {
  constructor(private prisma: PrismaService) {}

  findComptes() {
    return this.prisma.compteBancaire.findMany();
  }

  // `date` est un texte JJ/MM/AAAA (tri SQL non chronologique) : les
  // PLAFOND_FLUX mouvements les plus récents sont sélectionnés par id (cuid,
  // préfixé par l'horodatage de création) puis triés par date réelle décroissante.
  async findFlux() {
    const flux = await this.prisma.fluxTresorerie.findMany({ orderBy: { id: "desc" }, take: PLAFOND_FLUX });
    return flux.sort((a, b) => parseDateFr(b.date) - parseDateFr(a.date));
  }

  // Mouvement + mise à jour du solde dans UNE transaction. Le solde est
  // modifié par une écriture atomique conditionnelle (increment/decrement en
  // Decimal, garde anti-découvert dans le WHERE) : deux décaissements
  // concurrents ne peuvent plus dépasser le solde disponible.
  async createFlux(dto: CreateFluxDto) {
    const montant = new Prisma.Decimal(dto.montant).toDecimalPlaces(2);
    if (!montant.isFinite() || montant.lte(0)) throw new BadRequestException("Le montant doit être strictement positif.");

    return this.prisma.$transaction(async (tx) => {
      const maj = dto.type === "Encaissement"
        ? await tx.compteBancaire.updateMany({ where: { id: dto.compteId }, data: { solde: { increment: montant } } })
        : await tx.compteBancaire.updateMany({ where: { id: dto.compteId, solde: { gte: montant } }, data: { solde: { decrement: montant } } });

      if (maj.count === 0) {
        const compte = await tx.compteBancaire.findUnique({ where: { id: dto.compteId }, select: { id: true } });
        if (!compte) throw new NotFoundException(`Compte ${dto.compteId} introuvable`);
        throw new BadRequestException("Ce décaissement dépasse le solde disponible sur ce compte.");
      }

      return tx.fluxTresorerie.create({
        data: { date: dto.date, libelle: dto.libelle, type: dto.type, montant, rapproche: false },
      });
    });
  }

  async rapprocher(id: string) {
    const flux = await this.prisma.fluxTresorerie.findUnique({ where: { id } });
    if (!flux) throw new NotFoundException(`Mouvement ${id} introuvable`);
    return this.prisma.fluxTresorerie.update({ where: { id }, data: { rapproche: true } });
  }
}
