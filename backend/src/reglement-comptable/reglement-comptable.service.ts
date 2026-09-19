import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GenererLettreChequeDto } from "./dto/generer-lettre-cheque.dto";
import { montantNetPrisesEnCharge as montantNetBordereau } from "../lib/montant-net.util";

const INCLUDE_LETTRE = {
  banque: true, prestataire: true, compagnie: true,
  bordereaux: true,
} as const;

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Net à payer d'un bordereau — recalculé depuis les lignes plutôt que lu
// directement sur BordereauReglement.montantTotal/montantValide (2026-09) :
// ces deux champs portent désormais la MÊME règle (voir montantNetBordereau/
// montantNetPrisesEnCharge, ReglementPrestataireService.genererBordereau),
// mais on recalcule quand même ici pour rester exact même sur un bordereau
// "Payé" dont une ligne aurait été retouchée après coup sans repasser par
// recalculerMontantTotal — même règle que DocumentsService.renderLettreCheque.

@Injectable()
export class ReglementComptableService {
  constructor(private prisma: PrismaService) {}

  // Écran "Règlement comptable" — mêmes filtres de recherche que
  // l'historique de l'écran "Règlement" (voir ReglementPrestataireService.
  // historique) : prestataire, banque, compagnie, intervalle de date
  // d'émission, référence libre (N° de lettre ou N° de chèque).
  async findAll(filtres?: { prestataireId?: string; banqueId?: string; compagnieId?: string; du?: string; au?: string; reference?: string }) {
    const lettres = await this.prisma.lettreCheque.findMany({
      where: {
        prestataireId: filtres?.prestataireId,
        banqueId: filtres?.banqueId,
        compagnieId: filtres?.compagnieId,
      },
      include: INCLUDE_LETTRE,
      orderBy: { createdAt: "desc" },
    });
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    const referenceNorm = filtres?.reference?.trim().toLowerCase();
    return lettres.filter((l) => {
      if (du || au) {
        const d = parseDateFr(l.dateEmission);
        if (!d) return false;
        if (du && d < du) return false;
        if (au && d > au) return false;
      }
      if (referenceNorm) {
        const cible = `${l.numero} ${l.numeroCheque}`.toLowerCase();
        if (!cible.includes(referenceNorm)) return false;
      }
      return true;
    });
  }

  async findOne(id: string) {
    const lettre = await this.prisma.lettreCheque.findUnique({
      where: { id },
      // prisesEnCharge.assure/facture (2026-09) — voir demande utilisateur :
      // "un état qui retrace les référence de factures, les personnes qui
      // ont consommé... sans oublier les dates des prestations", pour
      // DocumentsService.dessinerEtatFactures (page 2 de la Lettre Chèque).
      include: { ...INCLUDE_LETTRE, bordereaux: { include: { prestataire: true, prisesEnCharge: { include: { assure: true, facture: true } } } }, lot: true },
    });
    if (!lettre) throw new NotFoundException(`Lettre chèque ${id} introuvable`);
    return {
      ...lettre,
      bordereaux: lettre.bordereaux.map((b) => ({ ...b, montantNet: montantNetBordereau(b.prisesEnCharge) })),
    };
  }

