import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// "dd/mm/yyyy" → "Août 2026" (2026-08) — même repère de période que le
// regroupement (RelevesPrestataireService.apercu) et le numéro affiché sur
// le relevé une fois créé.
function periodeDe(dateFr: string): string | null {
  const [, m, y] = dateFr.split("/").map(Number);
  if (!m || !y) return null;
  return `${MOIS_FR[m - 1]} ${y}`;
}

// Une ligne par FACTURE, pas par acte (2026-08) — voir demande utilisateur :
// "il n'est pas nécessaire d'éclater une facture dans un relevé de facture.
// On peut le faire sur le décompte, mais pas sur relevé de facture. Le
// relevé de facture tient compte de la somme des consommations d'un patient
// par rapport à une même référence de facture." Le Décompte (côté interne)
// reste au niveau acte ; ici chaque ligne de "Lots proposés"/relevé
// représente une Facture entière (une Facture = un seul bénéficiaire, voir
// PortailPrestataireController.ajouterLignePrestation), montant/part
// assurance/part patient/TPS étant la SOMME de ses actes non annulés.
export interface LigneApercu {
  id: string;
  referenceFacture: string;
  assureNom: string;
  date: string;
  montant: number;
  baseRemboursement: number | null;
  resteACharge: number | null;
  montantTps: number | null;
}

interface LigneAgregeable {
  montant: unknown;
  baseRemboursement: unknown;
  resteACharge: unknown;
  montantTps: unknown;
  assure: { nom: string; prenom: string | null };
}

export interface LotPropose {
  clientId: string;
  clientNom: string;
  periode: string;
  nbFactures: number;
  montantTotal: number;
  lignes: LigneApercu[];
}

// Relevé de facture prestataire (2026-08) — voir demande utilisateur :
// "dans l'onglet gestionnaire financière on aura une rubrique relevé de
// facture, là on fera un regroupement de factures saisies sur période par
// souscripteur. L'application regroupe systématiquement les factures
// saisies par souscripteur et crée les lots automatiquement, attendant
// simplement que le prestataire appuie sur le bouton créer pour générer le
// relevé de facture à transmettre électroniquement et physiquement par le
// prestataire à l'assurance."
//
// Les "lots" proposés (apercu ci-dessous) n'existent qu'en mémoire, recalculés
// à chaque appel à partir des Facture non encore rattachées à un relevé
// (releveId null) — rien n'est persisté tant que le prestataire n'a pas
// cliqué "Créer" (creer ci-dessous), qui matérialise alors un vrai
// RelevePrestataire et y rattache les Facture correspondantes (exclues de
// tout regroupement futur, même principe que BordereauReglement pour les
// PriseEnCharge — voir FacturesService.findEligiblesReglement).
@Injectable()
export class RelevesPrestataireService {
  constructor(private prisma: PrismaService) {}

  // Agrège toutes les lignes (actes) d'UNE facture en une seule ligne de
  // relevé (2026-08) — voir demande utilisateur ci-dessus : montant/part
  // assurance/part patient/TPS sont la somme des actes non annulés de cette
  // facture ; assureNom vient de la première ligne (une Facture n'a jamais
  // qu'un seul bénéficiaire dans ce portail, voir
  // PortailPrestataireController.ajouterLignePrestation).
  private agregerLignesFacture(id: string, referenceFacture: string, date: string, lignes: LigneAgregeable[]): LigneApercu {
    return {
      id, referenceFacture, date,
      assureNom: `${lignes[0].assure.nom} ${lignes[0].assure.prenom ?? ""}`.trim(),
      montant: lignes.reduce((s, l) => s + Number(l.montant), 0),
      baseRemboursement: lignes.reduce((s, l) => s + Number(l.baseRemboursement ?? 0), 0),
      resteACharge: lignes.reduce((s, l) => s + Number(l.resteACharge ?? 0), 0),
      montantTps: lignes.reduce((s, l) => s + Number(l.montantTps ?? 0), 0),
    };
  }

