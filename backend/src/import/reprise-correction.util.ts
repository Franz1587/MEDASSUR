import type { PrismaService } from "../prisma/prisma.service";

// Ré-import correctif (2026-11) — voir demande utilisateur : "il faut que
// l'import à nouveau de n'importe quelle facture de n'importe quel client
// corrige toutes les lignes précédemment importées pour avoir la bonne
// donnée". Chaque ligne du fichier est rapprochée d'UNE ligne existante
// (même facture, date, montant, assuré ou titulaire) qui reçoit les données
// du fichier ; les copies en trop d'imports précédents sont annulées.

export const MOTIF_DOUBLON = "Doublon d'import — ligne en trop corrigée par le ré-import du fichier source";

export interface LigneExistante {
  id: string; assureId: string; contratId: string | null; acteMedicalId: string | null; montant: unknown;
  baseRemboursement: unknown; quantite: number | null; statut: string; bordereau: { statut: string } | null; createdAt: Date;
}

// Données portées par le fichier pour la ligne (undefined = absent du fichier).
export interface LigneSource { assureId: string; contratId: string; acteMedicalId?: string; baseRemboursement?: number; quantite?: number }

export const SELECT_EXISTANTE = {
  id: true, assureId: true, contratId: true, acteMedicalId: true, montant: true, baseRemboursement: true,
  quantite: true, statut: true, createdAt: true, bordereau: { select: { statut: true } },
} as const;

const reglee = (e: LigneExistante) => e.bordereau?.statut === "Payé";

// Ligne à garder en priorité parmi des copies : réglée, puis la plus ancienne.
export const ordreConservation = (a: LigneExistante, b: LigneExistante) =>
  Number(reglee(b)) - Number(reglee(a)) || a.createdAt.getTime() - b.createdAt.getTime();

// Champs à corriger sur la ligne existante pour qu'elle porte la donnée du
// fichier. Une ligne déjà réglée garde ses montants (seuls l'acte et le
// bénéficiaire, purement descriptifs, sont rectifiés).
export function ecartsCorrection(e: LigneExistante, s: LigneSource, acteGeneriqueId: string | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (e.assureId !== s.assureId) { data.assureId = s.assureId; data.contratId = s.contratId; }
  if (s.acteMedicalId && s.acteMedicalId !== acteGeneriqueId && s.acteMedicalId !== e.acteMedicalId) data.acteMedicalId = s.acteMedicalId;
  if (!reglee(e) && e.statut !== "Rejeté") {
    const montant = Number(e.montant);
    if (s.baseRemboursement !== undefined && s.baseRemboursement !== Number(e.baseRemboursement ?? NaN)) {
      data.baseRemboursement = s.baseRemboursement;
      data.resteACharge = montant - s.baseRemboursement;
    }
    const base = s.baseRemboursement ?? Number(e.baseRemboursement ?? 0);
    // Taux seulement s'il a un sens (part assurance ≤ frais réels) : la colonne est limitée à 999,99.
    if (montant > 0 && data.baseRemboursement !== undefined && base >= 0 && base <= montant) data.tauxRemboursement = Math.round((base / montant) * 10000) / 100;
    if (s.quantite !== undefined && s.quantite !== (e.quantite ?? 1)) data.quantite = s.quantite;
  }
  return data;
}

