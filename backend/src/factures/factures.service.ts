import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SanteService } from "../sante/sante.service";
import { ReglementPrestataireService } from "../reglement-prestataire/reglement-prestataire.service";
import { CreateFactureDto } from "./dto/create-facture.dto";
import { UpdateFactureDto } from "./dto/update-facture.dto";
import { ApercuLigneDto } from "./dto/apercu-ligne.dto";
import { CreateFactureLigneDto } from "../sante/dto/create-facture-ligne.dto";
import { UpdateFactureLigneDto } from "../sante/dto/update-facture-ligne.dto";

// select ciblé (2026-09, était include: {contrat:true, ...} en entier) —
// voir demande utilisateur : "je veux la rapidité, la fluidité" ; mesuré en
// production, l'ancien `include` produisait 120 Mo de JSON pour l'écran
// Factures (24,5s) — chaque Contrat/Client/Compagnie/Bordereau/LettreCheque
// COMPLET (tous leurs champs Decimal compris) était hydraté pour CHAQUE
// facture et chaque ligne, alors que ApiFacture/ApiFactureLigne côté
// frontend (src/services/factures.service.ts) ne lisent que les champs
// listés ci-dessous. Même diagnostic déjà posé sur SanteService.findAssures
// (voir mémoire project-performance-optimisations) et sur le rapport
// Statistiques — toujours mesurer avant de conclure.
const SELECT_FACTURE = {
  id: true, prestataireId: true, contratId: true, dateReception: true, referenceFacture: true,
  gestionnaireId: true, statut: true, motifAnnulation: true,
  prestataire: { select: { nom: true } },
  contrat: { select: { client: { select: { nom: true } }, compagnie: { select: { nom: true } } } },
  lignes: {
    select: {
      id: true, assureId: true, type: true, date: true, acteMedicalId: true, accordPrealableId: true,
      montant: true, baseRemboursement: true, montantTps: true, resteACharge: true, tauxRemboursement: true,
      plafondApplique: true, statut: true, motifRejet: true, montantRejete: true, nSinistre: true, nDeclaration: true,
      natureMaladie: true, codeAffection: true, quantite: true, lettreCleCode: true, coefficient: true,
      assure: { select: { nom: true, prenom: true } },
      acteMedical: { select: { libelle: true } },
      bordereau: {
        select: {
          id: true, numero: true, statut: true,
          lettreCheque: { select: { numero: true, numeroCheque: true, banque: { select: { nom: true } } } },
        },
      },
    },
  },
  numerosSupplementaires: { select: { id: true, numero: true } },
} satisfies Prisma.FactureSelect;

// "dd/mm/yyyy" — même format que partout ailleurs dans le backend (voir
// Facture.dateReception, schema.prisma) ; pas de module partagé pour ça
// dans ce codebase, chaque service qui en a besoin le redéfinit localement
// (ex. population-historique.util.ts, prime.util.ts).
function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Acronyme du prestataire (2026-08) — voir demande utilisateur : "il faut
// revoir le principe de génération du numéro de facture depuis l'écran du
// prestataire... faire un acronyme avec toutes les premières lettres du nom
// du prestataire, tenir compte des déterminants (le, la, du, de,...)
// compris dans le nom. Exemple CHU de Libreville on aura CHUL." — un mot
// déjà entièrement en majuscules dans le nom (ex. "CHU") est une
// abréviation existante et reste intact ; un déterminant est ignoré ; tout
// autre mot ne contribue que sa première lettre.
const DETERMINANTS_NOM = new Set(["le", "la", "les", "l", "du", "de", "des", "d", "un", "une", "et", "en", "au", "aux"]);

const DIACRITIQUES = /[̀-ͯ]/g;

