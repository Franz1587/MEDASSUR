// Sociétés d'assurance (2026-09) — Super Admin, Phase 1 du chantier
// multi-tenant. Voir backend/prisma/schema.prisma SocieteAssurance.

export const CYCLES_FACTURATION = ["Mensuel", "Trimestriel", "Semestriel", "Annuel"] as const;
export type CycleFacturation = (typeof CYCLES_FACTURATION)[number];

// Type de société (2026-09) — voir demande utilisateur : "il faut pouvoir
// dire le type de société qui va utiliser l'application : un courtier...
// une mutuelle... une compagnie d'assurance." Voir backend/prisma/
// schema.prisma SocieteAssurance.type/compagnieInterneId.
export const TYPES_SOCIETE = ["Courtier", "Mutuelle", "Compagnie"] as const;
export type TypeSociete = (typeof TYPES_SOCIETE)[number];

export interface Societe {
  id: string;
  nom: string;
  email?: string | null;
  telephone?: string | null;
  ville?: string | null;
  pays: string;
  statut: "Actif" | "Suspendu";
  motifSuspension?: string | null;
  createdAt: string;
  type: TypeSociete;
  compagnieInterneId?: string | null;
  // Abonnement (2026-09) — voir demande utilisateur : "il revient au super
  // Admin de donner accès à ces modules là en fonction du type
  // d'abonnement souscrit". `modules` reste la source d'autorité réelle
  // (plafonne ce que les administrateurs de cette société peuvent accorder
  // à leurs propres utilisateurs) ; planAbonnement n'est qu'une étiquette
  // de départ, librement personnalisable ensuite (voir PlanAbonnement).
  planAbonnementId?: string | null;
  planAbonnement?: { id: string; nom: string; prixMensuel?: number | null } | null;
  modules: string[];
  // Facturation (2026-09) — voir demande utilisateur : "gérer... le
  // paiement de licence d'utilisation par mois, trimestre, semestre,
  // années (selon le mode de souscription)".
  cycleFacturation: CycleFacturation;
  prixAbonnement?: number | null;
  fraisInstallation?: number | null;
  _count: { users: number };
}

export interface SocieteDetail extends Societe {
  users: { id: string; nom: string; email: string; roleId: string; createdAt: string }[];
}

export interface CreerSocieteInput {
  nom: string;
  email?: string;
  telephone?: string;
  ville?: string;
  pays?: string;
  type?: TypeSociete;
  // Identité (2026-09) — voir demande utilisateur : "dans le formulaire de
  // création... on doit pouvoir mettre le logo/le modèle de carte/le
  // préfixe matricule." Le logo, lui, s'envoie séparément (fichier) une
  // fois la société créée — voir uploadLogoSociete.
  modeleCarteId?: string;
  prefixeMatricule?: string;
  adminNom: string;
  adminEmail: string;
  planAbonnementId?: string;
  modules?: string[];
  cycleFacturation?: CycleFacturation;
  prixAbonnement?: number;
  fraisInstallation?: number;
}

export interface CreerSocieteResultat {
  societe: SocieteDetail;
  admin: { id: string; nom: string; email: string; roleId: string };
  motDePasseInitial: string;
  // Envoi réel des identifiants par SMS/WhatsApp (2026-09) — voir
  // SocietesService.create ; false si aucun numéro exploitable n'a été
  // renseigné pour la société (relais manuel alors nécessaire).
  smsEnvoye: boolean;
}

export interface ModifierSocieteInput {
  nom?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  pays?: string;
  planAbonnementId?: string | null;
  modules?: string[];
  cycleFacturation?: CycleFacturation;
  prixAbonnement?: number;
  fraisInstallation?: number;
}

// Plan d'abonnement (2026-09) — catalogue géré par le Super Admin (voir
// backend/src/societes/plans-abonnement.service.ts).
export interface PlanAbonnement {
  id: string;
  nom: string;
  modules: string[];
  ordre: number;
  prixMensuel?: number | null;
  createdAt: string;
  _count?: { societes: number };
}