// Retire des copies d'imports précédents : supprimées si rien n'en dépend
// (bordereau, remboursement, prescription), sinon annulées (jamais une ligne
// déjà réglée). Voir aussi NettoyageDoublonsService.
export async function retirerCopies(prisma: PrismaService, ids: string[]): Promise<number> {
  let retirees = 0;
  for (let i = 0; i < ids.length; i += 5000) {
    const lot = await prisma.priseEnCharge.findMany({
      where: { id: { in: ids.slice(i, i + 5000) } },
      select: { id: true, bordereauId: true, remboursementId: true, bordereau: { select: { statut: true } }, prescriptionOrigine: { select: { id: true } }, prescriptionLigneTraitement: { select: { id: true } } },
    });
    const libres = lot.filter((l) => !l.bordereauId && !l.remboursementId && !l.prescriptionOrigine && !l.prescriptionLigneTraitement).map((l) => l.id);
    const liees = lot.filter((l) => !libres.includes(l.id) && l.bordereau?.statut !== "Payé").map((l) => l.id);
    if (libres.length) retirees += (await prisma.priseEnCharge.deleteMany({ where: { id: { in: libres } } })).count;
    if (liees.length) retirees += (await prisma.priseEnCharge.updateMany({ where: { id: { in: liees } }, data: { statut: "Annulé", motifAnnulation: MOTIF_DOUBLON } })).count;
  }
  return retirees;
}

// Rapprochement ligne par ligne (imports traités une ligne à la fois).
// `pris` = lignes existantes déjà associées à une ligne du fichier pendant
// cet import ; `vues` = clés rencontrées, pour annuler les copies ensuite.
export class RapprochementReprise {
  readonly pris = new Set<string>();
  private readonly vues = new Map<string, { prestataireId: string; referenceFacture: string; date: string; montant: number; assureIds: string[] }>();
  corrigees = 0;

  constructor(private readonly prisma: PrismaService, private readonly acteGeneriqueId: string | undefined) {}

  // null = aucune ligne existante (à créer) ; sinon "corrigee" ou "identique".
  async rapprocher(cle: { prestataireId: string; referenceFacture: string; date: string; montant: number; assureIds: string[] }, source: LigneSource): Promise<"corrigee" | "identique" | null> {
    const ids = [...new Set(cle.assureIds)];
    this.vues.set(`${cle.prestataireId}|${cle.referenceFacture}|${cle.date}|${cle.montant}|${ids.sort().join(",")}`, { ...cle, assureIds: ids });
    const candidates = (await this.prisma.priseEnCharge.findMany({
      where: { assureId: { in: ids }, date: cle.date, montant: cle.montant, statut: { not: "Annulé" }, facture: { prestataireId: cle.prestataireId, referenceFacture: cle.referenceFacture } },
      select: SELECT_EXISTANTE,
    }) as LigneExistante[]).filter((e) => !this.pris.has(e.id));
    if (!candidates.length) return null;
    // Celle du bon bénéficiaire d'abord, puis réglée, puis la plus ancienne.
    candidates.sort((a, b) => Number(b.assureId === source.assureId) - Number(a.assureId === source.assureId) || ordreConservation(a, b));
    const e = candidates[0];
    this.pris.add(e.id);
    const data = ecartsCorrection(e, source, this.acteGeneriqueId);
    if (!Object.keys(data).length) return "identique";
    await this.prisma.priseEnCharge.update({ where: { id: e.id }, data });
    this.corrigees++;
    return "corrigee";
  }

  // Copies restantes des clés vues (non associées à une ligne du fichier) :
  // doublons d'imports précédents, annulés (historique conservé) sauf réglés.
  // shortcut: valable pour un appel ; un fichier envoyé en plusieurs lots dont deux lignes
  // identiques tombent dans des lots différents annule puis recrée l'une d'elles (total juste).
  async annulerCopies(): Promise<number> {
    let annulees = 0;
    for (const cle of this.vues.values()) {
      const copies = await this.prisma.priseEnCharge.findMany({
        where: { assureId: { in: cle.assureIds }, date: cle.date, montant: cle.montant, statut: { not: "Annulé" }, facture: { prestataireId: cle.prestataireId, referenceFacture: cle.referenceFacture }, id: { notIn: [...this.pris] } },
        select: { id: true, bordereau: { select: { statut: true } } },
      });
      annulees += await retirerCopies(this.prisma, copies.filter((c) => c.bordereau?.statut !== "Payé").map((c) => c.id));
    }
    return annulees;
  }
}
