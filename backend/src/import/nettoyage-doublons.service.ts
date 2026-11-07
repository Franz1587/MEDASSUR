import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";

// Nettoyage des doublons d'import (2026-11) — voir demande utilisateur :
// "il faut nettoyer la base de tout doublon car ils faussent l'analyse des
// consommations... je ne veux aucun doublon, cela va saturer la mémoire".
// Doublon = même facture (prestataire + référence), même assuré, même date,
// même montant et même acte réel : une seule ligne est gardée (deux lignes
// identiques sont indiscernables). Lignes encore en acte générique (jamais
// corrigées) : on garde l'ensemble créé par UN import (le plus fourni), les
// autres imports du même fichier étant des copies. Règle stable : un second
// passage ne trouve plus rien. Une copie n'est supprimée que si rien n'en
// dépend (bordereau, remboursement, prescription) ; les en-têtes de facture
// devenus vides sont supprimés aussi.

const ECART_IMPORT_MS = 10_000; // lignes d'une même facture créées par un même import : quelques secondes
const LIBELLE_GENERIQUE = "non détaillée";

export interface LigneCandidate {
  id: string; assureId: string; date: string; montant: number; createdAt: Date; statut: string; motifAnnulation: string | null;
  bordereauId: string | null; remboursementId: string | null; factureId: string; prestataireId: string; referenceFacture: string;
  acteMedicalId: string | null; acteGenerique: boolean; dependante: boolean;
}

export interface BilanDoublons {
  groupes: number; lignesASupprimer: number; montantASupprimer: number; lignesBloquees: number; facturesVidees: number;
  exemples: { prestataire: string; reference: string; date: string; montant: number; exemplaires: number; gardees: number }[];
}

export interface BilanDoublonsPec {
  trouvees: number; accordsTransferes: number; supprimees: number;
}

@Injectable()
export class NettoyageDoublonsService {
  constructor(private prisma: PrismaService) {}

  private async candidates(): Promise<LigneCandidate[]> {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new BadRequestException("Société inconnue : connectez-vous avec un compte de la société à nettoyer.");
    // SQL brut (une seule requête, seulement les groupes de plus d'une ligne) :
    // le filtre société est donc posé explicitement (hors middleware).
    return this.prisma.$queryRaw<LigneCandidate[]>(Prisma.sql`
      SELECT p.id, p."assureId", p.date, p.montant::float8 AS montant, p."createdAt", p.statut, p."motifAnnulation",
             p."bordereauId", p."remboursementId", p."factureId", p."acteMedicalId", p."prestataireIdF" AS "prestataireId", p."referenceFacture",
             COALESCE(a.libelle LIKE ${"%" + LIBELLE_GENERIQUE + "%"}, true) AS "acteGenerique",
             (EXISTS (SELECT 1 FROM "Prescription" pr WHERE pr."priseEnChargeId" = p.id)
              OR EXISTS (SELECT 1 FROM "PrescriptionLigneTraitement" t WHERE t."priseEnChargeId" = p.id)) AS dependante
      FROM (
        SELECT pc.*, f."prestataireId" AS "prestataireIdF", f."referenceFacture",
               count(*) OVER (PARTITION BY f."prestataireId", f."referenceFacture", pc."assureId", pc.date, pc.montant) AS n
        FROM "PriseEnCharge" pc JOIN "Facture" f ON f.id = pc."factureId"
        WHERE pc."societeId" = ${societeId}
          AND (pc.statut <> 'Annulé' OR pc."motifAnnulation" LIKE 'Doublon d''import%')
      ) p
      LEFT JOIN "ActeMedical" a ON a.id = p."acteMedicalId"
      WHERE p.n > 1`);
  }

