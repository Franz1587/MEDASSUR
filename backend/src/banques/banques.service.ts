import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBanqueDto } from "./dto/create-banque.dto";
import { CreateLotChequesDto } from "./dto/create-lot-cheques.dto";

const INCLUDE_LOTS = { lots: { orderBy: { createdAt: "desc" as const } } };

@Injectable()
export class BanquesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.banque.findMany({ include: INCLUDE_LOTS, orderBy: { nom: "asc" } });
  }

  async findOne(id: string) {
    const banque = await this.prisma.banque.findUnique({ where: { id }, include: INCLUDE_LOTS });
    if (!banque) throw new NotFoundException(`Banque ${id} introuvable`);
    return banque;
  }

  create(dto: CreateBanqueDto) {
    return this.prisma.banque.create({ data: { id: randomUUID(), ...dto }, include: INCLUDE_LOTS });
  }

  async update(id: string, dto: Partial<CreateBanqueDto> & { statut?: string }) {
    await this.findOne(id);
    return this.prisma.banque.update({ where: { id }, data: dto, include: INCLUDE_LOTS });
  }

  // Un nouveau lot de numéros de chèque pré-paramétré pour cette banque —
  // toujours créé "Actif" ; `numeroProchain` démarre à `numeroDebut`. Voir
  // ReglementComptableService.genererLettreCheque, qui consomme ce lot un
  // numéro à la fois et le passe "Épuisé" une fois `numeroFin` dépassé.
  async ajouterLot(banqueId: string, dto: CreateLotChequesDto) {
    await this.findOne(banqueId);
    if (dto.numeroFin < dto.numeroDebut) {
      throw new BadRequestException("Le numéro de chèque de fin doit être supérieur ou égal au numéro de départ.");
    }
    return this.prisma.lotCheques.create({
      data: {
        id: randomUUID(), banqueId,
        numeroDebut: dto.numeroDebut, numeroFin: dto.numeroFin, numeroProchain: dto.numeroDebut,
        statut: "Actif",
      },
    });
  }

  // Lot actif utilisable pour la prochaine lettre chèque de cette banque —
  // le plus ancien lot Actif avec de la capacité restante (numeroProchain
  // <= numeroFin), pour épuiser les lots dans leur ordre de création.
  async lotActif(banqueId: string) {
    return this.prisma.lotCheques.findFirst({
      where: { banqueId, statut: "Actif" },
      orderBy: { createdAt: "asc" },
    });
  }

  // Historique des mouvements d'une banque (2026-08) — voir demande
  // utilisateur : "voir l'historique des mouvement de ses banque en
  // fonction des paiement des sinistres". Une LettreCheque EST le
  // règlement bancaire réel des sinistres (bordereaux de règlement
  // prestataire, voir ReglementComptableService.genererLettreCheque) —
  // pas de registre de mouvements séparé, on relit directement les lettres
  // chèque émises sur cette banque.
  async mouvements(banqueId: string) {
    await this.findOne(banqueId);
    return this.prisma.lettreCheque.findMany({
      where: { banqueId },
      include: {
        prestataire: { select: { nom: true } },
        compagnie: { select: { nom: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Classement des banques par usage réel (2026-08) — voir demande
  // utilisateur : "ça permettra de savoir la banque la plus utilisée par
  // les clients dans le cadre des transactions bancaires". Compte/somme des
  // lettres chèque émises (hors Annulée) par banque, triées par montant
  // décroissant.
  async statistiques() {
    const [banques, groupes] = await Promise.all([
      this.prisma.banque.findMany({ orderBy: { nom: "asc" } }),
      this.prisma.lettreCheque.groupBy({
        by: ["banqueId"],
        where: { statut: { not: "Annulée" } },
        _count: { _all: true },
        _sum: { montantTotal: true },
      }),
    ]);
    const parBanque = new Map(groupes.map((g) => [g.banqueId, g]));
    return banques
      .map((b) => ({
        banqueId: b.id,
        banqueNom: b.nom,
        statut: b.statut,
        nombreLettresCheque: parBanque.get(b.id)?._count._all ?? 0,
        montantTotal: Number(parBanque.get(b.id)?._sum.montantTotal ?? 0),
      }))
      .sort((a, b) => b.montantTotal - a.montantTotal);
  }
}