export interface CreerPlanAbonnementInput {
  nom: string;
  modules: string[];
  ordre?: number;
  prixMensuel?: number;
}

export interface ModifierPlanAbonnementInput {
  nom?: string;
  modules?: string[];
  ordre?: number;
  prixMensuel?: number;
}

// Abonnement de la société courante (2026-09) — voir GET /abonnement/moi,
// consultée par un compte NON super_admin pour savoir quels modules son
// administrateur peut lui accorder (voir src/features/admin/index.tsx).
export interface MonAbonnement {
  societeId: string | null;
  societeNom: string | null;
  planNom: string | null;
  modules: string[];
  // Type de société (2026-09) — voir TypeSociete ci-dessus. Consultée par
  // le formulaire Contrat pour savoir s'il doit masquer le sélecteur
  // Compagnie (voir compagnieInterneId).
  type: TypeSociete | null;
  compagnieInterneId: string | null;
}

// Assistance (2026-09) — voir demande utilisateur : "le Super Admin doit
// pouvoir accéder dans chaque interface dédiée aux société en mode
// assistance". Réponse au même format qu'une connexion normale (voir
// AuthContext.login) — juste marquée par l'appelant comme une session
// d'assistance (voir AuthContext.startAssistance).
export interface AssistanceResultat {
  accessToken: string;
  user: {
    id: string; nom: string; email: string; roleId: string; initiales: string; modules: string[];
    clientId?: string | null; assureSanteId?: string | null; prestataireId?: string | null; medecinId?: string | null; societeId?: string | null;
  };
  societeNom: string;
}

// Facturation plateforme (2026-09) — voir demande utilisateur : "revoir le
// formulaire de facturation... un vrai formulaire dédié... TVA (18%), TPS
// (9.5%), CSS (1%)... plusieurs lignes." Sans rapport avec le modèle
// métier `Facture` (santé) des sociétés elles-mêmes.
export interface LigneFactureAbonnement {
  id: string;
  rubriqueCode?: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  ordre: number;
}

export interface FactureAbonnement {
  id: string;
  numero: number;
  societeId: string;
  societe: { id: string; nom: string };
  type: "Installation" | "Abonnement" | "Cartes" | "Autre";
  periodeDebut?: string | null;
  periodeFin?: string | null;
  montantHT: number;
  tauxTva?: number | null;
  montantTva: number;
  tauxTps?: number | null;
  montantTps: number;
  tauxCss?: number | null;
  montantCss: number;
  montantTTC: number;
  statut: "Emise" | "Payee" | "Annulee";
  dateEmission: string;
  dateEcheance: string;
  datePaiement?: string | null;
  modePaiement?: string | null;
  referencePaiement?: string | null;
  note?: string | null;
  createdAt: string;
  lignes: LigneFactureAbonnement[];
}

export interface LigneFactureInput {
  rubriqueCode?: string;
  designation: string;
  quantite?: number;
  prixUnitaire: number;
}

// Rubriques de facturation (2026-09) — voir demande utilisateur : "le type
// de facture n'est pas les rubriques de facture. les rubriques font
// référence aux différentes lignes de facturation (installation, licence,
// carte, récupération de données...)." Catalogue géré par le Super Admin,
// utilisé pour pré-remplir une ligne de facture.
export interface RubriqueFacturation {
  code: string;
  libelle: string;
  prixDefaut?: number | null;
  ordre: number;
  actif: boolean;
  createdAt: string;
}

export interface CreerRubriqueFacturationInput {
  code: string;
  libelle: string;
  prixDefaut?: number;
  ordre?: number;
}

export interface ModifierRubriqueFacturationInput {
  libelle?: string;
  prixDefaut?: number;
  ordre?: number;
  actif?: boolean;
}

// Taux légaux gabonais par défaut (2026-09) — voir demande utilisateur :
// "TVA (18%), TPS (9.5%), CSS (1%)". Simple suggestion de départ affichée
// dans le formulaire ; chaque taxe reste activable/désactivable et son
// taux ajustable facture par facture.
export const TAUX_LEGAUX = { tva: 18, tps: 9.5, css: 1 };