  // Copies à retirer d'un groupe (même facture, assuré, date, montant).
  static trier(groupe: LigneCandidate[]): { gardees: LigneCandidate[]; copies: LigneCandidate[] } {
    const priorite = (a: LigneCandidate, b: LigneCandidate) =>
      Number(!!b.bordereauId || !!b.remboursementId) - Number(!!a.bordereauId || !!a.remboursementId) || a.createdAt.getTime() - b.createdAt.getTime();
    const actives = groupe.filter((l) => l.statut !== "Annulé");
    const reelles = actives.filter((l) => !l.acteGenerique);
    let gardees: LigneCandidate[];
    if (reelles.length) {
      // Un exemplaire par acte réel ; les génériques restants sont d'anciennes copies.
      const parActe = new Map<string, LigneCandidate[]>();
      for (const l of reelles) (parActe.get(l.acteMedicalId!) ?? parActe.set(l.acteMedicalId!, []).get(l.acteMedicalId!)!).push(l);
      gardees = [...parActe.values()].map((l) => l.sort(priorite)[0]);
    } else {
      // Génériques seulement : imports successifs = paquets créés à quelques secondes d'intervalle.
      const parDate = [...actives].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const paquets: LigneCandidate[][] = [];
      for (const l of parDate) {
        const dernier = paquets.at(-1);
        if (dernier && l.createdAt.getTime() - dernier.at(-1)!.createdAt.getTime() <= ECART_IMPORT_MS) dernier.push(l); else paquets.push([l]);
      }
      paquets.sort((a, b) => b.length - a.length || Number(b.some((l) => l.bordereauId || l.remboursementId)) - Number(a.some((l) => l.bordereauId || l.remboursementId)) || a[0].createdAt.getTime() - b[0].createdAt.getTime());
      gardees = paquets[0] ?? [];
    }
    const garde = new Set(gardees.map((l) => l.id));
    return { gardees, copies: groupe.filter((l) => !garde.has(l.id)) };
  }

  async analyser(supprimer: boolean): Promise<BilanDoublons & { lignesSupprimees: number; facturesSupprimees: number }> {
    const lignes = await this.candidates();
    const groupes = new Map<string, LigneCandidate[]>();
    for (const l of lignes) {
      const cle = `${l.prestataireId}|${l.referenceFacture}|${l.assureId}|${l.date}|${l.montant}`;
      (groupes.get(cle) ?? groupes.set(cle, []).get(cle)!).push(l);
    }
    const aSupprimer: LigneCandidate[] = [];
    let bloquees = 0;
    const exemples: BilanDoublons["exemples"] = [];
    let nbGroupes = 0;
    for (const groupe of groupes.values()) {
      const { gardees, copies } = NettoyageDoublonsService.trier(groupe);
      if (!copies.length) continue;
      nbGroupes++;
      for (const c of copies) {
        if (c.bordereauId || c.remboursementId || c.dependante) bloquees++; else aSupprimer.push(c);
      }
      if (exemples.length < 30) exemples.push({ prestataire: groupe[0].prestataireId, reference: groupe[0].referenceFacture, date: groupe[0].date, montant: groupe[0].montant, exemplaires: groupe.length, gardees: gardees.length });
    }
    const factures = [...new Set(aSupprimer.map((l) => l.factureId))];
    // Noms des prestataires pour l'aperçu (lisible, jamais d'identifiant technique).
    const noms = new Map((await this.prisma.prestataire.findMany({ where: { id: { in: [...new Set(exemples.map((e) => e.prestataire))] } }, select: { id: true, nom: true } })).map((p) => [p.id, p.nom]));
    exemples.forEach((e) => { e.prestataire = noms.get(e.prestataire) ?? e.prestataire; });

    let lignesSupprimees = 0, facturesSupprimees = 0, facturesVidees = 0;
    const idsFactures = factures;
    if (supprimer) {
      for (let i = 0; i < aSupprimer.length; i += 5000) {
        lignesSupprimees += (await this.prisma.priseEnCharge.deleteMany({ where: { id: { in: aSupprimer.slice(i, i + 5000).map((l) => l.id) } } })).count;
      }
    }
    // En-têtes de facture qui n'ont plus (ou n'auraient plus) aucune ligne.
    for (let i = 0; i < idsFactures.length; i += 5000) {
      const lot = idsFactures.slice(i, i + 5000);
      // Lignes restantes calculées en mémoire : un "notIn" de dizaines de
      // milliers d'identifiants dépasse la limite de paramètres de PostgreSQL.
      const supprimees = new Set(aSupprimer.map((l) => l.id));
      const restantes = new Set((await this.prisma.priseEnCharge.findMany({ where: { factureId: { in: lot } }, select: { id: true, factureId: true } }))
        .filter((l) => supprimer || !supprimees.has(l.id)).map((l) => l.factureId));
      const vides = lot.filter((id) => !restantes.has(id));
      facturesVidees += vides.length;
      if (supprimer && vides.length) {
        facturesSupprimees += (await this.prisma.facture.deleteMany({ where: { id: { in: vides }, releveId: null, gedDocuments: { none: {} }, numerosSupplementaires: { none: {} } } })).count;
      }
    }
    return {
      groupes: nbGroupes, lignesASupprimer: aSupprimer.length, montantASupprimer: aSupprimer.reduce((s, l) => s + (l.statut === "Annulé" ? 0 : l.montant), 0),
      lignesBloquees: bloquees, facturesVidees, exemples, lignesSupprimees, facturesSupprimees,
    };
  }

