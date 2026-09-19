import PDFDocument from "pdfkit";
import type { Response } from "express";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TarificationService } from "./tarification.service";
import { GenererFactureAbonnementDto } from "./dto/generer-facture-abonnement.dto";
import { PayerFactureAbonnementDto } from "./dto/payer-facture-abonnement.dto";
import { lettrerCompte, type MouvementALettrer } from "../lettrage/lettrage.util";

// Facturation de la plateforme (2026-09) — voir demande utilisateur : "un
// vrai formulaire dédié à la facturation... TVA (18%), TPS (9.5%), CSS
// (1%), on doit pouvoir sélectionner les taxes à activer... plusieurs
// lignes." Aucune passerelle de paiement branchée sur ce projet — chaque
// règlement est CONSTATÉ manuellement par le Super Admin (même principe que
// EncaissementPrime/QuittanceLibre côté métier des sociétés elles-mêmes).
const MOIS_PAR_CYCLE: Record<string, number> = { Mensuel: 1, Trimestriel: 3, Semestriel: 6, Annuel: 12 };

// Plan comptable OHADA (2026-09) — voir demande utilisateur : "au Gabon, en
// matière de comptabilité c'est le SYSCOHADA qui est en vigueur (avec le
// plan comptable OHADA)." Comptes standards utilisés pour la comptabilité
// D'ENGAGEMENT de la plateforme (débit/crédit dès l'émission d'une
// facture, pas seulement à l'encaissement) :
//   411 Clients — créance TTC sur la société facturée
//   706 Services vendus — le chiffre d'affaires HT (activité de service)
//   4434 État, TVA facturée sur ventes
//   512 Banques — encaissement du règlement
// Les 2 taxes propres à ce projet (TPS soustractive, CSS) n'ont pas de
// numéro OHADA universellement établi pour ce cas précis — comptes
// RAISONNABLES retenus, à faire valider par l'expert-comptable de chaque
// société avant tout usage réglementaire :
//   4457 État, autres impôts et taxes assimilés — la CSS (s'ajoute au TTC dû)
//   709 RRR accordés par l'entreprise — la TPS (soustractive : réduit ce
//       que le client doit réellement payer, comptabilisée en réduction de
//       produit plutôt qu'en charge, pour que le débit 411 = le TTC net dû)
export const PLAN_COMPTABLE = {
  clients: "411", ventes: "706", tva: "4434", css: "4457", tps: "709", banque: "512",
} as const;

// Taux légaux gabonais par défaut (2026-09) — voir demande utilisateur :
// "TVA (18%), TPS (9.5%), CSS (1%)". Une simple SUGGESTION de départ : le
// Super Admin choisit, facture par facture, quelles taxes activer et peut
// ajuster chaque taux avant émission (voir GenererFactureAbonnementDto) —
// jamais imposé.
export const TAUX_LEGAUX = { tva: 18, tps: 9.5, css: 1 };

function ajouterJours(date: Date, jours: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + jours);
  return d.toLocaleDateString("fr-FR");
}

function ajouterMois(date: Date, mois: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + mois);
  return d.toLocaleDateString("fr-FR");
}

const SELECT_FACTURE = {
  id: true, numero: true, societeId: true, type: true, periodeDebut: true, periodeFin: true,
  montantHT: true, tauxTva: true, montantTva: true, tauxTps: true, montantTps: true, tauxCss: true, montantCss: true, montantTTC: true,
  statut: true, dateEmission: true, dateEcheance: true, datePaiement: true, modePaiement: true,
  referencePaiement: true, note: true, createdAt: true,
  societe: { select: { id: true, nom: true } },
  lignes: { orderBy: { ordre: "asc" as const }, select: { id: true, rubriqueCode: true, designation: true, quantite: true, prixUnitaire: true, montant: true, ordre: true } },
};

@Injectable()
export class FactureAbonnementService {
  constructor(private prisma: PrismaService, private tarification: TarificationService) {}

  // Montant d'UNE période au cycle de la société — prixAbonnement (négocié
  // pour cette société précise) prioritaire, sinon la somme des prix des
  // modules souscrits (voir TarificationService.calculerPrixModules,
  // "l'option d'abonnement s'enrichisse en fonction des fonctionnalités
  // cochées") × durée du cycle, sinon le tarif du plan choisi × durée.
  async calculerMontantPeriode(societeId: string): Promise<number | null> {
    const societe = await this.prisma.societeAssurance.findUnique({
      where: { id: societeId },
      select: { cycleFacturation: true, prixAbonnement: true, modules: true, planAbonnement: { select: { prixMensuel: true } } },
    });
    if (!societe) throw new NotFoundException(`Société ${societeId} introuvable`);
    const mois = MOIS_PAR_CYCLE[societe.cycleFacturation] ?? 1;
    if (societe.prixAbonnement != null) return Number(societe.prixAbonnement);
    const parModules = await this.tarification.calculerPrixModules(societe.modules);
    if (parModules > 0) return parModules * mois;
    if (societe.planAbonnement?.prixMensuel != null) return Number(societe.planAbonnement.prixMensuel) * mois;
    return null;
  }