export interface GenererFactureAbonnementInput {
  type?: "Installation" | "Abonnement" | "Cartes" | "Autre";
  lignes?: LigneFactureInput[];
  // Type "Cartes" uniquement — voir demande utilisateur : "on facture la
  // carte par assuré et ayant droit." Omis = population active actuelle
  // de la société.
  nombrePersonnes?: number;
  periodeDebut?: string;
  periodeFin?: string;
  dateEcheance?: string;
  note?: string;
  appliquerTva?: boolean;
  tauxTva?: number;
  appliquerTps?: boolean;
  tauxTps?: number;
  appliquerCss?: boolean;
  tauxCss?: number;
}

export interface PayerFactureAbonnementInput {
  modePaiement: string;
  referencePaiement?: string;
  datePaiement?: string;
}

export interface ResumeFacturation {
  totalFacture: number;
  totalEncaisse: number;
  totalImpaye: number;
  totalEnRetard: number;
  totalTvaCollectee: number;
  totalTpsCollectee: number;
  totalCssCollectee: number;
  parSociete: { societeId: string; nom: string; facture: number; encaisse: number; impaye: number }[];
  tendanceMensuelle: { mois: string; montant: number }[];
}

// États comptables (2026-09) — voir demande utilisateur : "un module
// complet de comptabilité avec tous les états."
export interface LigneBalanceAgee {
  id: string;
  numero: number;
  societeId: string;
  societeNom: string;
  montant: number;
  dateEmission: string;
  dateEcheance: string;
  joursRetard: number;
  tranche: string;
}

export interface BalanceAgee {
  lignes: LigneBalanceAgee[];
  parTranche: { tranche: string; montant: number }[];
}

export interface LigneEtatTaxes {
  numero: number;
  societeNom: string;
  date?: string | null;
  statut: "Emise" | "Payee" | "Annulee";
  montantHT: number;
  tauxTva?: number | null;
  montantTva: number;
  tauxTps?: number | null;
  montantTps: number;
  tauxCss?: number | null;
  montantCss: number;
  montantTTC: number;
}

// État des taxes (2026-09) — voir demande utilisateur : "au Gabon... c'est
// le SYSCOHADA qui est en vigueur" (comptabilité d'engagement) : "facture"
// (toutes les factures émises non annulées, sur dateEmission) et "encaisse"
// (factures réglées uniquement, sur datePaiement) sont deux totaux
// distincts — une facture émise mais impayée apparaît déjà côté "facture".
export interface EtatTaxesSection {
  lignes: LigneEtatTaxes[];
  totaux: { montantHT: number; montantTva: number; montantTps: number; montantCss: number; montantTTC: number };
}

export interface EtatTaxes {
  compteTva: string;
  compteCss: string;
  compteTps: string;
  facture: EtatTaxesSection;
  encaisse: EtatTaxesSection;
}

