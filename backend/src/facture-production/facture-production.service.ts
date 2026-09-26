import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFactureProductionDto } from "./dto/create-facture-production.dto";
import { numeroPolice } from "../lib/police.util";

// Facture Production (2026-08) — génération MANUELLE à la demande (voir
// demande utilisateur), une par opération (nouveau contrat, avenant…),
// imprimée sur le papier en-tête de la compagnie (DocumentsService.renderFactureProduction).
@Injectable()
export class FactureProductionService {
  constructor(private prisma: PrismaService) {}

  // Compteur global, atomique — même pattern que
  // DocumentsService.prochainNumeroQuittance (CompteurDocument).
  private async prochainNumero(): Promise<number> {
    const compteur = await this.prisma.compteurDocument.upsert({
      where: { id: "facture-production" },
      update: { valeur: { increment: 1 } },
      create: { id: "facture-production", valeur: 1 },
    });
    return compteur.valeur;
  }

  async findAll(filtres: { compagnieId?: string; clientId?: string; contratId?: string; du?: string; au?: string; reference?: string }) {
    const where: Record<string, unknown> = {};
    if (filtres.compagnieId) where.compagnieId = filtres.compagnieId;
    if (filtres.clientId) where.clientId = filtres.clientId;
    // Une facture peut porter le contrat en en-tête OU seulement sur ses
    // lignes (facture composite couvrant plusieurs contrats/avenants) — voir
    // FactureProductionLigne.contratId. Le portail client (2026-08) doit
    // retrouver les deux cas pour "les factures de production émises" sur
    // un contrat donné.
    if (filtres.contratId) {
      where.OR = [{ contratId: filtres.contratId }, { lignes: { some: { contratId: filtres.contratId } } }];
    }
    if (filtres.du || filtres.au) {
      where.dateEmission = {
        ...(filtres.du ? { gte: filtres.du } : {}),
        ...(filtres.au ? { lte: filtres.au } : {}),
      };
    }
    if (filtres.reference) {
      const n = Number(filtres.reference);
      if (!Number.isNaN(n)) where.numero = n;
    }
    return this.prisma.factureProduction.findMany({
      where,
      include: { compagnie: true, client: true, contrat: true, lignes: { orderBy: { ordre: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.factureProduction.findUnique({
      where: { id },
      include: { compagnie: true, client: true, contrat: true, lignes: { orderBy: { ordre: "asc" } } },
    });
    if (!f) throw new NotFoundException(`Facture de production ${id} introuvable`);
    return f;
  }

  async create(dto: CreateFactureProductionDto) {
    const numero = await this.prochainNumero();
    return this.prisma.factureProduction.create({
      data: {
        numero,
        compagnieId: dto.compagnieId,
        clientId: dto.clientId,
        contratId: dto.contratId ?? null,
        dateEmission: dto.dateEmission,
        lieuEmission: dto.lieuEmission ?? "Libreville",
        referenceBonReception: dto.referenceBonReception ?? null,
        referenceBonCommande: dto.referenceBonCommande ?? null,
        objet: dto.objet,
        typePaiement: dto.typePaiement ?? "Paiement intégral",
        notePaiement: dto.notePaiement ?? null,
        lignes: {
          create: dto.lignes.map((l, i) => ({
            libelle: l.libelle,
            periodeDebut: l.periodeDebut ?? null,
            periodeFin: l.periodeFin ?? null,
            montant: l.montant,
            contratId: l.contratId ?? null,
            avenantId: l.avenantId ?? null,
            ordre: i,
          })),
        },
      },
      include: { compagnie: true, client: true, contrat: true, lignes: { orderBy: { ordre: "asc" } } },
    });
  }

  // Mouvements pas encore facturés (2026-08) — voir demande utilisateur :
  // "dès que l'on sélectionne le souscripteur, l'application doit voir les
  // mouvements (affaire nouvelle ou avenant) qui ont été faits sur ces
  // contrats et qui ne sont pas encore liés à une facture production".
  // Une Affaire Nouvelle = le Contrat lui-même (une seule ligne possible,
  // détectée via une FactureProductionLigne.contratId sans avenantId) ; un
  // Avenant "Appliqué" = un mouvement distinct (détecté via
  // FactureProductionLigne.avenantId). Les montants proposés restent de
  // simples suggestions, toujours éditables côté formulaire.
  async mouvementsNonFactures(clientId: string, compagnieId?: string) {
    const contrats = await this.prisma.contrat.findMany({
      where: { clientId, ...(compagnieId ? { compagnieId } : {}) },
      include: {
        avenants: { where: { statut: "Appliqué" }, orderBy: { dateEffet: "asc" } },
      },
    });

    const contratIds = contrats.map((c) => c.id);
    const avenantIds = contrats.flatMap((c) => c.avenants.map((a) => a.id));

    const lignesAffaireNouvelle = contratIds.length
      ? await this.prisma.factureProductionLigne.findMany({ where: { contratId: { in: contratIds }, avenantId: null } })
      : [];
    const lignesAvenant = avenantIds.length
      ? await this.prisma.factureProductionLigne.findMany({ where: { avenantId: { in: avenantIds } } })
      : [];
    const contratsFactures = new Set(lignesAffaireNouvelle.map((l) => l.contratId));
    const avenantsFactures = new Set(lignesAvenant.map((l) => l.avenantId));

    const mouvements: {
      contratId: string; avenantId: string | null; compagnieId: string;
      libelle: string; periodeDebut: string | null; periodeFin: string | null; montant: number;
    }[] = [];

    for (const c of contrats) {
      if (!contratsFactures.has(c.id)) {
        mouvements.push({
          contratId: c.id, avenantId: null, compagnieId: c.compagnieId,
          libelle: `POLICE MALADIE N°${numeroPolice(c)} — Affaire Nouvelle`,
          periodeDebut: c.dateDebut, periodeFin: c.dateFin, montant: Number(c.prime),
        });
      }
      for (const a of c.avenants) {
        if (avenantsFactures.has(a.id)) continue;
        const delta = Math.abs(Number(a.primeApres) - Number(a.primeAvant));
        mouvements.push({
          contratId: c.id, avenantId: a.id, compagnieId: c.compagnieId,
          libelle: `POLICE MALADIE N°${numeroPolice(c)} — Avenant ${a.type}`,
          periodeDebut: a.dateEffet, periodeFin: a.dateFin ?? c.dateFin,
          montant: delta > 0 ? delta : Number(a.primeApres),
        });
      }
    }
    return mouvements;
  }

  // Objets pré-paramétrables (2026-08) — voir demande utilisateur : "liste
  // des objets préparamétrable". Catalogue vivant plutôt qu'une liste figée
  // en dur : chaque objet déjà saisi devient une suggestion pour la
  // prochaine facture (complété par quelques valeurs usuelles au départ).
  async objetsSuggeres(): Promise<string[]> {
    const lignes = await this.prisma.factureProduction.findMany({ select: { objet: true }, distinct: ["objet"], orderBy: { objet: "asc" } });
    const defauts = ["RENOUVELLEMENT PRESTATIONS SANTE", "SOUSCRIPTION NOUVELLE POLICE", "AVENANT - MOUVEMENT DE PERSONNEL", "REGULARISATION DE PRIME"];
    const existants = new Set(lignes.map((l) => l.objet));
    return [...existants, ...defauts.filter((d) => !existants.has(d))];
  }
}