  // Lignes annulées exclues (2026-08) — voir demande utilisateur : "on
  // doit pouvoir annuler une prestation faite par erreur" : une prestation
  // annulée n'a jamais eu lieu, elle ne doit donc jamais être facturée à
  // l'assurance, ni dans les lots proposés, ni dans le relevé une fois créé.
  async apercu(prestataireId: string): Promise<LotPropose[]> {
    const factures = await this.prisma.facture.findMany({
      where: { prestataireId, releveId: null, statut: { not: "Annulée" } },
      include: { contrat: { include: { client: true } }, lignes: { where: { statut: { not: "Annulé" } }, include: { assure: true } } },
    });
    const groupes = new Map<string, LotPropose>();
    for (const f of factures) {
      if (f.lignes.length === 0) continue;
      const periode = periodeDe(f.dateReception);
      if (!periode) continue;
      const cle = `${f.contrat.clientId}|${periode}`;
      const ligne = this.agregerLignesFacture(f.id, f.referenceFacture, f.dateReception, f.lignes);
      const existant = groupes.get(cle);
      if (existant) { existant.nbFactures += 1; existant.montantTotal += ligne.montant; existant.lignes.push(ligne); }
      else groupes.set(cle, { clientId: f.contrat.clientId, clientNom: f.contrat.client.nom, periode, nbFactures: 1, montantTotal: ligne.montant, lignes: [ligne] });
    }
    return [...groupes.values()].sort((a, b) => b.periode.localeCompare(a.periode));
  }