  // Population FACTURABLE d'une société (2026-09) — voir demande
  // utilisateur : "la licence annuelle par assuré... y compris les ayants
  // droit" et "on facture la carte par assuré et ayant droit." Chaque
  // ayant droit (CJ/EF) est sa propre ligne AssureSante (voir
  // schema.prisma) — compter TOUTES les lignes ACTIVES revient donc déjà
  // à compter assurés principaux ET ayants droit confondus, sans logique
  // supplémentaire. Radiés/suspendus exclus — jamais facturés.
  async compterPersonnes(societeId: string): Promise<number> {
    return this.prisma.assureSante.count({ where: { societeId, statut: "Actif" } });
  }

  // Aperçu public des lignes calculées (2026-09) — voir demande
  // utilisateur : "le formulaire de facturation... ne fonctionne toujours
  // pas comme une facturation dédiée." Une vraie facture se compose
  // TOUJOURS ligne par ligne (jamais un "mode" verrouillé par un type) —
  // ce point d'entrée permet au formulaire d'INSÉRER une ligne calculée
  // (abonnement/installation/cartes) dans l'éditeur multi-lignes en un
  // clic, sans jamais créer la facture ni imposer d'être le SEUL contenu
  // de la facture (l'utilisateur peut ensuite ajouter/retirer/modifier
  // librement avant d'enregistrer).
  suggererLignes(societeId: string, type: string, dto: GenererFactureAbonnementDto) {
    return this.lignesParDefaut(societeId, type, dto);
  }

  // Ne bloque JAMAIS (2026-09) — voir demande utilisateur : le formulaire
  // doit fonctionner comme une vraie facturation dédiée, l'insertion
  // rapide n'est qu'une AIDE à la saisie. Quand une donnée manque (frais
  // d'installation non défini, aucune population assurée...), une ligne
  // PLACEHOLDER est insérée quand même (prix à 0 ou déjà connu, désignation
  // explicite "à compléter") plutôt qu'une erreur qui interromprait la
  // saisie — l'utilisateur reste toujours libre d'ajuster/compléter avant
  // d'enregistrer.
  private async lignesParDefaut(societeId: string, type: string, dto: GenererFactureAbonnementDto): Promise<{ rubriqueCode?: string; designation: string; quantite: number; prixUnitaire: number }[]> {
    const societe = await this.prisma.societeAssurance.findUnique({ where: { id: societeId }, select: { nom: true, fraisInstallation: true, cycleFacturation: true } });
    if (!societe) throw new NotFoundException(`Société ${societeId} introuvable`);
    if (type === "Installation") {
      const montant = societe.fraisInstallation != null ? Number(societe.fraisInstallation) : null;
      if (montant == null) {
        return [{ rubriqueCode: "installation", designation: `Frais d'installation — ${societe.nom} (montant à saisir)`, quantite: 1, prixUnitaire: 0 }];
      }
      return [{ rubriqueCode: "installation", designation: "Frais d'installation", quantite: 1, prixUnitaire: montant }];
    }
    if (type === "Abonnement") {
      const mois = MOIS_PAR_CYCLE[societe.cycleFacturation] ?? 1;
      const lignes: { rubriqueCode?: string; designation: string; quantite: number; prixUnitaire: number }[] = [];

      const montantModules = await this.calculerMontantPeriode(societeId);
      const periodeFin = dto.periodeFin ?? ajouterMois(new Date(), mois);
      if (montantModules != null) {
        lignes.push({ rubriqueCode: "abonnement-modules", designation: `Abonnement MedAssur (${societe.cycleFacturation}) — jusqu'au ${periodeFin}`, quantite: 1, prixUnitaire: montantModules });
      }

      // Licence annuelle par personne assurée (2026-09) — voir demande
      // utilisateur : "en plus de la tarification liée aux fonctionnalités,
      // il y a la licence annuelle par assuré... montant minimum de 5000
      // pour assuré y compris les ayants droit." Tarif ANNUEL, au prorata
      // du cycle de facturation choisi par la société (une facture
      // mensuelle ne porte donc que 1/12e de la licence annuelle par
      // personne, jamais le montant plein) — voir ParametresFacturationPlateforme.
      const nombrePersonnes = await this.compterPersonnes(societeId);
      if (nombrePersonnes > 0) {
        const parametres = await this.tarification.getParametresFacturation();
        // Prix PAR PERSONNE, déjà proratisé au cycle — ne JAMAIS re-diviser
        // par nombrePersonnes ensuite (le total est fait par genererFacture
        // via quantite × prixUnitaire).
        const prixUnitaireProratise = Math.round((Number(parametres.licenceAnnuellePersonne) / 12) * mois);
        lignes.push({ rubriqueCode: "licence-annuelle", designation: `Licence annuelle — ${nombrePersonnes} assuré(s)/ayant(s) droit (${societe.cycleFacturation}, au prorata)`, quantite: nombrePersonnes, prixUnitaire: prixUnitaireProratise });
      }

      if (lignes.length === 0) {
        return [{ rubriqueCode: "abonnement-modules", designation: `Abonnement MedAssur — ${societe.nom} (montant à saisir)`, quantite: 1, prixUnitaire: 0 }];
      }
      return lignes;
    }
    if (type === "Cartes") {
      const nombrePersonnes = dto.nombrePersonnes ?? await this.compterPersonnes(societeId);
      const parametres = await this.tarification.getParametresFacturation();
      if (!nombrePersonnes) {
        return [{ rubriqueCode: "carte-assurance", designation: `Carte d'assurance — ${societe.nom} (nombre de personnes à préciser)`, quantite: 1, prixUnitaire: Number(parametres.carteParPersonne) }];
      }
      return [{ rubriqueCode: "carte-assurance", designation: `Carte d'assurance — ${nombrePersonnes} assuré(s)/ayant(s) droit`, quantite: nombrePersonnes, prixUnitaire: Number(parametres.carteParPersonne) }];
    }
    // Type "Autre" : aucune composition automatique possible (pas de règle
    // de calcul associée) — une ligne vide générique reste plus utile
    // qu'une erreur qui interromprait l'insertion rapide.
    return [{ designation: "Nouvelle ligne", quantite: 1, prixUnitaire: 0 }];
  }

