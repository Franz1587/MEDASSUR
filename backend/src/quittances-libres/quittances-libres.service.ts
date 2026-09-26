import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuittanceLibreDto } from "./dto/create-quittance-libre.dto";
import { PayerTrancheDto } from "./dto/payer-tranche.dto";

const INCLUDE_DETAIL = {
  contrat: { include: { client: true, compagnie: true } },
  gestionnaire: { select: { nom: true } },
  tranches: { orderBy: { numero: "asc" as const }, include: { encaissement: { include: { banque: true } } } },
} as const;

const arrondi2 = (n: number) => Math.round(n * 100) / 100;
const TAUX_TAXE_GABON = 0.08;

// Décomposition d'une tranche en prime nette / accessoires / taxe (2026-08)
// — voir demande utilisateur : "retracer pour chaque tranche la prime
// nette, les accessoires et la taxe de 8% qui correspondent... car chaque
// tranche est exactement la prime TTC divisée par le nombre de tranche."
// primeNette et accessoires sont répartis au même prorata que le montant de
// la tranche DANS LE TOTAL TTC RÉEL DU CONTRAT (jamais dans le montantTotal
// de la quittance) — une Quittance Libre peut être un quittancement PARTIEL
// (voir schema.prisma QuittanceLibre.montantTotal, "éditable"), donc si on
// prorate sur montantTotal directement, un montantTotal plus petit que le
// vrai TTC du contrat fait déborder primeNette/accessoires au-delà du
// montant de la tranche et rend la taxe négative. En proratant sur le total
// réel du contrat, primeNette + accessoires + taxe = montant EXACTEMENT pour
// CHAQUE tranche, que la quittance couvre la prime en entier ou en partie.
function decomposerTranche(montantTranche: number, primeNetteTotal: number, accessoiresTotal: number, contratTTCTotal: number) {
  if (contratTTCTotal === 0) return { primeNette: 0, accessoires: 0, taxe: arrondi2(montantTranche), montant: arrondi2(montantTranche) };
  const primeNette = arrondi2((montantTranche * primeNetteTotal) / contratTTCTotal);
  const accessoires = arrondi2((montantTranche * accessoiresTotal) / contratTTCTotal);
  const taxe = arrondi2(montantTranche - primeNette - accessoires);
  return { primeNette, accessoires, taxe, montant: arrondi2(montantTranche) };
}

// Décomposition d'une tranche saisie manuellement (2026-08, mode
// "Personnalisée") — voir demande utilisateur : "on doit pouvoir saisir
// librement, manuellement la prime nette et les accessoires. Le calcul de
// la taxe de 8% et la prime TTC doit se faire automatiquement dans le
// respect la règle de calcul d'une prime." Même règle que Contrat.montantTaxe
// (voir documents.service.ts TAUX_TAXE_GABON) : taxe = (primeNette +
// accessoires) × 8%, jamais reprise du montant TTC envoyé par le client —
// la taxe et le montant final sont TOUJOURS recalculés côté serveur.
function decomposerManuel(primeNetteInput: number, accessoiresInput: number) {
  const primeNette = arrondi2(primeNetteInput);
  const accessoires = arrondi2(accessoiresInput);
  const taxe = arrondi2((primeNette + accessoires) * TAUX_TAXE_GABON);
  const montant = arrondi2(primeNette + accessoires + taxe);
  return { primeNette, accessoires, taxe, montant };
}

// Quittance Libre (2026-08) — voir demande utilisateur : "il faut qu'on
// puisse quittancer librement même au cours d'un exercice sans que cela ne
// soit forcément lié à un avenant... échelonner le paiement d'une prime
// annuelle en plusieurs tranches... l'application doit faire un décompte
// entre ce qui est payé et ce qui reste à payer." Voir schema.prisma
// QuittanceLibre/QuittanceLibreTranche — chaque tranche payée crée un vrai
// EncaissementPrime, réutilisant la Trésorerie/le Bordereau d'Encaissement
// existants plutôt qu'un registre de paiement parallèle.
@Injectable()
export class QuittancesLibresService {
  constructor(private prisma: PrismaService) {}