  // Bordereaux "Validé" du prestataire, pas encore rattachés à une lettre
  // chèque — écran de recherche/génération. `compagnieId`, s'il est
  // renseigné, ne fait remonter que les bordereaux dont au moins une ligne
  // touche cette compagnie (un bordereau peut en théorie couvrir plusieurs
  // compagnies s'il a été généré sans filtre compagnie, voir
  // ReglementPrestataireService.genererBordereau) — sa liste de compagnies
  // concernées est renvoyée pour que l'écran puisse le signaler.
  async findEligibles(filtres: { prestataireId: string; compagnieId?: string }) {
    const bordereaux = await this.prisma.bordereauReglement.findMany({
      where: { prestataireId: filtres.prestataireId, statut: "Validé", lettreChequeId: null },
      include: { prisesEnCharge: true },
      orderBy: { dateReception: "asc" },
    });

    const contratIds = [...new Set(bordereaux.flatMap((b) => b.prisesEnCharge.map((l) => l.contratId)))];
    const contrats = contratIds.length
      ? await this.prisma.contrat.findMany({ where: { id: { in: contratIds } }, include: { compagnie: true } })
      : [];
    const contratParId = new Map(contrats.map((c) => [c.id, c]));

    return bordereaux
      .map((b) => {
        const compagniesMap = new Map<string, string>();
        for (const l of b.prisesEnCharge) {
          const c = contratParId.get(l.contratId);
          if (c) compagniesMap.set(c.compagnieId, c.compagnie.nom);
        }
        return {
          id: b.id, numero: b.numero, periode: b.periode, nbPrisesEnCharge: b.nbPrisesEnCharge,
          montantTotal: b.montantTotal, montantValide: b.montantValide,
          montantNet: montantNetBordereau(b.prisesEnCharge), dateReception: b.dateReception,
          compagnies: [...compagniesMap.entries()].map(([id, nom]) => ({ id, nom })),
        };
      })
      .filter((b) => !filtres.compagnieId || b.compagnies.some((c) => c.id === filtres.compagnieId));
  }

  // Émission d'une lettre chèque (2026-08) — regroupe les bordereaux
  // "Validé" sélectionnés d'un même prestataire sur un seul chèque, dont
  // le numéro est tiré atomiquement du lot actif de la banque choisie
  // (voir BanquesService). Marque les bordereaux couverts "Payé", en
  // remplacement de la saisie libre de référence de virement (voir
  // ReglementPrestataireService.payer) par une vraie traçabilité
  // bancaire : `referenceVirement` porte désormais le numéro de chèque
  // réel, et chaque bordereau reste lié à sa LettreCheque.
  async genererLettreCheque(dto: GenererLettreChequeDto) {
    const bordereaux = await this.prisma.bordereauReglement.findMany({
      where: { id: { in: dto.bordereauIds }, prestataireId: dto.prestataireId, statut: "Validé", lettreChequeId: null },
      include: { prisesEnCharge: true },
    });
    if (bordereaux.length !== dto.bordereauIds.length) {
      throw new BadRequestException("Certains bordereaux sélectionnés ne sont plus éligibles (déjà payés ou modifiés entre-temps).");
    }

    // Montant du chèque = net à payer, jamais les frais réels (voir
    // demande utilisateur et montantNetBordereau ci-dessus).
    const montantTotal = bordereaux.reduce((s, b) => s + montantNetBordereau(b.prisesEnCharge), 0);
    const dateEmission = new Date().toLocaleDateString("fr-FR");

    const lettreCheque = await this.prisma.$transaction(async (tx) => {
      // Lot actif re-vérifié ICI, dans la transaction, pour ne jamais
      // distribuer deux fois le même numéro sous accès concurrents (voir
      // schema.prisma LotCheques.numeroProchain).
      const lot = await tx.lotCheques.findFirst({
        where: { banqueId: dto.banqueId, statut: "Actif" },
        orderBy: { createdAt: "asc" },
      });
      if (!lot) throw new BadRequestException("Veuillez utiliser une nouvelle série de chèques.");

      const numeroCheque = lot.numeroProchain;
      const nouveauProchain = numeroCheque + 1;
      await tx.lotCheques.update({
        where: { id: lot.id },
        data: { numeroProchain: nouveauProchain, statut: nouveauProchain > lot.numeroFin ? "Épuisé" : "Actif" },
      });

      const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('lettre_cheque_numero_seq') AS nextval`;
      const numero = `LC-${nextval.toString().padStart(6, "0")}`;

      const lc = await tx.lettreCheque.create({
        data: {
          id: randomUUID(), numero, banqueId: dto.banqueId, lotChequesId: lot.id, numeroCheque,
          compagnieId: dto.compagnieId, prestataireId: dto.prestataireId, montantTotal, statut: "Émise", dateEmission,
        },
      });

      await tx.bordereauReglement.updateMany({
        where: { id: { in: dto.bordereauIds } },
        data: { statut: "Payé", datePaiement: dateEmission, referenceVirement: `Chèque N° ${numeroCheque}`, lettreChequeId: lc.id },
      });

      return lc;
    });

    return this.findOne(lettreCheque.id);
  }
}