  // Doublons PEC vs factures : une même prestation importée via l'import PEC
  // (factureId null) ET via l'import factures régulier (factureId non null).
  // On garde la ligne avec factureId et on lui transfère l'accordPrealableId
  // issu de l'import PEC, puis on supprime la ligne PEC sans facture.
  async analyserDoublonsPec(supprimer: boolean): Promise<BilanDoublonsPec> {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new BadRequestException("Société inconnue");

    // Pour chaque PEC sans facture, trouver une ligne avec facture de même
    // (assureId, date, montant, prestataire). DISTINCT ON → une seule ligne
    // avec facture par PEC (la plus récente).
    const paires = await this.prisma.$queryRaw<{ pecId: string; factId: string; accordId: string | null; factAccordId: string | null }[]>(
      Prisma.sql`
        SELECT DISTINCT ON (pec.id)
          pec.id AS "pecId",
          fact.id AS "factId",
          pec."accordPrealableId" AS "accordId",
          fact."accordPrealableId" AS "factAccordId"
        FROM "PriseEnCharge" pec
        JOIN "PriseEnCharge" fact
          ON fact."assureId" = pec."assureId"
         AND fact.date = pec.date
         AND fact.montant = pec.montant
         AND fact.prestataire = pec.prestataire
         AND fact."factureId" IS NOT NULL
         AND fact."societeId" = ${societeId}
        WHERE pec."factureId" IS NULL
          AND pec."societeId" = ${societeId}
        ORDER BY pec.id, fact."createdAt" DESC`
    );

    if (!supprimer) return { trouvees: paires.length, accordsTransferes: 0, supprimees: 0 };

    // Transférer l'accordPrealableId sur la ligne avec facture si elle n'en a pas.
    const aTransferer = paires.filter((p) => p.accordId && !p.factAccordId);
    for (const p of aTransferer) {
      await this.prisma.priseEnCharge.update({ where: { id: p.factId }, data: { accordPrealableId: p.accordId } });
    }
    // Supprimer les lignes PEC orphelines par lots.
    const ids = [...new Set(paires.map((p) => p.pecId))];
    for (let i = 0; i < ids.length; i += 5000) {
      await this.prisma.priseEnCharge.deleteMany({ where: { id: { in: ids.slice(i, i + 5000) } } });
    }
    return { trouvees: paires.length, accordsTransferes: aTransferer.length, supprimees: ids.length };
  }
}
