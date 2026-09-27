import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { numeroPolice } from "../lib/police.util";

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Borne "au" incluse jusqu'à la fin de la journée — sinon `lte` sur un
// DateTime réel (Contrat.createdAt) exclurait tout ce qui a été créé ce
// jour-là après minuit.
function finDeJournee(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export interface LigneBordereauSinistres {
  dateSoins: string;
  dateReglement: string;
  numeroPolice: string;
  souscripteur: string;
  numeroClient: string;
  assurePrincipal: string;
  prestataire: string;
  numeroReglement: string;
  fraisReels: number;
  partGarant: number;
  tps: number;
  netAPayer: number;
  // Agence de SAISIE de la facture/du remboursement et ville du prestataire
  // (2026-09, bordereau par agence — voir sinistres() ci-dessous).
  agence: string;
  villePrestataire: string;
}

export interface GroupeBordereauSinistres {
  // Libellé du groupe : souscripteur ou prestataire selon le regroupement.
  souscripteur: string;
  lignes: LigneBordereauSinistres[];
  totaux: { fraisReels: number; partGarant: number; tps: number; netAPayer: number };
}

export interface BordereauSinistresPayload {
  du?: string;
  au?: string;
  compagnieId?: string;
  compagnie?: string;
  typeReglement: "maladie" | "comptable";
  agenceId?: string;
  agence?: string;
  ville?: string;
  groupement: GroupementBordereauSinistres;
  groupes: GroupeBordereauSinistres[];
  total: { fraisReels: number; partGarant: number; tps: number; netAPayer: number };
}

export type GroupementBordereauSinistres = "souscripteur" | "prestataire";

// Filtres du bordereau sinistres par agence (2026-09) — voir demande
// utilisateur : "il faut pouvoir générer les bordereaux par compagnie oui,
// mais par agence. Il ne sera pas question de faire remonter les sinistres en
// fonction des clients uniquement, mais beaucoup plus en fonction des
// prestataires d'une ville et surtout de l'agence dans laquelle les factures
// des prestataires médicaux ont été saisies."
//  - agenceId : agence de saisie de la facture/du remboursement ; la valeur
//    SANS_AGENCE isole ce qui a été saisi hors agence (siège, portail) ;
//  - ville : ville du prestataire ;
//  - groupement : par souscripteur (historique) ou par prestataire.
export const SANS_AGENCE = "sans-agence";
export interface FiltresBordereauSinistres {
  agenceId?: string;
  ville?: string;
  groupement?: GroupementBordereauSinistres;
}

export interface LigneBordereauProduction {
  numeroPolice: string;
  codeAssure: string;
  numQuittance: string;
  dateEmisQuittance: string;
  dateAvenant: string;
  nomSouscripteur: string;
  dateDebut: string;
  dateFin: string;
  produit: string;
  capitauxAssures: string;
  primes: number;
  access: number;
  taxes: number;
  primesTotales: number;
}

export interface GroupeBordereauProduction {
  compagnieId: string;
  compagnie: string;
  lignes: LigneBordereauProduction[];
  totaux: { primes: number; access: number; taxes: number; primesTotales: number; commission: number };
}

export interface BordereauProductionPayload {
  du?: string;
  au?: string;
  compagnieId?: string;
  groupes: GroupeBordereauProduction[];
  total: { primes: number; access: number; taxes: number; primesTotales: number; commission: number };
}

// Bordereaux (2026-08) — voir demande utilisateur : "3 nouveaux états, le
// bordereau sinistres, le bordereau de production... et le bordereau
// d'encaissement de prime". Le Bordereau Sinistres retrace toutes les
// factures/remboursements RÉGLÉS (voir BordereauReglement) sur une période,
// groupées par souscripteur — c'est le document que le courtier adresse à
// la compagnie pour réclamer le renflouement du fonds de roulement ayant
// servi à payer les prestataires. Toujours généré POUR UNE COMPAGNIE
// donnée (voir demande utilisateur : "le bordereau sinistres se génère par
// compagnie" — le modèle fourni est déjà scopé à une seule compagnie
// destinataire, même si ça ne se voit pas dans les colonnes).
@Injectable()
export class BordereauxService {
  constructor(private prisma: PrismaService) {}

  async sinistres(du?: string, au?: string, compagnieId?: string, typeReglement: "maladie" | "comptable" = "maladie", filtres: FiltresBordereauSinistres = {}): Promise<BordereauSinistresPayload> {
    const groupement: GroupementBordereauSinistres = filtres.groupement === "prestataire" ? "prestataire" : "souscripteur";
    const villeFiltre = filtres.ville?.trim().toLowerCase() || null;
    const dateDu = parseDateFr(du);
    const dateAu = parseDateFr(au);

    const [lignesBrutes, compagnie] = await Promise.all([
      this.prisma.priseEnCharge.findMany({
        where: { bordereauId: { not: null } },
        include: {
          assure: true, prestataireRef: true, bordereau: true,
          facture: { select: { agenceId: true, agence: { select: { nom: true } } } },
          remboursement: { select: { agenceId: true, agence: { select: { nom: true } } } },
        },
      }),
      compagnieId ? this.prisma.compagnie.findUnique({ where: { id: compagnieId } }) : Promise.resolve(null),
    ]);
    const agenceFiltre = filtres.agenceId && filtres.agenceId !== SANS_AGENCE
      ? await this.prisma.agence.findUnique({ where: { id: filtres.agenceId }, select: { id: true, nom: true } })
      : null;

    const dansPeriode = lignesBrutes.filter((l) => {
      if (!l.bordereau) return false;
      const dateReglement = parseDateFr(l.bordereau.dateReception);
      if (!dateReglement) return false;
      if (dateDu && dateReglement < dateDu) return false;
      if (dateAu && dateReglement > dateAu) return false;
      return true;
    });

    // PriseEnCharge.contratId est dénormalisé (pas de relation Prisma
    // directe, voir schema.prisma) — les Contrat/Client concernés sont
    // résolus séparément puis fusionnés en mémoire.
    const contratIds = [...new Set(dansPeriode.map((l) => l.contratId))];
    const contrats = contratIds.length > 0
      ? await this.prisma.contrat.findMany({ where: { id: { in: contratIds } }, include: { client: true } })
      : [];
    const contratParId = new Map(contrats.map((c) => [c.id, c]));

    const parClient = new Map<string, GroupeBordereauSinistres>();
    for (const l of dansPeriode) {
      const contrat = contratParId.get(l.contratId);
      if (!contrat || !l.bordereau) continue;
      if (compagnieId && contrat.compagnieId !== compagnieId) continue;
      const agenceSaisie = l.facture?.agenceId ? l.facture : l.remboursement?.agenceId ? l.remboursement : null;
      if (filtres.agenceId === SANS_AGENCE && agenceSaisie) continue;
      if (filtres.agenceId && filtres.agenceId !== SANS_AGENCE && agenceSaisie?.agenceId !== filtres.agenceId) continue;
      const villePrestataire = l.prestataireRef?.ville?.trim() ?? "";
      if (villeFiltre && villePrestataire.toLowerCase() !== villeFiltre) continue;
      const fraisReels = Number(l.montant);
      const partGarant = l.baseRemboursement != null ? Number(l.baseRemboursement) : 0;
      const tps = l.montantTps != null ? Number(l.montantTps) : 0;
      const ligne: LigneBordereauSinistres = {
        dateSoins: l.date,
        dateReglement: l.bordereau.dateReception,
        numeroPolice: numeroPolice(contrat),
        souscripteur: contrat.client.nom,
        numeroClient: contrat.client.id,
        assurePrincipal: `${l.assure.nom} ${l.assure.prenom ?? ""}`.trim(),
        prestataire: l.prestataireRef?.nom ?? l.prestataire,
        // "Règlement Maladie" = référence du bordereau de règlement
        // prestataire (BordereauReglement.numero) ; "Règlement Comptable" =
        // référence du chèque émis pour le régler (referenceVirement,
        // renseigné par ReglementComptableService.genererLettreCheque) —
        // voir demande utilisateur : "une version avec le règlement
        // maladie... et une autre avec la référence du chèque".
        numeroReglement: typeReglement === "comptable" ? (l.bordereau.referenceVirement ?? "Non réglé") : l.bordereau.numero,
        fraisReels, partGarant, tps,
        netAPayer: partGarant - tps,
        agence: agenceSaisie?.agence?.nom ?? "Sans agence (siège)",
        villePrestataire: villePrestataire || "—",
      };
      const cleGroupe = groupement === "prestataire" ? `p:${l.prestataireRef?.id ?? l.prestataire}` : contrat.client.id;
      const libelleGroupe = groupement === "prestataire"
        ? `${ligne.prestataire}${villePrestataire ? ` — ${villePrestataire}` : ""}`
        : contrat.client.nom;
      const groupe = parClient.get(cleGroupe) ?? {
        souscripteur: libelleGroupe, lignes: [], totaux: { fraisReels: 0, partGarant: 0, tps: 0, netAPayer: 0 },
      };
      groupe.lignes.push(ligne);
      groupe.totaux.fraisReels += fraisReels;
      groupe.totaux.partGarant += partGarant;
      groupe.totaux.tps += tps;
      groupe.totaux.netAPayer += ligne.netAPayer;
      parClient.set(cleGroupe, groupe);
    }

    const groupes = [...parClient.values()]
      .map((g) => ({ ...g, lignes: g.lignes.sort((a, b) => a.dateReglement.localeCompare(b.dateReglement) || a.dateSoins.localeCompare(b.dateSoins)) }))
      .sort((a, b) => a.souscripteur.localeCompare(b.souscripteur));

    const total = groupes.reduce(
      (s, g) => ({
        fraisReels: s.fraisReels + g.totaux.fraisReels,
        partGarant: s.partGarant + g.totaux.partGarant,
        tps: s.tps + g.totaux.tps,
        netAPayer: s.netAPayer + g.totaux.netAPayer,
      }),
      { fraisReels: 0, partGarant: 0, tps: 0, netAPayer: 0 },
    );

    return {
      du, au, compagnieId, compagnie: compagnie?.nom, typeReglement,
      agenceId: filtres.agenceId, agence: filtres.agenceId === SANS_AGENCE ? "Sans agence (siège)" : agenceFiltre?.nom,
      ville: filtres.ville?.trim() || undefined, groupement, groupes, total,
    };
  }

  // Villes des prestataires (filtre du bordereau sinistres).
  async villesPrestataires(): Promise<string[]> {
    const lignes = await this.prisma.prestataire.findMany({ where: { ville: { not: null } }, select: { ville: true }, distinct: ["ville"] });
    return [...new Set(lignes.map((l) => l.ville?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "fr"));
  }

  // Bordereau de Production / Émission de primes et de commissions
  // (2026-08) — voir demande utilisateur. Groupé par COMPAGNIE, TOUTES les
  // compagnies apparaissent même sans mouvement sur la période (voir
  // modèle fourni : "Aucune entrée pour la période sélectionnée"). Une
  // ligne par contrat "Affaire Nouvelle" émis (Contrat.createdAt) dans la
  // période — les avenants ne sont pas repris dans cette première version.
  async production(du?: string, au?: string, compagnieId?: string): Promise<BordereauProductionPayload> {
    const dateDu = parseDateFr(du);
    const dateAu = parseDateFr(au);

    const [compagnies, contrats] = await Promise.all([
      this.prisma.compagnie.findMany({ where: compagnieId ? { id: compagnieId } : undefined, orderBy: { nom: "asc" } }),
      this.prisma.contrat.findMany({
        where: {
          ...((dateDu || dateAu) ? { createdAt: { ...(dateDu ? { gte: dateDu } : {}), ...(dateAu ? { lte: finDeJournee(dateAu) } : {}) } } : {}),
          ...(compagnieId ? { compagnieId } : {}),
        },
        include: { client: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const parCompagnie = new Map<string, GroupeBordereauProduction>();
    for (const c of compagnies) {
      parCompagnie.set(c.id, { compagnieId: c.id, compagnie: c.nom, lignes: [], totaux: { primes: 0, access: 0, taxes: 0, primesTotales: 0, commission: 0 } });
    }

    for (const c of contrats) {
      const groupe = parCompagnie.get(c.compagnieId);
      if (!groupe) continue; // contrat rattaché à une compagnie supprimée entretemps — hors sujet ici
      const compagnie = compagnies.find((k) => k.id === c.compagnieId)!;
      const primes = Number(c.primeNette ?? c.prime);
      const access = Number(c.montantAccessoires ?? 0);
      const taxes = Number(c.montantTaxe ?? 0);
      const primesTotales = Number(c.primeTotaleHT ?? c.prime);
      const commission = Number(c.montantCommission ?? 0);
      groupe.lignes.push({
        numeroPolice: numeroPolice(c),
        codeAssure: compagnie.codeCourtier ?? "N/A",
        numQuittance: c.numeroQuittance != null ? String(c.numeroQuittance) : "N/A",
        dateEmisQuittance: "N/A",
        dateAvenant: "",
        nomSouscripteur: c.client.nom,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        produit: c.produit ?? `PEC ${c.client.nom}`,
        capitauxAssures: "Selon CP",
        primes, access, taxes, primesTotales,
      });
      groupe.totaux.primes += primes;
      groupe.totaux.access += access;
      groupe.totaux.taxes += taxes;
      groupe.totaux.primesTotales += primesTotales;
      groupe.totaux.commission += commission;
    }

    const groupes = [...parCompagnie.values()].sort((a, b) => a.compagnie.localeCompare(b.compagnie));
    const total = groupes.reduce(
      (s, g) => ({
        primes: s.primes + g.totaux.primes, access: s.access + g.totaux.access, taxes: s.taxes + g.totaux.taxes,
        primesTotales: s.primesTotales + g.totaux.primesTotales, commission: s.commission + g.totaux.commission,
      }),
      { primes: 0, access: 0, taxes: 0, primesTotales: 0, commission: 0 },
    );

    return { du, au, compagnieId, groupes, total };
  }

  // Bordereau d'Encaissement de Prime (2026-08) — voir demande utilisateur :
  // "exactement le même document [que la Production] dans la forme, la
  // différence est que l'un fait état de toutes les primes générées... et
  // l'autre retrace tout les primes encaissées". Même structure/colonnes
  // que production(), mais une ligne par PAIEMENT REÇU (EncaissementPrime,
  // saisie manuelle — voir EncaissementsService) au lieu d'une ligne par
  // contrat émis. Un paiement ne se décompose pas en primes/accessoires/
  // taxes (c'est un montant global reçu) : seul "Primes Totales" porte le
  // montant réellement encaissé, les 3 autres colonnes restent à 0.
  async encaissement(du?: string, au?: string, compagnieId?: string): Promise<BordereauProductionPayload> {
    const dateDu = parseDateFr(du);
    const dateAu = parseDateFr(au);

    const [compagnies, encaissements] = await Promise.all([
      this.prisma.compagnie.findMany({ where: compagnieId ? { id: compagnieId } : undefined, orderBy: { nom: "asc" } }),
      this.prisma.encaissementPrime.findMany({
        include: { contrat: { include: { client: true } } },
        orderBy: { dateEncaissement: "asc" },
      }),
    ]);

    const dansPeriode = encaissements.filter((e) => {
      const d = parseDateFr(e.dateEncaissement);
      if (!d) return false;
      if (dateDu && d < dateDu) return false;
      if (dateAu && d > dateAu) return false;
      if (compagnieId && e.contrat.compagnieId !== compagnieId) return false;
      return true;
    });

    const parCompagnie = new Map<string, GroupeBordereauProduction>();
    for (const c of compagnies) {
      parCompagnie.set(c.id, { compagnieId: c.id, compagnie: c.nom, lignes: [], totaux: { primes: 0, access: 0, taxes: 0, primesTotales: 0, commission: 0 } });
    }

    for (const e of dansPeriode) {
      const groupe = parCompagnie.get(e.contrat.compagnieId);
      if (!groupe) continue;
      const compagnie = compagnies.find((k) => k.id === e.contrat.compagnieId)!;
      const montant = Number(e.montant);
      groupe.lignes.push({
        numeroPolice: numeroPolice(e.contrat),
        codeAssure: compagnie.codeCourtier ?? "N/A",
        numQuittance: e.contrat.numeroQuittance != null ? String(e.contrat.numeroQuittance) : "N/A",
        dateEmisQuittance: "N/A",
        dateAvenant: e.dateEncaissement,
        nomSouscripteur: e.contrat.client.nom,
        dateDebut: e.contrat.dateDebut,
        dateFin: e.contrat.dateFin,
        produit: e.contrat.produit ?? `PEC ${e.contrat.client.nom}`,
        capitauxAssures: "Selon CP",
        primes: 0, access: 0, taxes: 0, primesTotales: montant,
      });
      groupe.totaux.primesTotales += montant;
    }

    const groupes = [...parCompagnie.values()].sort((a, b) => a.compagnie.localeCompare(b.compagnie));
    const total = groupes.reduce(
      (s, g) => ({
        primes: s.primes + g.totaux.primes, access: s.access + g.totaux.access, taxes: s.taxes + g.totaux.taxes,
        primesTotales: s.primesTotales + g.totaux.primesTotales, commission: s.commission + g.totaux.commission,
      }),
      { primes: 0, access: 0, taxes: 0, primesTotales: 0, commission: 0 },
    );

    return { du, au, compagnieId, groupes, total };
  }
}