export interface MouvementGrandLivre {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface GrandLivre {
  compte: string;
  mouvements: MouvementGrandLivre[];
  soldeFinal: number;
}

// États SYSCOHADA (2026-09) — voir demande utilisateur : "au Gabon, en
// matière de comptabilité c'est le SYSCOHADA qui est en vigueur (avec le
// plan comptable OHADA)... il faut tous les états comptable, bilan, compte
// de résultat, résultat net de l'exercice." Reflète uniquement l'activité
// de facturation de la plateforme (produits) — aucune charge d'exploitation
// n'est suivie dans cette application.
export interface PlanComptable {
  clients: string; ventes: string; tva: string; css: string; tps: string; banque: string;
}

export interface EcritureLigne {
  compte: string;
  libelleCompte: string;
  debit: number;
  credit: number;
}

export interface EcritureJournal {
  date: string;
  piece: string;
  libelle: string;
  lignes: EcritureLigne[];
}

export interface JournalOhada {
  plan: PlanComptable;
  ecritures: EcritureJournal[];
}

export interface CompteBalance {
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface BalanceOhada {
  comptes: CompteBalance[];
  totalDebit: number;
  totalCredit: number;
}

export interface LignePoste {
  compte: string;
  libelle: string;
  montant: number;
}

export interface CompteDeResultat {
  produits: LignePoste[];
  reductionsProduits: LignePoste[];
  chiffreAffairesNet: number;
  charges: LignePoste[];
  chargesExploitation: number;
  resultatNet: number;
}

export interface Bilan {
  actif: LignePoste[];
  totalActif: number;
  passif: LignePoste[];
  totalPassif: number;
  equilibre: boolean;
}

// Lettrage du compte 411 (2026-09) — voir demande utilisateur : "il faut
// que l'outil IA puisse également faire un vrai lettrage de compte" +
// "les informations doivent être uniques" (même moteur que backend/src/
// lettrage/lettrage.util.ts, réutilisé partout où un compte est lettré).
export interface MouvementLettrage {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  lettre: string | null;
}

export interface LettrageSociete {
  societeId: string;
  societeNom: string;
  mouvements: MouvementLettrage[];
  soldeNonLettre: number;
  lettrageComplet: boolean;
}

// Tarification par module + taux de change (2026-09) — voir demande
// utilisateur : "évaluer un coût pour chaque fonctionnalité (rendre
// paramétrable)... faire une correspondance en euro/dollars et convertir
// en FCFA (XAF)."
export const DEVISES = ["EUR", "USD"] as const;
export type Devise = (typeof DEVISES)[number];

export interface ModulePrix {
  module: string;
  prix: number;
  devise: Devise;
  updatedAt: string;
}

export interface TauxChange {
  devise: Devise;
  tauxVersXaf: number;
  updatedAt: string;
}

// Performance / usage (2026-09) — voir demande utilisateur : "un écran lui
// permettant de voir les performances d'utilisation de l'application."
export interface PerformanceGlobale {
  totalSocietes: number;
  societesActives: number;
  totalUtilisateurs: number;
  utilisateursActifs30j: number;
  totalContrats: number;
  totalAssures: number;
  totalFactures: number;
  operations30j: number;
}

export interface PerformanceSociete {
  societeId: string;
  nom: string;
  statut: "Actif" | "Suspendu";
  createdAt: string;
  totalUtilisateurs: number;
  utilisateursActifs30j: number;
  derniereActivite?: string | null;
  volumeDonnees: { contrats: number; assures: number; factures: number; prisesEnCharge: number; clients: number; prestataires: number };
  operations30j: number;
}

// Utilisateur géré par le Super Admin pour une société précise (2026-09) —
// voir demande utilisateur : "il doit pouvoir créer et gérer des
// utilisateurs pour chaque société et affecter."
export interface SocieteUser {
  id: string;
  roleId: string;
  nom: string;
  email: string;
  initiales: string;
  modules: string[];
  createdAt: string;
  telephone?: string | null;
  adresse?: string | null;
  photo?: string | null;
  derniereConnexion?: string | null;
}

export interface CreerSocieteUserInput {
  nom: string;
  email: string;
  initiales: string;
  roleId: string;
  modules?: string[];
  telephone?: string;
  adresse?: string;
}

// Tarification par personne assurée (2026-09) — voir demande utilisateur :
// "en plus de la tarification liée aux fonctionnalités, il y a la licence
// annuelle par assuré. C'est un montant minimum de 5000 pour assuré y
// compris les ayants droit... on facture la carte par assuré et ayant
// droit. Le montant par défaut est 2500 par personne. Mais il faut laisser
// le montant paramétrable."
export const LICENCE_ANNUELLE_MINIMUM = 5000;

export interface ParametresFacturationPlateforme {
  id: string;
  licenceAnnuellePersonne: number;
  carteParPersonne: number;
  updatedAt: string;
}

export interface UpdateParametresFacturationInput {
  licenceAnnuellePersonne?: number;
  carteParPersonne?: number;
}