function genererAcronymePrestataire(nom: string): string {
  const mots = nom.split(/[\s'-]+/).filter(Boolean);
  let acronyme = "";
  for (const mot of mots) {
    const nettoye = mot.normalize("NFD").replace(DIACRITIQUES, "");
    if (DETERMINANTS_NOM.has(nettoye.toLowerCase())) continue;
    const estAbreviationExistante = nettoye.length > 1 && nettoye === nettoye.toUpperCase();
    acronyme += estAbreviationExistante ? nettoye : nettoye[0].toUpperCase();
  }
  return acronyme || "PRS";
}

@Injectable()
export class FacturesService {
  constructor(private prisma: PrismaService, private sante: SanteService, private reglement: ReglementPrestataireService) {}

  // Filtres de recherche avancée (2026-09 — voir demande utilisateur :
  // "ajouter des filtres de recherche avancée dans l'onglet... facture...
  // prenant en compte plusieurs facteurs de recherche") — `clientId` passe
  // par la relation contrat (une Facture n'a pas de clientId direct) ;
  // `du`/`au` filtrent sur dateReception, stockée en texte "dd/mm/yyyy"
  // (schema.prisma), donc en mémoire après lecture — même patron que
  // findEligiblesReglement ci-dessous.
  // contrat.estTest: false (2026-09) — voir schema.prisma Contrat.estTest :
  // une facture saisie par un prestataire sur la famille test ne doit
  // jamais apparaître dans la comptabilité/facturation réelle de la
  // société, quel que soit le filtre demandé par l'appelant.
  async findAll(filtres?: { prestataireId?: string; contratId?: string; clientId?: string; statut?: string; reference?: string; du?: string; au?: string; gestionnaireId?: string }) {
    const factures = await this.prisma.facture.findMany({
      where: {
        prestataireId: filtres?.prestataireId, contratId: filtres?.contratId, statut: filtres?.statut,
        gestionnaireId: filtres?.gestionnaireId,
        contrat: { estTest: false, ...(filtres?.clientId ? { clientId: filtres.clientId } : {}) },
        // Recherche par référence — matche le numéro principal OU l'un des
        // numéros supplémentaires (une déclaration peut regrouper plusieurs
        // numéros de facture prestataire, voir schema.prisma NumeroFacture).
        ...(filtres?.reference
          ? { OR: [
              { referenceFacture: { contains: filtres.reference, mode: "insensitive" } },
              { numerosSupplementaires: { some: { numero: { contains: filtres.reference, mode: "insensitive" } } } },
            ] }
          : {}),
      },
      select: SELECT_FACTURE,
      orderBy: { createdAt: "desc" },
    });
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    if (!du && !au) return factures;
    return factures.filter((f) => {
      const d = parseDateFr(f.dateReception);
      if (!d) return false;
      if (du && d < du) return false;
      if (au && d > au) return false;
      return true;
    });
  }

  // Factures éligibles à un nouveau règlement — écran de génération
  // (voir ReglementPrestataireService.genererBordereau). Exclut toute
  // facture dont au moins une ligne appartient déjà à un bordereau : une
  // fois liée à un règlement, une facture ne doit plus jamais y
  // réapparaître, même partiellement. `dateReception` étant un texte
  // "dd/mm/yyyy" (schema.prisma), le filtre de période se fait en mémoire
  // après lecture, pas via une clause Prisma gte/lte.
  async findEligiblesReglement(filtres: { prestataireId: string; compagnieId?: string; clientId?: string; du?: string; au?: string }) {
    const factures = await this.prisma.facture.findMany({
      where: {
        prestataireId: filtres.prestataireId,
        statut: { not: "Annulée" },
        contrat: { estTest: false, compagnieId: filtres.compagnieId, clientId: filtres.clientId },
        lignes: { some: {}, none: { bordereauId: { not: null } } },
      },
      select: SELECT_FACTURE,
      orderBy: { dateReception: "desc" },
    });
    const du = parseDateFr(filtres.du);
    const au = parseDateFr(filtres.au);
    if (!du && !au) return factures;
    return factures.filter((f) => {
      const d = parseDateFr(f.dateReception);
      if (!d) return true;
      if (du && d < du) return false;
      if (au && d > au) return false;
      return true;
    });
  }

  async findOne(id: string) {
    const facture = await this.prisma.facture.findUnique({ where: { id }, select: SELECT_FACTURE });
    if (!facture) throw new NotFoundException(`Facture ${id} introuvable`);
    return facture;
  }

  // gestionnaireId facultatif (2026-08) — une facture créée en libre-service
  // depuis le portail prestataire (voir PortailPrestataireController) n'a
  // aucun gestionnaire interne à l'origine ; le champ reste nullable en base
  // pour ce cas (voir schema.prisma Facture.gestionnaireId).
  create(dto: CreateFactureDto, gestionnaireId?: string) {
    return this.prisma.facture.create({
      data: {
        id: `FAC-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        prestataireId: dto.prestataireId, contratId: dto.contratId,
        dateReception: dto.dateReception, referenceFacture: dto.referenceFacture,
        gestionnaireId,
      },
      select: SELECT_FACTURE,
    });
  }

  // Numéro de facture auto-généré, portail prestataire (2026-08) — voir
  // demande utilisateur : "CHU de Libreville: CHUL-000001/2026 (la
  // référence se génère à l'infini, mais l'acronyme reste inchangé pour le
  // prestataire)". Le compteur (Prestataire.compteurFacture) n'est jamais
  // décrémenté, même en cas d'annulation d'une facture, pour garantir une
  // séquence strictement croissante et jamais réutilisée ; l'année suffixée
  // est celle de la génération (pas remise à zéro chaque année, le
  // compteur reste continu — seul le suffixe affiché change).
  async genererReferencePortail(prestataireId: string): Promise<string> {
    const prestataire = await this.prisma.prestataire.update({
      where: { id: prestataireId },
      data: { compteurFacture: { increment: 1 } },
    });
    const acronyme = genererAcronymePrestataire(prestataire.nom);
    return `${acronyme}-${String(prestataire.compteurFacture).padStart(6, "0")}/${new Date().getFullYear()}`;
  }

  async update(id: string, dto: UpdateFactureDto) {
    await this.findOne(id);
    return this.prisma.facture.update({ where: { id }, data: dto, select: SELECT_FACTURE });
  }

  // Annulation (2026-08) — jamais une suppression : la facture reste visible
  // dans la liste du prestataire avec son motif, mais ne peut plus être
  // complétée ni intégrer un nouveau bordereau (voir genererBordereau).
  // Bloquée si une ligne appartient déjà à un bordereau "Payé" — au-delà, un
  // règlement effectué ne doit pas pouvoir être silencieusement rétracté.
  async annuler(id: string, motif: string) {
    const facture = await this.prisma.facture.findUnique({ where: { id }, include: { lignes: { include: { bordereau: true } } } });
    if (!facture) throw new NotFoundException(`Facture ${id} introuvable`);
    if (facture.statut === "Annulée") throw new BadRequestException("Cette facture est déjà annulée.");
    const lignePayee = facture.lignes.find((l) => l.bordereau?.statut === "Payé");
    if (lignePayee) throw new BadRequestException("Impossible d'annuler : cette facture a au moins une ligne déjà réglée (bordereau payé).");

    for (const ligne of facture.lignes) {
      if (ligne.bordereauId) await this.reglement.detacherLigne(ligne.bordereauId, ligne.id);
    }
    return this.prisma.facture.update({ where: { id }, data: { statut: "Annulée", motifAnnulation: motif }, select: SELECT_FACTURE });
  }

  async ajouterLigne(factureId: string, dto: CreateFactureLigneDto, opts?: { ignorerDoublonMemeJour?: boolean; exigerAffection?: boolean; baseRemboursementImpose?: number }) {
    const facture = await this.findOne(factureId);
    if (facture.statut === "Annulée") throw new BadRequestException("Facture annulée — impossible d'ajouter une ligne.");
    return this.sante.creerLigneFacture(factureId, dto, opts);
  }

  // Aperçu de calcul (taux/part assurance) sans persister — alimente
  // l'affichage "Taux de prise en charge" du formulaire de saisie avant
  // même que la ligne soit ajoutée.
  async apercuLigne(factureId: string, dto: ApercuLigneDto) {
    const facture = await this.findOne(factureId);
    const montantPourCalcul = Math.max(0, dto.montant - (dto.montantRejete ?? 0));
    return this.sante.calculerPartAssuranceLigne(dto.assureId, facture.contratId, dto.typePrestation, montantPourCalcul, facture.prestataireId, undefined, dto.acteMedicalId);
  }

  // Une ligne reste modifiable même après batching dans un bordereau — la
  // demande explicite de l'utilisateur est que la modification "mette à
  // jour systématiquement le règlement", donc le recalcul a lieu même si le
  // bordereau est déjà "Payé" (contrairement à l'annulation, plus stricte).
  async modifierLigne(factureId: string, ligneId: string, dto: UpdateFactureLigneDto) {
    await this.verifierLigneAppartientFacture(factureId, ligneId);
    const ligne = await this.sante.modifierLigneFacture(ligneId, dto);
    if (ligne.bordereauId) await this.reglement.recalculerMontantTotal(ligne.bordereauId);
    return ligne;
  }

  async rejeterLigne(factureId: string, ligneId: string, motifRejet: string) {
    await this.verifierLigneAppartientFacture(factureId, ligneId);
    return this.sante.rejeterLigneFacture(ligneId, motifRejet);
  }

  // Annulation d'une ligne (2026-08) — voir demande utilisateur : "on doit
  // pouvoir annuler une prestation faite par erreur", distincte du rejet
  // (décision de l'assurance) — voir SanteService.annulerLigneFacture.
  async annulerLigne(factureId: string, ligneId: string, motif: string) {
    await this.verifierLigneAppartientFacture(factureId, ligneId);
    return this.sante.annulerLigneFacture(ligneId, motif);
  }

  async supprimerLigne(factureId: string, ligneId: string) {
    await this.verifierLigneAppartientFacture(factureId, ligneId);
    return this.sante.supprimerLigneFacture(ligneId);
  }

  // Numéros de facture prestataire additionnels (2026-08) — une déclaration
  // peut en regrouper plusieurs si la saisie a été traitée en batch (voir
  // schema.prisma NumeroFacture, findAll ci-dessus pour la recherche).
  async ajouterNumero(factureId: string, numero: string) {
    await this.findOne(factureId);
    const valeur = numero.trim();
    if (!valeur) throw new BadRequestException("Le numéro de facture ne peut pas être vide.");
    try {
      await this.prisma.numeroFacture.create({ data: { factureId, numero: valeur } });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        throw new BadRequestException("Ce numéro de facture est déjà rattaché à cette déclaration.");
      }
      throw err;
    }
    return this.findOne(factureId);
  }

  async supprimerNumero(factureId: string, numeroId: string) {
    // Vérifie que factureId appartient bien à la société de l'appelant
    // (2026-09) — même garde que ajouterNumero ci-dessus, absente ici
    // jusqu'à présent : sans elle, connaître un couple (factureId,
    // numeroId) d'une AUTRE société suffisait à en supprimer une ligne.
    await this.findOne(factureId);
    const numero = await this.prisma.numeroFacture.findUnique({ where: { id: numeroId } });
    if (!numero || numero.factureId !== factureId) throw new NotFoundException(`Numéro ${numeroId} introuvable sur cette facture.`);
    await this.prisma.numeroFacture.delete({ where: { id: numeroId } });
    return this.findOne(factureId);
  }

  private async verifierLigneAppartientFacture(factureId: string, ligneId: string) {
    const ligne = await this.prisma.priseEnCharge.findUnique({ where: { id: ligneId } });
    if (!ligne || ligne.factureId !== factureId) throw new NotFoundException(`Ligne ${ligneId} introuvable sur cette facture.`);
  }
}