  // Formulaire de facturation complet (2026-09) — voir demande utilisateur.
  // Calcule montantHT depuis les lignes, applique les taxes explicitement
  // choisies (taux figés à l'émission), assigne le prochain numéro de la
  // série plateforme.
  async genererFacture(societeId: string, dto: GenererFactureAbonnementDto) {
    const type = dto.type ?? "Abonnement";
    const lignesSource = dto.lignes?.length ? dto.lignes : await this.lignesParDefaut(societeId, type, dto);
    const lignes = lignesSource.map((l, i) => {
      const quantite = l.quantite ?? 1;
      const montant = Math.round(quantite * l.prixUnitaire);
      return { rubriqueCode: l.rubriqueCode, designation: l.designation, quantite, prixUnitaire: l.prixUnitaire, montant, ordre: i };
    });
    const montantHT = lignes.reduce((s, l) => s + l.montant, 0);

    // Fiscalité gabonaise (2026-09) — voir demande utilisateur : "la TPS
    // n'est pas additive, mais soustractive. Mais, TPS et CSS se calculent
    // sur le montant HT." Les 3 taxes se calculent chacune sur montantHT
    // (jamais en cascade les unes sur les autres) ; TVA et CSS s'AJOUTENT
    // au HT pour obtenir le TTC, la TPS s'en RETRANCHE.
    const tauxTva = dto.appliquerTva ? (dto.tauxTva ?? TAUX_LEGAUX.tva) : null;
    const montantTva = tauxTva != null ? Math.round((montantHT * tauxTva) / 100) : 0;
    const tauxTps = dto.appliquerTps ? (dto.tauxTps ?? TAUX_LEGAUX.tps) : null;
    const montantTps = tauxTps != null ? Math.round((montantHT * tauxTps) / 100) : 0;
    const tauxCss = dto.appliquerCss ? (dto.tauxCss ?? TAUX_LEGAUX.css) : null;
    const montantCss = tauxCss != null ? Math.round((montantHT * tauxCss) / 100) : 0;
    const montantTTC = montantHT + montantTva - montantTps + montantCss;

    const aujourdhui = new Date();
    return this.prisma.factureAbonnement.create({
      data: {
        societeId, type,
        periodeDebut: type === "Abonnement" ? (dto.periodeDebut ?? aujourdhui.toLocaleDateString("fr-FR")) : dto.periodeDebut,
        periodeFin: dto.periodeFin,
        montantHT, tauxTva, montantTva, tauxTps, montantTps, tauxCss, montantCss, montantTTC,
        dateEmission: aujourdhui.toLocaleDateString("fr-FR"),
        dateEcheance: dto.dateEcheance ?? ajouterJours(aujourdhui, 15),
        note: dto.note,
        lignes: { create: lignes },
      },
      select: SELECT_FACTURE,
    });
  }

  // Frais d'installation générés AUTOMATIQUEMENT à la création d'une
  // société (voir SocietesService.create) — variante interne à une seule
  // ligne, sans passer par la validation du DTO HTTP.
  async genererInstallationAuto(societeId: string, montant: number, note?: string) {
    return this.genererFacture(societeId, { type: "Installation", lignes: [{ rubriqueCode: "installation", designation: "Frais d'installation initiale", quantite: 1, prixUnitaire: montant }], note });
  }

