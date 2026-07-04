import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GenererBordereauDto } from "./dto/generer-bordereau.dto";
import { PayerBordereauDto } from "./dto/payer-bordereau.dto";

@Injectable()
export class ReglementPrestataireService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.bordereauReglement.findMany({
      include: { prestataire: true, prisesEnCharge: true },
      orderBy: { dateReception: "desc" },
    });
  }

  async findOne(id: string) {
    const bordereau = await this.prisma.bordereauReglement.findUnique({
      where: { id },
      include: { prestataire: true, prisesEnCharge: true },
    });
    if (!bordereau) throw new NotFoundException(`Bordereau ${id} introuvable`);
    return bordereau;
  }

  /**
   * Agrège les prises en charge non encore batchées (bordereauId nul) d'un
   * prestataire en un nouveau bordereau de règlement — bloc "financier" du
   * canevas santé. Le montant et le nombre de lignes sont calculés à partir
   * des `PriseEnCharge` réelles, jamais saisis manuellement.
   */
  async genererBordereau(dto: GenererBordereauDto) {
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: dto.prestataireId } });
    if (!prestataire) throw new NotFoundException(`Prestataire ${dto.prestataireId} introuvable`);

    const prises = await this.prisma.priseEnCharge.findMany({
      where: { prestataireId: dto.prestataireId, bordereauId: null },
    });
    if (prises.length === 0) {
      throw new BadRequestException("Aucune prise en charge non réglée pour ce prestataire");
    }

    const montantTotal = prises.reduce((sum, p) => sum + Number(p.montant), 0);
    const id = `BDX-${randomUUID().slice(0, 8).toUpperCase()}`;

    const bordereau = await this.prisma.bordereauReglement.create({
      data: {
        id,
        prestataireId: dto.prestataireId,
        periode: dto.periode,
        nbPrisesEnCharge: prises.length,
        montantTotal,
        statut: "Reçu",
        dateReception: new Date().toLocaleDateString("fr-FR"),
        prisesEnCharge: { connect: prises.map((p) => ({ id: p.id })) },
      },
      include: { prestataire: true, prisesEnCharge: true },
    });

    return bordereau;
  }

  /** Validation comptable du bordereau — le montant validé peut différer du montant déclaré en cas de litige. */
  async valider(id: string, montantValide?: number) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut === "Payé") throw new BadRequestException("Bordereau déjà payé");
    return this.prisma.bordereauReglement.update({
      where: { id },
      data: { statut: "Validé", montantValide: montantValide ?? Number(bordereau.montantTotal) },
    });
  }

  async rejeter(id: string) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut === "Payé") throw new BadRequestException("Bordereau déjà payé");
    return this.prisma.bordereauReglement.update({ where: { id }, data: { statut: "Rejeté" } });
  }

  /** Marque le bordereau comme payé (virement effectué) — bloc financier/trésorerie. */
  async payer(id: string, dto: PayerBordereauDto) {
    const bordereau = await this.findOne(id);
    if (bordereau.statut !== "Validé") throw new BadRequestException("Le bordereau doit être validé avant paiement");
    return this.prisma.bordereauReglement.update({
      where: { id },
      data: { statut: "Payé", datePaiement: new Date().toLocaleDateString("fr-FR"), referenceVirement: dto.referenceVirement },
    });
  }
}