  findAll(filtres?: { contratId?: string; statut?: string }) {
    return this.prisma.quittanceLibre.findMany({
      where: { contratId: filtres?.contratId, statut: filtres?.statut },
      include: INCLUDE_DETAIL,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const q = await this.prisma.quittanceLibre.findUnique({ where: { id }, include: INCLUDE_DETAIL });
    if (!q) throw new NotFoundException(`Quittance libre ${id} introuvable`);
    return q;
  }

  async create(dto: CreateQuittanceLibreDto, gestionnaireId?: string) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: dto.contratId } });
    if (!contrat) throw new NotFoundException("Contrat introuvable");

    // Tolérance d'arrondi (2026-08) — une répartition égale par
    // trimestre/semestre peut laisser 1-2 FCFA de reste sur la dernière
    // tranche ; on refuse un écart réel (saisie manuelle incohérente),
    // jamais un simple arrondi.
    const sommeTranches = dto.tranches.reduce((s, t) => s + t.montant, 0);
    if (Math.abs(sommeTranches - dto.montantTotal) > dto.tranches.length) {
      throw new BadRequestException(`La somme des tranches (${sommeTranches}) ne correspond pas au montant total (${dto.montantTotal}).`);
    }

    const primeNetteTotal = Number(contrat.primeNette ?? contrat.prime);
    const accessoiresTotal = Number(contrat.montantAccessoires ?? 0);
    const taxeTotal = contrat.montantTaxe !== null ? Number(contrat.montantTaxe) : arrondi2((primeNetteTotal + accessoiresTotal) * TAUX_TAXE_GABON);
    const contratTTCTotal = primeNetteTotal + accessoiresTotal + taxeTotal;

    const tranchesDecomposees = dto.tranches.map((t) =>
      t.primeNette !== undefined && t.accessoires !== undefined
        ? decomposerManuel(t.primeNette, t.accessoires)
        : decomposerTranche(t.montant, primeNetteTotal, accessoiresTotal, contratTTCTotal),
    );
    // Le total persisté est TOUJOURS la vraie somme des tranches recalculées
    // (jamais le dto.montantTotal brut envoyé par le client) — en mode
    // "Personnalisée" la taxe recalculée peut faire dériver légèrement le
    // total du montant initialement affiché côté formulaire.
    const montantTotalReel = arrondi2(tranchesDecomposees.reduce((s, t) => s + t.montant, 0));

    const id = `QL-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    await this.prisma.quittanceLibre.create({
      data: {
        id, contratId: dto.contratId, montantTotal: montantTotalReel, dateCreation: dto.dateCreation, gestionnaireId,
        tranches: {
          create: dto.tranches.map((t, i) => ({
            numero: i + 1, dateEcheance: t.dateEcheance,
            ...tranchesDecomposees[i],
          })),
        },
      },
    });
    return this.findOne(id);
  }

  // Paiement d'une tranche (2026-08) — crée un VRAI EncaissementPrime
  // (voir en-tête du fichier) : le montant réglé apparaît donc
  // immédiatement dans la Trésorerie / le Bordereau d'Encaissement,
  // exactement comme un encaissement saisi directement.
  async payerTranche(trancheId: string, dto: PayerTrancheDto) {
    const tranche = await this.prisma.quittanceLibreTranche.findUnique({ where: { id: trancheId }, include: { quittanceLibre: true } });
    if (!tranche) throw new NotFoundException(`Tranche ${trancheId} introuvable`);
    if (tranche.encaissementId) throw new BadRequestException("Cette tranche est déjà marquée payée.");
    if (tranche.quittanceLibre.statut === "Annulée") throw new BadRequestException("Cette quittance libre est annulée.");

    const encaissement = await this.prisma.encaissementPrime.create({
      data: {
        contratId: tranche.quittanceLibre.contratId, montant: tranche.montant, dateEncaissement: dto.dateEncaissement,
        modePaiement: dto.modePaiement, banqueId: dto.banqueId, referencePaiement: dto.referencePaiement,
        note: `Tranche ${tranche.numero} — Quittance libre ${tranche.quittanceLibreId}`,
      },
    });
    await this.prisma.quittanceLibreTranche.update({ where: { id: trancheId }, data: { encaissementId: encaissement.id } });

    await this.recalculerStatut(tranche.quittanceLibreId);
    return this.findOne(tranche.quittanceLibreId);
  }

  // Annule le paiement d'une tranche (2026-08) — correction d'une saisie
  // erronée ; supprime l'EncaissementPrime créé par payerTranche, la
  // tranche redevient impayée.
  async annulerPaiementTranche(trancheId: string) {
    const tranche = await this.prisma.quittanceLibreTranche.findUnique({ where: { id: trancheId } });
    if (!tranche) throw new NotFoundException(`Tranche ${trancheId} introuvable`);
    if (!tranche.encaissementId) throw new BadRequestException("Cette tranche n'est pas payée.");
    const encaissementId = tranche.encaissementId;
    await this.prisma.quittanceLibreTranche.update({ where: { id: trancheId }, data: { encaissementId: null } });
    await this.prisma.encaissementPrime.delete({ where: { id: encaissementId } });
    await this.recalculerStatut(tranche.quittanceLibreId);
    return this.findOne(tranche.quittanceLibreId);
  }

  async annuler(id: string, motif: string) {
    const q = await this.findOne(id);
    if (q.statut === "Annulée") throw new BadRequestException("Cette quittance libre est déjà annulée.");
    return this.prisma.quittanceLibre.update({ where: { id }, data: { statut: "Annulée", motifAnnulation: motif }, include: INCLUDE_DETAIL });
  }

  // "Soldée" dès que toutes les tranches sont payées, jamais en dessous —
  // recalculé après chaque paiement/annulation de paiement (voir
  // payerTranche/annulerPaiementTranche), pas un statut saisi à la main.
  private async recalculerStatut(id: string) {
    const q = await this.prisma.quittanceLibre.findUnique({ where: { id }, include: { tranches: true } });
    if (!q || q.statut === "Annulée") return;
    const soldee = q.tranches.every((t) => !!t.encaissementId);
    const nouveauStatut = soldee ? "Soldée" : "En cours";
    if (nouveauStatut !== q.statut) await this.prisma.quittanceLibre.update({ where: { id }, data: { statut: nouveauStatut } });
  }
}