  findAll(filtres?: { societeId?: string; statut?: string; type?: string }) {
    return this.prisma.factureAbonnement.findMany({
      where: { societeId: filtres?.societeId, statut: filtres?.statut, type: filtres?.type },
      select: SELECT_FACTURE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.factureAbonnement.findUnique({ where: { id }, select: SELECT_FACTURE });
    if (!f) throw new NotFoundException(`Facture ${id} introuvable`);
    return f;
  }

  async payer(id: string, dto: PayerFactureAbonnementDto) {
    const facture = await this.prisma.factureAbonnement.findUnique({ where: { id } });
    if (!facture) throw new NotFoundException(`Facture ${id} introuvable`);
    if (facture.statut === "Payee") throw new BadRequestException("Cette facture est déjà réglée.");
    if (facture.statut === "Annulee") throw new BadRequestException("Cette facture est annulée.");
    return this.prisma.factureAbonnement.update({
      where: { id },
      data: {
        statut: "Payee", modePaiement: dto.modePaiement, referencePaiement: dto.referencePaiement,
        datePaiement: dto.datePaiement ?? new Date().toLocaleDateString("fr-FR"),
      },
      select: SELECT_FACTURE,
    });
  }

  async annuler(id: string) {
    const facture = await this.prisma.factureAbonnement.findUnique({ where: { id } });
    if (!facture) throw new NotFoundException(`Facture ${id} introuvable`);
    if (facture.statut === "Payee") throw new BadRequestException("Impossible d'annuler une facture déjà réglée.");
    return this.prisma.factureAbonnement.update({ where: { id }, data: { statut: "Annulee" }, select: SELECT_FACTURE });
  }

  // "Comptabilité complète" (2026-09) — voir demande utilisateur. Vue
  // d'ensemble des revenus de la plateforme : facturé/encaissé/impayé au
  // total et par société, taxes collectées, plus une tendance mensuelle (12
  // derniers mois, sur les factures RÉGLÉES) pour un graphique côté frontend.
  async resume() {
    const factures = await this.prisma.factureAbonnement.findMany({
      select: { societeId: true, societe: { select: { nom: true } }, montantTTC: true, montantTva: true, montantTps: true, montantCss: true, statut: true, dateEcheance: true, datePaiement: true },
    });
    const parseFr = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
    const aujourdhui = new Date();

    let totalFacture = 0, totalEncaisse = 0, totalImpaye = 0, totalEnRetard = 0;
    let totalTvaCollectee = 0, totalTpsCollectee = 0, totalCssCollectee = 0;
    const parSociete = new Map<string, { societeId: string; nom: string; facture: number; encaisse: number; impaye: number }>();
    for (const f of factures) {
      const montant = Number(f.montantTTC);
      totalFacture += montant;
      if (!parSociete.has(f.societeId)) parSociete.set(f.societeId, { societeId: f.societeId, nom: f.societe.nom, facture: 0, encaisse: 0, impaye: 0 });
      const s = parSociete.get(f.societeId)!;
      s.facture += montant;
      if (f.statut === "Payee") {
        totalEncaisse += montant; s.encaisse += montant;
        totalTvaCollectee += Number(f.montantTva); totalTpsCollectee += Number(f.montantTps); totalCssCollectee += Number(f.montantCss);
      } else if (f.statut === "Emise") {
        totalImpaye += montant; s.impaye += montant;
        if (parseFr(f.dateEcheance) < aujourdhui) totalEnRetard += montant;
      }
    }

    // Tendance mensuelle — encaissements réels des 12 derniers mois.
    const parMois = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
      parMois.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const f of factures) {
      if (f.statut !== "Payee" || !f.datePaiement) continue;
      const d = parseFr(f.datePaiement);
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (parMois.has(cle)) parMois.set(cle, (parMois.get(cle) ?? 0) + Number(f.montantTTC));
    }

    return {
      totalFacture, totalEncaisse, totalImpaye, totalEnRetard,
      totalTvaCollectee, totalTpsCollectee, totalCssCollectee,
      parSociete: [...parSociete.values()].sort((a, b) => b.facture - a.facture),
      tendanceMensuelle: [...parMois.entries()].map(([mois, montant]) => ({ mois, montant })),
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // États comptables (2026-09) — voir demande utilisateur : "un module
  // complet de comptabilité avec tous les états."
  // ══════════════════════════════════════════════════════════════════

  // Balance âgée des impayés — factures Émises, réparties par ancienneté de
  // retard (0-30j / 30-60j / 60-90j / +90j), standard de tout état
  // comptable de créances.
  async balanceAgee() {
    const factures = await this.prisma.factureAbonnement.findMany({
      where: { statut: "Emise" },
      select: { id: true, numero: true, societeId: true, societe: { select: { nom: true } }, montantTTC: true, dateEcheance: true, dateEmission: true },
    });
    const parseFr = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
    const aujourdhui = new Date();
    const lignes = factures.map((f) => {
      const joursRetard = Math.floor((aujourdhui.getTime() - parseFr(f.dateEcheance).getTime()) / 86_400_000);
      const tranche = joursRetard <= 0 ? "À échoir" : joursRetard <= 30 ? "0-30j" : joursRetard <= 60 ? "30-60j" : joursRetard <= 90 ? "60-90j" : "+90j";
      return { id: f.id, numero: f.numero, societeId: f.societeId, societeNom: f.societe.nom, montant: Number(f.montantTTC), dateEmission: f.dateEmission, dateEcheance: f.dateEcheance, joursRetard, tranche };
    });
    const parTranche = new Map<string, number>();
    for (const l of lignes) parTranche.set(l.tranche, (parTranche.get(l.tranche) ?? 0) + l.montant);
    return { lignes: lignes.sort((a, b) => b.joursRetard - a.joursRetard), parTranche: [...parTranche.entries()].map(([tranche, montant]) => ({ tranche, montant })) };
  }

  // État des taxes (2026-09) — voir demande utilisateur : "malgré
  // l'existence d'une facture, les données ne remontent pas" + "au Gabon...
  // c'est le SYSCOHADA qui est en vigueur." Le SYSCOHADA suit une
  // comptabilité D'ENGAGEMENT : la taxe est constatée dès l'ÉMISSION de la
  // facture (compte 4434 crédité), pas seulement à l'encaissement — une
  // facture émise mais impayée doit donc déjà apparaître ici. "Facturé"
  // (colonne d'engagement, sur dateEmission, toutes factures non annulées)
  // et "Encaissé" (colonne de caisse, sur datePaiement, factures payées
  // uniquement) sont donc DEUX totaux distincts, jamais un seul mélangé.
  async etatTaxes(du?: string, au?: string) {
    const parseFr = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
    const dansPeriode = (dateStr: string | null) => {
      if (!dateStr) return false;
      const d = parseFr(dateStr);
      if (du && d < parseFr(du)) return false;
      if (au && d > parseFr(au)) return false;
      return true;
    };
    const factures = await this.prisma.factureAbonnement.findMany({
      where: { statut: { not: "Annulee" } },
      select: { numero: true, societe: { select: { nom: true } }, montantHT: true, tauxTva: true, montantTva: true, tauxTps: true, montantTps: true, tauxCss: true, montantCss: true, montantTTC: true, statut: true, dateEmission: true, datePaiement: true },
    });
    const facturees = factures.filter((f) => dansPeriode(f.dateEmission));
    const encaissees = factures.filter((f) => f.statut === "Payee" && dansPeriode(f.datePaiement));

    const ligne = (f: (typeof factures)[number], date: string | null) => ({
      numero: f.numero, societeNom: f.societe.nom, date, statut: f.statut,
      montantHT: Number(f.montantHT), tauxTva: f.tauxTva ? Number(f.tauxTva) : null, montantTva: Number(f.montantTva),
      tauxTps: f.tauxTps ? Number(f.tauxTps) : null, montantTps: Number(f.montantTps),
      tauxCss: f.tauxCss ? Number(f.tauxCss) : null, montantCss: Number(f.montantCss), montantTTC: Number(f.montantTTC),
    });
    const totaux = (liste: typeof facturees) => ({
      montantHT: liste.reduce((s, f) => s + Number(f.montantHT), 0),
      montantTva: liste.reduce((s, f) => s + Number(f.montantTva), 0),
      montantTps: liste.reduce((s, f) => s + Number(f.montantTps), 0),
      montantCss: liste.reduce((s, f) => s + Number(f.montantCss), 0),
      montantTTC: liste.reduce((s, f) => s + Number(f.montantTTC), 0),
    });

    return {
      compteTva: PLAN_COMPTABLE.tva, compteCss: PLAN_COMPTABLE.css, compteTps: PLAN_COMPTABLE.tps,
      facture: { lignes: facturees.map((f) => ligne(f, f.dateEmission)), totaux: totaux(facturees) },
      encaisse: { lignes: encaissees.map((f) => ligne(f, f.datePaiement)), totaux: totaux(encaissees) },
    };
  }

  // Grand livre — compte 411 "Clients", sous-compte par société (2026-09) —
  // voir demande utilisateur : SYSCOHADA. Historique chronologique complet
  // (factures émises = débit du compte client dès l'engagement, règlements
  // = crédit), avec solde courant : l'équivalent exact d'un extrait de
  // compte 411xxx tenu par société.
  async grandLivre(societeId: string) {
    const factures = await this.findAll({ societeId });
    const parseFr = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
    type Mouvement = { date: string; libelle: string; debit: number; credit: number };
    const mouvements: Mouvement[] = [];
    for (const f of factures) {
      if (f.statut === "Annulee") continue;
      mouvements.push({ date: f.dateEmission, libelle: `Facture n°${f.numero} — ${f.type}`, debit: Number(f.montantTTC), credit: 0 });
      if (f.statut === "Payee" && f.datePaiement) {
        mouvements.push({ date: f.datePaiement, libelle: `Règlement facture n°${f.numero}${f.modePaiement ? ` (${f.modePaiement})` : ""}`, debit: 0, credit: Number(f.montantTTC) });
      }
    }
    mouvements.sort((a, b) => parseFr(a.date).getTime() - parseFr(b.date).getTime());
    let solde = 0;
    const avecSolde = mouvements.map((m) => { solde += m.debit - m.credit; return { ...m, solde }; });
    return { compte: PLAN_COMPTABLE.clients, mouvements: avecSolde, soldeFinal: solde };
  }

  // Lettrage du compte 411 "Clients" (2026-09) — voir demande utilisateur :
  // "il faut que l'outil IA puisse également faire un vrai lettrage de
  // compte" + "il faudrait vraiment que l'application soit synchro...
  // fais également remonter les informations ici." Un SEUL moteur partagé
  // (voir lettrage.util.ts) appliqué ici société par société — chaque
  // société est un sous-compte 411 indépendant, jamais lettrée avec une
  // autre.
  async lettrageClients() {
    const factures = await this.prisma.factureAbonnement.findMany({
      where: { statut: { not: "Annulee" } },
      select: { id: true, numero: true, societeId: true, societe: { select: { nom: true } }, type: true, montantTTC: true, statut: true, dateEmission: true, datePaiement: true },
    });
    const parSociete = new Map<string, { societeId: string; societeNom: string; mouvements: MouvementALettrer[] }>();
    for (const f of factures) {
      if (!parSociete.has(f.societeId)) parSociete.set(f.societeId, { societeId: f.societeId, societeNom: f.societe.nom, mouvements: [] });
      const g = parSociete.get(f.societeId)!;
      g.mouvements.push({ id: `${f.id}-du`, date: f.dateEmission, libelle: `Facture n°${f.numero} — ${f.type}`, montant: Number(f.montantTTC) });
      if (f.statut === "Payee" && f.datePaiement) {
        g.mouvements.push({ id: `${f.id}-cr`, date: f.datePaiement, libelle: `Règlement facture n°${f.numero}`, montant: -Number(f.montantTTC) });
      }
    }
    return [...parSociete.values()]
      .map((g) => ({ societeId: g.societeId, societeNom: g.societeNom, ...lettrerCompte(g.mouvements) }))
      .sort((a, b) => Math.abs(b.soldeNonLettre) - Math.abs(a.soldeNonLettre));
  }

  // ══════════════════════════════════════════════════════════════════
  // Journal & Balance OHADA (2026-09) — voir demande utilisateur : "au
  // Gabon, en matière de comptabilité c'est le SYSCOHADA qui est en
  // vigueur (avec le plan comptable OHADA)." Écriture en partie double à
  // CHAQUE événement (émission, règlement) — voir PLAN_COMPTABLE ci-dessus
  // pour le détail des comptes retenus et leurs réserves.
  // ══════════════════════════════════════════════════════════════════
  async journalOhada() {
    const factures = await this.prisma.factureAbonnement.findMany({
      where: { statut: { not: "Annulee" } },
      select: { numero: true, societe: { select: { nom: true } }, type: true, montantHT: true, montantTva: true, montantTps: true, montantCss: true, montantTTC: true, statut: true, dateEmission: true, datePaiement: true, modePaiement: true },
      orderBy: { numero: "asc" },
    });
    type EcritureLigne = { compte: string; libelleCompte: string; debit: number; credit: number };
    type Ecriture = { date: string; piece: string; libelle: string; lignes: EcritureLigne[] };
    const ecritures: Ecriture[] = [];

    for (const f of factures) {
      const lignes: EcritureLigne[] = [
        { compte: PLAN_COMPTABLE.clients, libelleCompte: `Clients — ${f.societe.nom}`, debit: Number(f.montantTTC), credit: 0 },
      ];
      if (Number(f.montantTps) > 0) lignes.push({ compte: PLAN_COMPTABLE.tps, libelleCompte: "RRR accordés (TPS)", debit: Number(f.montantTps), credit: 0 });
      lignes.push({ compte: PLAN_COMPTABLE.ventes, libelleCompte: "Services vendus", debit: 0, credit: Number(f.montantHT) });
      if (Number(f.montantTva) > 0) lignes.push({ compte: PLAN_COMPTABLE.tva, libelleCompte: "État, TVA facturée", debit: 0, credit: Number(f.montantTva) });
      if (Number(f.montantCss) > 0) lignes.push({ compte: PLAN_COMPTABLE.css, libelleCompte: "État, autres taxes (CSS)", debit: 0, credit: Number(f.montantCss) });
      ecritures.push({ date: f.dateEmission, piece: `FA-${f.numero}`, libelle: `Facture n°${f.numero} — ${f.societe.nom} (${f.type})`, lignes });

      if (f.statut === "Payee" && f.datePaiement) {
        ecritures.push({
          date: f.datePaiement, piece: `RG-${f.numero}`, libelle: `Règlement facture n°${f.numero} — ${f.societe.nom}${f.modePaiement ? ` (${f.modePaiement})` : ""}`,
          lignes: [
            { compte: PLAN_COMPTABLE.banque, libelleCompte: "Banques", debit: Number(f.montantTTC), credit: 0 },
            { compte: PLAN_COMPTABLE.clients, libelleCompte: `Clients — ${f.societe.nom}`, debit: 0, credit: Number(f.montantTTC) },
          ],
        });
      }
    }

    const parseFr = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
    ecritures.sort((a, b) => parseFr(a.date).getTime() - parseFr(b.date).getTime());
    return { plan: PLAN_COMPTABLE, ecritures };
  }

  // Balance générale — solde de chaque compte OHADA mouvementé, dérivée du
  // même journal que journalOhada() (une seule source de vérité).
  async balanceOhada() {
    const { ecritures } = await this.journalOhada();
    const parComptet = new Map<string, { compte: string; libelle: string; debit: number; credit: number }>();
    for (const e of ecritures) {
      for (const l of e.lignes) {
        if (!parComptet.has(l.compte)) parComptet.set(l.compte, { compte: l.compte, libelle: l.libelleCompte, debit: 0, credit: 0 });
        const c = parComptet.get(l.compte)!;
        c.debit += l.debit;
        c.credit += l.credit;
      }
    }
    const comptes = [...parComptet.values()].map((c) => ({ ...c, solde: c.debit - c.credit })).sort((a, b) => a.compte.localeCompare(b.compte));
    return { comptes, totalDebit: comptes.reduce((s, c) => s + c.debit, 0), totalCredit: comptes.reduce((s, c) => s + c.credit, 0) };
  }

  private soldeCompte(comptes: Awaited<ReturnType<FactureAbonnementService["balanceOhada"]>>["comptes"], compte: string): number {
    return comptes.find((c) => c.compte === compte)?.solde ?? 0;
  }

  // Compte de résultat (2026-09) — voir demande utilisateur : "il faut tous
  // les états comptable, bilan, compte de résultat, résultat net de
  // l'exercice." Reflète UNIQUEMENT l'activité de facturation de la
  // plateforme envers ses sociétés clientes (produits) — cette application
  // ne suit AUCUNE charge d'exploitation (salaires, loyers, achats...),
  // donc le "résultat net" ci-dessous est un chiffre d'affaires net, pas un
  // résultat d'entreprise complet ; le libellé et la note l'indiquent
  // explicitement pour ne jamais laisser croire à un état exhaustif.
  async compteDeResultat() {
    const { comptes } = await this.balanceOhada();
    // 706 est crédité (produit) → solde négatif ; on l'exprime en positif
    // pour la lecture. 709 (TPS) est débité → réduit le produit net.
    const chiffreAffairesBrut = -this.soldeCompte(comptes, PLAN_COMPTABLE.ventes);
    const rrrAccordes = this.soldeCompte(comptes, PLAN_COMPTABLE.tps);
    const chiffreAffairesNet = chiffreAffairesBrut - rrrAccordes;
    const chargesExploitation = 0; // non suivies dans cette application
    const resultatNet = chiffreAffairesNet - chargesExploitation;
    return {
      produits: [{ compte: PLAN_COMPTABLE.ventes, libelle: "Services vendus (706)", montant: chiffreAffairesBrut }],
      reductionsProduits: [{ compte: PLAN_COMPTABLE.tps, libelle: "RRR accordés — TPS (709)", montant: rrrAccordes }],
      chiffreAffairesNet,
      charges: [],
      chargesExploitation,
      resultatNet,
    };
  }

  // Bilan (2026-09) — voir demande utilisateur : "il faut tous les états
  // comptable, bilan..." ACTIF = créances clients (411, ce qui reste dû)
  // + trésorerie (512, encaissements reçus). PASSIF = dettes fiscales
  // (TVA 4434 + CSS 4457, dues à l'État, jamais suivies comme remises dans
  // cette application) + le résultat de l'exercice en capitaux propres —
  // équilibre garanti PAR CONSTRUCTION (chaque écriture du journal est déjà
  // en partie double, voir journalOhada). Même réserve que compteDeResultat
  // : reflète uniquement l'activité de facturation, pas un bilan
  // d'entreprise complet (aucun actif immobilisé, aucune dette fournisseur
  // suivie ici).
  async bilan() {
    const { comptes } = await this.balanceOhada();
    const { resultatNet } = await this.compteDeResultat();
    const creancesClients = this.soldeCompte(comptes, PLAN_COMPTABLE.clients);
    const tresorerie = this.soldeCompte(comptes, PLAN_COMPTABLE.banque);
    const totalActif = creancesClients + tresorerie;
    const dettesTva = -this.soldeCompte(comptes, PLAN_COMPTABLE.tva);
    const dettesCss = -this.soldeCompte(comptes, PLAN_COMPTABLE.css);
    const totalPassif = dettesTva + dettesCss + resultatNet;
    return {
      actif: [
        { compte: PLAN_COMPTABLE.clients, libelle: "Clients (411)", montant: creancesClients },
        { compte: PLAN_COMPTABLE.banque, libelle: "Banques (512)", montant: tresorerie },
      ],
      totalActif,
      passif: [
        { compte: PLAN_COMPTABLE.tva, libelle: "État, TVA facturée (4434)", montant: dettesTva },
        { compte: PLAN_COMPTABLE.css, libelle: "État, autres taxes — CSS (4457)", montant: dettesCss },
        { compte: "110", libelle: "Résultat de l'exercice", montant: resultatNet },
      ],
      totalPassif,
      equilibre: Math.round(totalActif) === Math.round(totalPassif),
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // Document PDF (2026-09) — voir demande utilisateur : "l'application
  // doit générer une facture conforme aux normes comptables et de
  // facturation." Émetteur = identité plateforme MedAssur (voir
  // ParametresEntreprise id="default", antérieure au multi-tenant —
  // c'est la seule identité "hors société" disponible, cohérente avec le
  // Super Admin qui n'appartient lui-même à aucune société). Numéro,
  // dates, lignes, sous-total HT, chaque taxe activée détaillée (taux +
  // montant), total TTC, mention de règlement — les éléments standards
  // d'une facture commerciale.
  // ══════════════════════════════════════════════════════════════════
  async genererPdf(id: string, res: Response): Promise<void> {
    const facture = await this.findOne(id);
    const emetteur = await this.prisma.parametresEntreprise.findUnique({ where: { id: "default" } });
    const nomEmetteur = emetteur?.nom ?? "MedAssur";
    const couleur = emetteur?.couleurPrimaire ?? "#0f4c81";
    // Intl "fr-FR" sépare les milliers par une espace fine insécable
    // (U+202F), absente de la police Helvetica standard de pdfkit — elle
    // s'affiche comme un caractère cassé. Remplacée par une espace normale,
    // rendue correctement par toute police PDF standard.
    const fmtFcfa = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n).replace(/ /g, " ")} FCFA`;

    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Facture ${facture.numero}` } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="facture-${facture.numero}.pdf"`);
      doc.pipe(res);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      // ── En-tête émetteur / titre ──────────────────────────────────
      doc.fontSize(15).font("Helvetica-Bold").fillColor(couleur).text(nomEmetteur, left, 40);
      doc.fontSize(9).font("Helvetica").fillColor("#555");
      const ligneEmetteur = [emetteur?.sousTitre, emetteur?.adresse, [emetteur?.boitePostale, emetteur?.ville].filter(Boolean).join(" — "), emetteur?.pays]
        .filter(Boolean).join("\n");
      doc.text(ligneEmetteur, left, 60, { width: 260 });
      const contactEmetteur = [emetteur?.telephone, emetteur?.email, emetteur?.siteWeb].filter(Boolean).join("  ·  ");
      if (contactEmetteur) doc.fontSize(8).fillColor("#888").text(contactEmetteur, left, doc.y + 2, { width: 260 });

      doc.fontSize(18).font("Helvetica-Bold").fillColor("#000").text("FACTURE", right - 200, 40, { width: 200, align: "right" });
      doc.fontSize(10).font("Helvetica-Bold").fillColor(couleur).text(`N° ${facture.numero}`, right - 200, 64, { width: 200, align: "right" });
      doc.fontSize(8.5).font("Helvetica").fillColor("#333");
      doc.text(`Date d'émission : ${facture.dateEmission}`, right - 200, 82, { width: 200, align: "right" });
      doc.text(`Date d'échéance : ${facture.dateEcheance}`, right - 200, 94, { width: 200, align: "right" });
      const libelleStatut = facture.statut === "Payee" ? "PAYÉE" : facture.statut === "Annulee" ? "ANNULÉE" : "EN ATTENTE DE PAIEMENT";
      const couleurStatut = facture.statut === "Payee" ? "#1f9d55" : facture.statut === "Annulee" ? "#999" : "#d97706";
      doc.fontSize(9).font("Helvetica-Bold").fillColor(couleurStatut).text(libelleStatut, right - 200, 108, { width: 200, align: "right" });

      let y = 140;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
      y += 12;

      // ── Destinataire ───────────────────────────────────────────────
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#888").text("FACTURÉ À", left, y);
      y += 12;
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text(facture.societe.nom, left, y);
      y += 16;
      doc.fontSize(9).font("Helvetica").fillColor("#333");
      if (facture.type) { doc.text(`Objet : ${facture.type}${facture.periodeDebut ? ` — période du ${facture.periodeDebut} au ${facture.periodeFin}` : ""}`, left, y); y += 12; }
      y += 8;

      // ── Table des lignes ──────────────────────────────────────────
      const colonnes = [
        { label: "Désignation", width: width - 60 - 90 - 100 },
        { label: "Qté", width: 60, align: "right" as const },
        { label: "P.U.", width: 90, align: "right" as const },
        { label: "Montant", width: 100, align: "right" as const },
      ];
      const dessinerEntete = (yy: number) => {
        doc.rect(left, yy, width, 18).fill(couleur);
        doc.fillColor("#fff").fontSize(8.5).font("Helvetica-Bold");
        let x = left;
        for (const c of colonnes) { doc.text(c.label, x + 4, yy + 5, { width: c.width - 8, align: c.align }); x += c.width; }
        doc.fillColor("#000");
        return yy + 18;
      };
      y = dessinerEntete(y);
      doc.font("Helvetica").fontSize(9);
      for (const l of facture.lignes) {
        const valeurs = [l.designation, String(l.quantite), fmtFcfa(Number(l.prixUnitaire)), fmtFcfa(Number(l.montant))];
        const hauteur = Math.max(16, doc.heightOfString(l.designation, { width: colonnes[0].width - 8 }) + 6);
        if (y + hauteur > doc.page.height - doc.page.margins.bottom - 140) { doc.addPage(); y = 40; y = dessinerEntete(y); doc.font("Helvetica").fontSize(9); }
        let x = left;
        for (let i = 0; i < colonnes.length; i++) {
          doc.fillColor("#000").text(valeurs[i], x + 4, y + 4, { width: colonnes[i].width - 8, align: colonnes[i].align });
          x += colonnes[i].width;
        }
        y += hauteur;
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#eee").stroke();
      }
      y += 10;

      // ── Totaux ───────────────────────────────────────────────────
      const totalX = right - 220;
      const ligneTotal = (label: string, valeur: string, gras = false) => {
        doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(gras ? 10.5 : 9).fillColor("#000");
        doc.text(label, totalX, y, { width: 120 });
        doc.text(valeur, totalX + 120, y, { width: 100, align: "right" });
        y += gras ? 18 : 14;
      };
      ligneTotal("Total HT", fmtFcfa(Number(facture.montantHT)));
      if (facture.tauxTva != null) ligneTotal(`TVA (${facture.tauxTva}%)`, fmtFcfa(Number(facture.montantTva)));
      // TPS soustractive (2026-09) — voir demande utilisateur : "la TPS
      // n'est pas additive, mais soustractive." Affichée avec un signe
      // moins pour rester lisible sur le récapitulatif.
      if (facture.tauxTps != null) ligneTotal(`TPS (${facture.tauxTps}%)`, `- ${fmtFcfa(Number(facture.montantTps))}`);
      if (facture.tauxCss != null) ligneTotal(`CSS (${facture.tauxCss}%)`, fmtFcfa(Number(facture.montantCss)));
      doc.moveTo(totalX, y).lineTo(right, y).strokeColor("#000").stroke();
      y += 6;
      ligneTotal("TOTAL TTC", fmtFcfa(Number(facture.montantTTC)), true);

      // ── Mention de règlement ─────────────────────────────────────
      y += 10;
      if (facture.statut === "Payee") {
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1f9d55")
          .text(`Réglée le ${facture.datePaiement} — ${facture.modePaiement ?? ""}${facture.referencePaiement ? ` (réf. ${facture.referencePaiement})` : ""}`, left, y, { width });
      } else if (facture.statut === "Emise") {
        doc.fontSize(9).font("Helvetica").fillColor("#555").text(`Montant à régler avant le ${facture.dateEcheance}.`, left, y, { width });
      }
      if (facture.note) { y = doc.y + 8; doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#666").text(facture.note, left, y, { width }); }

      // ── Pied de page légal ───────────────────────────────────────
      const pied = [nomEmetteur, emetteur?.ville, emetteur?.pays, emetteur?.telephone, emetteur?.email].filter(Boolean).join("  ·  ");
      doc.fontSize(7.5).font("Helvetica").fillColor("#999").text(pied, left, doc.page.height - 50, { width, align: "center" });

      doc.end();
      doc.on("end", () => resolve());
    });
  }
}
