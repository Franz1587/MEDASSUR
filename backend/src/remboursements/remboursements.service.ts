import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SanteService } from "../sante/sante.service";
import { ReglementPrestataireService } from "../reglement-prestataire/reglement-prestataire.service";
import { CreateRemboursementDto } from "./dto/create-remboursement.dto";
import { UpdateRemboursementDto } from "./dto/update-remboursement.dto";
import { CreateRemboursementLigneDto } from "./dto/create-remboursement-ligne.dto";
import { UpdateRemboursementLigneDto } from "./dto/update-remboursement-ligne.dto";
import { ApercuRemboursementLigneDto } from "./dto/apercu-remboursement-ligne.dto";

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

const INCLUDE_REMBOURSEMENT = {
  assurePrincipal: true,
  contrat: { include: { client: true, compagnie: true } },
  lignes: {
    include: {
      assure: true, acteMedical: true, accordPrealable: true, prestataireRef: true,
      bordereau: { include: { lettreCheque: { include: { banque: true } } } },
    },
  },
} as const;

@Injectable()
export class RemboursementsService {
  constructor(private prisma: PrismaService, private sante: SanteService, private reglement: ReglementPrestataireService) {}

  // Filtres de recherche avancée (2026-09 — voir demande utilisateur :
  // "quand on parle de saisie de facture, les remboursements sont aussi
  // concernés" — même traitement que FacturesService.findAll : `clientId`
  // passe par la relation contrat, `du`/`au` filtrent sur dateDeclaration
  // (texte "dd/mm/yyyy", donc en mémoire après lecture).
  // contrat.estTest: false (2026-09) — même garde que FacturesService.findAll,
  // voir schema.prisma Contrat.estTest.
  async findAll(filtres?: { contratId?: string; clientId?: string; statut?: string; assurePrincipalId?: string; du?: string; au?: string }) {
    const remboursements = await this.prisma.remboursement.findMany({
      where: {
        contratId: filtres?.contratId, statut: filtres?.statut, assurePrincipalId: filtres?.assurePrincipalId,
        contrat: { estTest: false, ...(filtres?.clientId ? { clientId: filtres.clientId } : {}) },
      },
      include: INCLUDE_REMBOURSEMENT,
      orderBy: { createdAt: "desc" },
    });
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    if (!du && !au) return remboursements;
    return remboursements.filter((r) => {
      const d = parseDateFr(r.dateDeclaration);
      if (!d) return false;
      if (du && d < du) return false;
      if (au && d > au) return false;
      return true;
    });
  }

  async findOne(id: string) {
    const remb = await this.prisma.remboursement.findUnique({ where: { id }, include: INCLUDE_REMBOURSEMENT });
    if (!remb) throw new NotFoundException(`Remboursement ${id} introuvable`);
    return remb;
  }

  async create(dto: CreateRemboursementDto, gestionnaireId?: string) {
    if (dto.beneficiaire === "AssurePrincipal" && !dto.assurePrincipalId) {
      throw new BadRequestException("L'assuré principal bénéficiaire est obligatoire.");
    }
    return this.prisma.remboursement.create({
      data: {
        id: `REMB-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        beneficiaire: dto.beneficiaire, assurePrincipalId: dto.beneficiaire === "AssurePrincipal" ? dto.assurePrincipalId : undefined,
        contratId: dto.contratId, dateDeclaration: dto.dateDeclaration, gestionnaireId,
      },
      include: INCLUDE_REMBOURSEMENT,
    });
  }

  async update(id: string, dto: UpdateRemboursementDto) {
    await this.findOne(id);
    return this.prisma.remboursement.update({ where: { id }, data: dto, include: INCLUDE_REMBOURSEMENT });
  }

  // Annulation (2026-08) — même principe que FacturesService.annuler :
  // jamais une suppression, bloquée si une ligne est déjà réglée.
  async annuler(id: string, motif: string) {
    const remb = await this.prisma.remboursement.findUnique({ where: { id }, include: { lignes: { include: { bordereau: true } } } });
    if (!remb) throw new NotFoundException(`Remboursement ${id} introuvable`);
    if (remb.statut === "Annulée") throw new BadRequestException("Cette déclaration est déjà annulée.");
    const lignePayee = remb.lignes.find((l) => l.bordereau?.statut === "Payé");
    if (lignePayee) throw new BadRequestException("Impossible d'annuler : au moins une ligne est déjà réglée (bordereau payé).");

    for (const ligne of remb.lignes) {
      if (ligne.bordereauId) await this.reglement.detacherLigne(ligne.bordereauId, ligne.id);
    }
    return this.prisma.remboursement.update({ where: { id }, data: { statut: "Annulée", motifAnnulation: motif }, include: INCLUDE_REMBOURSEMENT });
  }

  async ajouterLigne(remboursementId: string, dto: CreateRemboursementLigneDto) {
    const remb = await this.findOne(remboursementId);
    if (remb.statut === "Annulée") throw new BadRequestException("Déclaration annulée — impossible d'ajouter une ligne.");
    return this.sante.creerLigneRemboursement(remboursementId, dto);
  }

  async apercuLigne(remboursementId: string, dto: ApercuRemboursementLigneDto) {
    const remb = await this.findOne(remboursementId);
    const montantPourCalcul = Math.max(0, dto.montant - (dto.montantRejete ?? 0));
    return this.sante.calculerPartAssuranceLigne(dto.assureId, remb.contratId, dto.typePrestation, montantPourCalcul, dto.prestataireId ?? null, undefined, dto.acteMedicalId);
  }

  async modifierLigne(remboursementId: string, ligneId: string, dto: UpdateRemboursementLigneDto) {
    await this.verifierLigneAppartient(remboursementId, ligneId);
    const ligne = await this.sante.modifierLigneFacture(ligneId, dto);
    if (ligne.bordereauId) await this.reglement.recalculerMontantTotal(ligne.bordereauId);
    return ligne;
  }

  async rejeterLigne(remboursementId: string, ligneId: string, motifRejet: string) {
    await this.verifierLigneAppartient(remboursementId, ligneId);
    return this.sante.rejeterLigneFacture(ligneId, motifRejet);
  }

  async annulerLigne(remboursementId: string, ligneId: string, motif: string) {
    await this.verifierLigneAppartient(remboursementId, ligneId);
    return this.sante.annulerLigneFacture(ligneId, motif);
  }

  async supprimerLigne(remboursementId: string, ligneId: string) {
    await this.verifierLigneAppartient(remboursementId, ligneId);
    return this.sante.supprimerLigneFacture(ligneId);
  }

  private async verifierLigneAppartient(remboursementId: string, ligneId: string) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId } });
    if (!ligne || ligne.remboursementId !== remboursementId) throw new NotFoundException(`Ligne ${ligneId} introuvable sur cette déclaration.`);
  }
}