  async creer(prestataireId: string, clientId: string, periode: string) {
    const factures = await this.prisma.facture.findMany({
      where: { prestataireId, releveId: null, statut: { not: "Annulée" }, contrat: { clientId } },
      include: { lignes: { where: { statut: { not: "Annulé" } } } },
    });
    const facturesDeLaPeriode = factures.filter((f) => periodeDe(f.dateReception) === periode && f.lignes.length > 0);
    if (facturesDeLaPeriode.length === 0) throw new BadRequestException("Aucune facture à regrouper pour ce souscripteur et cette période.");

    const montantTotal = facturesDeLaPeriode.reduce((s, f) => s + f.lignes.reduce((s2, l) => s2 + Number(l.montant), 0), 0);
    const releve = await this.prisma.relevePrestataire.create({
      data: {
        id: randomUUID(), numero: `REL-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        prestataireId, clientId, periode, dateCreation: new Date().toLocaleDateString("fr-FR"),
        montantTotal, nbFactures: facturesDeLaPeriode.length,
      },
    });
    await this.prisma.facture.updateMany({ where: { id: { in: facturesDeLaPeriode.map((f) => f.id) } }, data: { releveId: releve.id } });
    return this.findOne(releve.id);
  }

  // Factures éligibles à un AJOUT sur un relevé déjà créé (2026-08) — voir
  // demande utilisateur : "on doit pouvoir ajouter... une facture d'un
  // relevé" : mêmes critères que le regroupement automatique (même
  // souscripteur, même période, pas encore dans un relevé), mais limités à
  // CE relevé précis pour alimenter le sélecteur "Ajouter une facture".
  async facturesEligiblesPourAjout(prestataireId: string, releveId: string) {
    const releve = await this.findOne(releveId);
    if (releve.prestataireId !== prestataireId) throw new NotFoundException(`Relevé ${releveId} introuvable`);
    const factures = await this.prisma.facture.findMany({
      where: { prestataireId, releveId: null, statut: { not: "Annulée" }, contrat: { clientId: releve.clientId } },
      include: { lignes: { where: { statut: { not: "Annulé" } } } },
    });
    return factures
      .filter((f) => periodeDe(f.dateReception) === releve.periode && f.lignes.length > 0)
      .map((f) => ({ id: f.id, referenceFacture: f.referenceFacture, dateReception: f.dateReception, montant: f.lignes.reduce((s, l) => s + Number(l.montant), 0) }));
  }

  // Recalcule montantTotal/nbFactures depuis les Facture réellement
  // rattachées (2026-08) — voir demande utilisateur : "on doit pouvoir
  // ajouter ou retirer une facture d'un relevé" : les totaux stockés sur
  // RelevePrestataire ne doivent jamais dériver de la réalité après un tel
  // ajustement.
  private async recalculerTotal(releveId: string) {
    const factures = await this.prisma.facture.findMany({
      where: { releveId },
      include: { lignes: { where: { statut: { not: "Annulé" } } } },
    });
    const montantTotal = factures.reduce((s, f) => s + f.lignes.reduce((s2, l) => s2 + Number(l.montant), 0), 0);
    await this.prisma.relevePrestataire.update({ where: { id: releveId }, data: { montantTotal, nbFactures: factures.length } });
  }

  // Retrait d'une facture d'un relevé déjà créé (2026-08) — voir demande
  // utilisateur : "on doit pouvoir ajouter ou retirer une facture d'un
  // relevé". Ne supprime jamais le RelevePrestataire lui-même (référence
  // déjà transmise à l'assurance) — la facture redevient simplement
  // éligible à un futur regroupement.
  async retirerFacture(prestataireId: string, releveId: string, factureId: string) {
    const releve = await this.findOne(releveId);
    if (releve.prestataireId !== prestataireId) throw new NotFoundException(`Relevé ${releveId} introuvable`);
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId } });
    if (!facture || facture.releveId !== releveId) throw new BadRequestException("Cette facture n'appartient pas à ce relevé.");
    await this.prisma.facture.update({ where: { id: factureId }, data: { releveId: null } });
    await this.recalculerTotal(releveId);
    return this.findOne(releveId);
  }

  // Ajout d'une facture à un relevé déjà créé (2026-08) — voir demande
  // utilisateur, même contexte. La facture doit être du même prestataire,
  // du même souscripteur et de la même période que le relevé — sinon la
  // référence "période × souscripteur" du relevé n'aurait plus de sens.
  async ajouterFacture(prestataireId: string, releveId: string, factureId: string) {
    const releve = await this.findOne(releveId);
    if (releve.prestataireId !== prestataireId) throw new NotFoundException(`Relevé ${releveId} introuvable`);
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId }, include: { contrat: true } });
    if (!facture) throw new NotFoundException(`Facture ${factureId} introuvable`);
    if (facture.prestataireId !== prestataireId) throw new BadRequestException("Cette facture n'appartient pas à cet établissement.");
    if (facture.releveId) throw new BadRequestException("Cette facture est déjà rattachée à un relevé.");
    if (facture.statut === "Annulée") throw new BadRequestException("Une facture annulée ne peut pas être ajoutée à un relevé.");
    if (facture.contrat.clientId !== releve.clientId) throw new BadRequestException("Cette facture ne concerne pas le même souscripteur que ce relevé.");
    if (periodeDe(facture.dateReception) !== releve.periode) throw new BadRequestException("Cette facture ne concerne pas la même période que ce relevé.");
    await this.prisma.facture.update({ where: { id: factureId }, data: { releveId } });
    await this.recalculerTotal(releveId);
    return this.findOne(releveId);
  }

  findAll(prestataireId: string) {
    return this.prisma.relevePrestataire.findMany({ where: { prestataireId }, include: { client: true }, orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const releve = await this.prisma.relevePrestataire.findUnique({
      where: { id },
      // lignes.assure (2026-08) — une ligne du relevé = une Facture (voir
      // agregerLignesFacture ci-dessus) : "le relevé de facture doit
      // remonter chaque facture avec le détail (date, bénéficiaire, frais
      // réel, part assurance, part patient, net à payer)", mais SANS
      // éclater ses actes un par un — voir demande utilisateur : "il n'est
      // pas nécessaire d'éclater une facture dans un relevé de facture. On
      // peut le faire sur le décompte, mais pas sur relevé de facture."
      include: { client: true, prestataire: true, factures: { include: { lignes: { where: { statut: { not: "Annulé" } }, include: { assure: true } } } } },
    });
    if (!releve) throw new NotFoundException(`Relevé ${id} introuvable`);
    return {
      ...releve,
      factures: releve.factures.filter((f) => f.lignes.length > 0).map((f) => this.agregerLignesFacture(f.id, f.referenceFacture, f.dateReception, f.lignes)),
    };
  }
}
