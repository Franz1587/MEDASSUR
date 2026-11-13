import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ecrireTraceAudit } from "../audit/audit-trail.util";
import { CreateEncaissementDto } from "./dto/create-encaissement.dto";

const INCLUDE = { contrat: { include: { client: true, compagnie: true } } } as const;

// Encaissements de prime (2026-08) — voir demande utilisateur : saisie
// manuelle des paiements reçus des souscripteurs (aucun autre flux ne les
// génère aujourd'hui), source du Bordereau d'Encaissement
// (BordereauxService.encaissement).
@Injectable()
export class EncaissementsService {
  constructor(private prisma: PrismaService) {}

  findAll(contratId?: string) {
    return this.prisma.encaissementPrime.findMany({
      where: contratId ? { contratId } : undefined,
      include: INCLUDE,
      orderBy: { dateEncaissement: "desc" },
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.encaissementPrime.findUnique({ where: { id }, include: INCLUDE });
    if (!e) throw new NotFoundException(`Encaissement ${id} introuvable`);
    return e;
  }

  create(dto: CreateEncaissementDto) {
    return this.prisma.encaissementPrime.create({ data: dto, include: INCLUDE });
  }

  // Suppression refusée si l'encaissement alimente une tranche de quittance
  // libre (le lettrage bancaire, le bordereau d'encaissement et le
  // lettrage client sont recalculés à la volée depuis ces lignes : aucune
  // table de lettrage persistée, le lien explicite est la tranche) —
  // l'annulation du paiement passe alors par QuittancesLibresService.
  // Sinon la suppression reste possible, avec une ligne d'audit conservant
  // le détail de ce qui a été supprimé.
  async remove(id: string) {
    const e = await this.prisma.encaissementPrime.findUnique({ where: { id }, include: { ...INCLUDE, trancheQuittanceLibre: { select: { id: true, numero: true } } } });
    if (!e) throw new NotFoundException(`Encaissement ${id} introuvable`);
    if (e.trancheQuittanceLibre) {
      throw new ConflictException(`Impossible de supprimer : cet encaissement règle la tranche n°${e.trancheQuittanceLibre.numero} d'une quittance libre (lettré). Annulez le paiement de la tranche.`);
    }
    await this.prisma.encaissementPrime.delete({ where: { id } });
    await ecrireTraceAudit(this.prisma, "encaissements", id, "Supprimé", {
      contratId: e.contratId, montant: e.montant.toString(), dateEncaissement: e.dateEncaissement,
      modePaiement: e.modePaiement, referencePaiement: e.referencePaiement,
    });
    return { id };
  }
}
