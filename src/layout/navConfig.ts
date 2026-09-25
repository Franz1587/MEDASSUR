import {
  LayoutDashboard, Users, Building2, FileText, Target, RefreshCw, Edit,
  XCircle, Stethoscope, AlertTriangle, BookOpen, DollarSign,
  CreditCard, Wallet, Archive, Brain, BarChart3, Settings, FileSearch, Calculator,
  ClipboardCheck, ShieldAlert, HandCoins, UserCheck, ShieldCheck, IdCard, Palette, UserCog,
  ClipboardList, Receipt, Landmark, Hash, History, Gauge, FileSpreadsheet, Mail, PieChart,
  ScrollText, MapPinned, KeyRound, TrendingUp, Coins, Home, Users2, Briefcase, MessageCircle, Syringe,
  ListOrdered, FolderClock, Send, Banknote, UploadCloud, Layers, Sparkles,
} from "lucide-react";

export type View =
  | "dashboard" | "sante" | "crm" | "clients" | "compagnies" | "autoGestion"
  | "contrats" | "renouvellements" | "avenants"
  | "resiliations" | "sinistres" | "participants"
  | "prisesEnCharge" | "accordPrealable" | "fraude"
  | "prestataires" | "reglementPrestataire" | "etatTps" | "reglementComptable"
  | "comptabilite" | "commissions" | "recouvrement"
  | "tresorerie" | "ged" | "ia" | "rapports" | "admin"
  | "appelOffres" | "cotation"
  | "fondsDeRoulement" | "honoraires" | "garantiesCatalogue" | "cartesAssurance"
  | "actesMedicaux" | "lettresCles"
  | "journalOperations" | "suiviAgents"
  | "factureProduction"
  | "courrierMaladie" | "modelesCourrier"
  | "statistiques"
  | "parametresEntreprise"
  // Règles & Consignes (2026-08) — mises en place ici (zone "Système"),
  // diffusées en lecture seule au portail client (voir portailReglesConsignes).
  | "reglesConsignes"
  // Banques (2026-08) — voir demande utilisateur : "nouvel onglet appelé
  // Banques [dans Système]... toutes les banques créées dans le système...
  // historique des mouvements... en fonction des paiements des sinistres."
  | "banques"
  // Agences (2026-09) — voir demande utilisateur : "lier un agent de saisie
  // à une agence du client (compagnie, courtier, mutuelle) afin que ce
  // soit cette agence qui remonte sur le décompte."
  | "agences"
  // Import de données (2026-08) — voir demande utilisateur : "pour
  // permettre aux sociétés d'assurance qui voudraient changer de logiciel
  // mais commencer à utiliser MedAssur... onglet import [dans Système]...
  // factures saisies, règlements, photos, prises en charge."
  | "importDonnees"
  // Bordereaux (2026-08) — voir demande utilisateur : "3 nouveaux états, le
  // bordereau sinistres, le bordereau de production... et le bordereau
  // d'encaissement de prime". Encaissement suit (nécessite un nouveau
  // suivi des paiements, inexistant aujourd'hui).
  | "bordereauSinistres" | "bordereauProduction" | "bordereauEncaissement"
  // Portail client (2026-08) — écrans dédiés et cloisonnés au Client
  // rattaché (User.clientId), rendus par PortalShell, distincts des vues
  // internes ci-dessus (voir demande utilisateur : portail de suivi pour
  // les souscripteurs, données uniquement les leurs). "portailStatistiques"
  // reste TOUJOURS la dernière rubrique du menu (voir demande utilisateur) —
  // tout nouvel écran portail s'insère avant elle dans les tableaux
  // allowedModules de roles.ts / role-modules.ts, jamais après.
  | "portailDashboard" | "portailContrats" | "portailParticipants" | "portailDemandes"
  | "portailReseauSoins" | "portailReglesConsignes" | "portailUtilisateurs" | "portailStatistiques"
  // Écran interne de traitement des demandes client (incorporation/retrait).
  | "demandesClient"
  // Professionnel de santé (2026-08) — voir demande utilisateur : "créer un
  // onglet professionnel de santé [rubrique Système]... créer des
  // médecins, puis les lier à une clinique, hôpital". Distinct de
  // "prestataires" (les structures) — un Medecin est une personne.
  | "professionnelsSante"
  // Messagerie (2026-08) — voir demande utilisateur : "il faut créer pour
  // tous les acteurs ou utilisateur un onglet de Messagerie" — UNE seule
  // clé partagée par tous les rôles (internes ET tous les portails), le
  // composant Messagerie.tsx adapte son comportement selon currentUser
  // plutôt que d'avoir une clé dupliquée par portail.
  | "messagerie"
  // Rapports IA (2026-09) — voir demande utilisateur : "il faut aussi que
  // Ariana fasse un rapport lorsqu'elle a pu gérer une demande et que
  // l'assuré repart satisfait." Supervision interne uniquement (jamais un
  // portail externe) — voir backend/src/auth/role-modules.ts.
  | "rapportsIa"
  // Communications externes (2026-08) — voir demande utilisateur :
  // "l'application doit pouvoir rendre possible l'envoi des mails, sms et
  // whatsapp. et recevoir des retours sous forme de notification et
  // message interne" — journal d'envois simulés (voir Communication,
  // CommunicationsService), distinct de "messagerie" (discussion interne
  // temps réel).
  | "communications"
  // Portail assuré (2026-08) — écran externe dédié à l'assuré principal
  // (User.assureSanteId), rendu par PortalShell (même sidebar que le
  // portail client, voir demande utilisateur), distinct du portail client
  // ci-dessus (souscripteur). membreDashboard reste TOUJOURS en premier.
  | "membreDashboard" | "membreCarte" | "membreGaranties" | "membrePriseEnCharge"
  | "membreRemboursement" | "membreReseauSoins" | "membreCarnetSante" | "membreHistorique" | "membreFamille"
  | "membreDelegations"
  // Portail prestataire (2026-08) — écran externe dédié au prestataire
  // médical (User.prestataireId), modelé sur des captures de référence (voir
  // demande utilisateur : captures fournies à dupliquer). prestataireDashboard reste
  // TOUJOURS en premier. Contacts/Devis/Finance/Logistique sont des sections
  // de la maquette de référence non encore développées (voir demande
  // utilisateur : "on va faire des ajustements progressivement") — écrans
  // vitrine "Bientôt disponible" pour l'instant, la structure de nav est déjà
  // fidèle au modèle.
  | "prestataireDashboard" | "prestatairePatients" | "prestatairePrestations"
  | "prestataireContacts" | "prestataireDevis" | "prestataireFinance" | "prestataireLogistique"
  // Traitement de bons (2026-08) — écran prestataire_sante, s'auto-gère
  // selon `getMoiPrestataire().type` (voir TraiterBon.tsx).
  | "prestataireMedecinPrescripteur" | "prestataireTraiterBon"
  // Portail médecin (2026-08) — voir demande utilisateur : "le médecin
  // doit avoir ses accès différents de ceux de la clinique ou l'hôpital...
  // il doit voir la liste des assurés qu'il doit recevoir (une file
  // d'attente)". "prestataireMedecinPrescripteur" ci-dessus est désormais
  // exclusif à ce rôle (retiré de prestataire_sante, voir src/auth/roles.ts).
  | "medecinFileAttente"
  // Dossiers patients / historique / dashboard médecin (2026-08) — voir
  // demande utilisateur : "le médecin doit avoir le dossier médical de
  // chaque patient qu'il aurait reçu... classé par date, par an... un
  // onglet Historique des prestations... un tableau de bord avec des
  // statistiques". medecinDashboard reste TOUJOURS en premier (page
  // d'accueil, voir src/auth/roles.ts).
  | "medecinDashboard" | "medecinDossiersPatients" | "medecinHistoriquePrestations"
  // Portail Super Admin (2026-09) — voir demande utilisateur : "créer un
  // compte, et un interface pour le super Admin... c'est lui qui crée les
  // sociétés d'assurances qui vont utiliser l'application comme outil
  // métier". Phase 1 d'un chantier multi-tenant en plusieurs phases (voir
  // SocieteAssurance, backend/prisma/schema.prisma) : gestion des sociétés
  // + provisioning de leur premier compte administrateur.
  // superAdminDashboard reste TOUJOURS en premier.
  // Plans d'abonnement (2026-09) — voir demande utilisateur : "il revient
  // au super Admin de donner accès à ces modules là en fonction du type
  // d'abonnement souscrit" — catalogue de plans distinct de la gestion des
  // sociétés elle-même (voir superAdminSocietes).
  // Comptabilité/Facturation + Performance (2026-09) — voir demande
  // utilisateur : "il doit avoir son écran de comptabilité complète...
  // un écran lui permettant de voir les performances d'utilisation... un
  // écran de facturation."
  | "superAdminDashboard" | "superAdminSocietes" | "superAdminPlans"
  | "superAdminFacturation" | "superAdminPerformance" | "superAdminTarification" | "superAdminModelesCarte"
  | "superAdminUtilisateurs";

/** Full icon coverage for every `View`, used by the app's one shell
 * (AdminShell) and by the external portal headers. */
export const viewIcons: Record<View, React.ElementType> = {
  dashboard: LayoutDashboard,
  sante: Stethoscope,
  crm: Target,
  clients: Users,
  compagnies: Building2,
  autoGestion: UserCog,
  appelOffres: FileSearch,
  cotation: Calculator,
  contrats: FileText,
  renouvellements: RefreshCw,
  avenants: Edit,
  resiliations: XCircle,
  sinistres: AlertTriangle,
  participants: UserCheck,
  prisesEnCharge: ClipboardCheck,
  accordPrealable: ClipboardCheck,
  fraude: ShieldAlert,
  prestataires: Stethoscope,
  reglementPrestataire: HandCoins,
  etatTps: Receipt,
  reglementComptable: Landmark,
  comptabilite: BookOpen,
  commissions: DollarSign,
  recouvrement: CreditCard,
  tresorerie: Wallet,
  fondsDeRoulement: Wallet,
  honoraires: DollarSign,
  ged: Archive,
  ia: Brain,
  rapports: BarChart3,
  admin: Settings,
  garantiesCatalogue: ShieldCheck,
  cartesAssurance: IdCard,
  actesMedicaux: ClipboardList,
  lettresCles: Hash,
  journalOperations: History,
  suiviAgents: Gauge,
  factureProduction: FileSpreadsheet,
  courrierMaladie: Mail,
  modelesCourrier: FileText,
  statistiques: PieChart,
  parametresEntreprise: Palette,
  reglesConsignes: ScrollText,
  banques: Banknote,
  agences: Building2,
  importDonnees: UploadCloud,
  bordereauSinistres: AlertTriangle,
  bordereauProduction: TrendingUp,
  bordereauEncaissement: Coins,
  portailDashboard: LayoutDashboard,
  portailContrats: FileText,
  portailParticipants: UserCheck,
  portailDemandes: Edit,
  portailReseauSoins: MapPinned,
  portailReglesConsignes: ScrollText,
  portailUtilisateurs: KeyRound,
  portailStatistiques: PieChart,
  demandesClient: UserCog,
  professionnelsSante: Syringe,
  messagerie: MessageCircle,
  rapportsIa: Sparkles,
  communications: Send,
  membreDashboard: Home,
  membreCarte: IdCard,
  membreGaranties: ShieldCheck,
  membrePriseEnCharge: ClipboardCheck,
  membreRemboursement: Receipt,
  membreReseauSoins: MapPinned,
  membreCarnetSante: BookOpen,
  membreHistorique: History,
  membreFamille: Users2,
  membreDelegations: KeyRound,
  prestataireDashboard: Home,
  prestatairePatients: Users2,
  prestatairePrestations: Building2,
  prestataireContacts: Landmark,
  prestataireDevis: FileText,
  prestataireFinance: BookOpen,
  prestataireLogistique: Briefcase,
  prestataireMedecinPrescripteur: Stethoscope,
  prestataireTraiterBon: ClipboardCheck,
  medecinFileAttente: ListOrdered,
  medecinDashboard: Home,
  medecinDossiersPatients: FolderClock,
  medecinHistoriquePrestations: History,
  superAdminDashboard: Home,
  superAdminSocietes: Building2,
  superAdminPlans: Layers,
  superAdminFacturation: Receipt,
  superAdminPerformance: Gauge,
  superAdminTarification: Coins,
  superAdminModelesCarte: IdCard,
  superAdminUtilisateurs: Users,
};

export const allViews: View[] = Object.keys(viewIcons) as View[];

export const moduleIcons: Record<View, React.ElementType> = viewIcons;

export const viewLabels: Record<View, string> = {
  dashboard: "Tableau de Bord", sante: "Assurance Santé", crm: "CRM & Prospection", clients: "Gestion Clients",
  compagnies: "Compagnies", autoGestion: "Auto-Gestion",
  contrats: "Contrats", renouvellements: "Renouvellements",
  avenants: "Quittances et Avenants", resiliations: "Résiliations", sinistres: "Sinistres",
  participants: "Participants", prisesEnCharge: "Factures",
  accordPrealable: "Prise en charge", fraude: "Contrôle fraude",
  prestataires: "Prestataires", reglementPrestataire: "Règlement", etatTps: "État TPS",
  reglementComptable: "Règlement comptable",
  comptabilite: "Comptabilité SYSCOHADA",
  commissions: "Commissions", recouvrement: "Recouvrement",
  tresorerie: "Trésorerie", ged: "GED & Documents",
  ia: "Assistant IA", rapports: "Reporting & KPIs", admin: "Administration",
  appelOffres: "Appels d'Offres", cotation: "Cotation",
  fondsDeRoulement: "Fonds de Roulement", honoraires: "Honoraires de Gestion",
  garantiesCatalogue: "Catalogue de garanties",
  cartesAssurance: "Cartes d'assurance",
  actesMedicaux: "Catalogue des actes médicaux",
  lettresCles: "Lettres clés (nomenclature)",
  journalOperations: "Journal des opérations",
  suiviAgents: "Suivi de production par agent",
  factureProduction: "Facture Production",
  courrierMaladie: "Courrier Maladie",
  modelesCourrier: "Modèles de courrier",
  statistiques: "Statistiques",
  parametresEntreprise: "Paramètres de l'entreprise",
  reglesConsignes: "Procédures",
  banques: "Banques",
  agences: "Agences",
  importDonnees: "Import de données",
  bordereauSinistres: "Bordereau Sinistres",
  bordereauProduction: "Bordereau Production",
  bordereauEncaissement: "Bordereau Encaissement",
  portailDashboard: "Tableau de bord",
  portailContrats: "Mes contrats",
  portailParticipants: "Mes Bénéficiaires",
  portailDemandes: "Mes demandes",
  portailReseauSoins: "Réseau de soins",
  portailReglesConsignes: "Procédures",
  portailUtilisateurs: "Utilisateurs & droits",
  portailStatistiques: "Statistiques",
  demandesClient: "Demandes client",
  professionnelsSante: "Professionnel de santé",
  messagerie: "Messagerie",
  rapportsIa: "Rapports IA",
  communications: "Communications",
  membreDashboard: "Accueil",
  membreCarte: "Ma carte",
  membreGaranties: "Mes garanties",
  membrePriseEnCharge: "Prise en charge",
  membreRemboursement: "Remboursement",
  membreReseauSoins: "Réseau de soins",
  membreCarnetSante: "E-carnet Santé",
  membreHistorique: "Historique de soins",
  membreFamille: "Ma famille",
  membreDelegations: "Accès famille",
  prestataireDashboard: "Accueil",
  prestatairePatients: "Patients",
  prestatairePrestations: "Prestations",
  prestataireContacts: "Contacts & Interloc.",
  prestataireDevis: "Devis",
  prestataireFinance: "Gestion financière",
  prestataireLogistique: "Logistique",
  prestataireMedecinPrescripteur: "Consultation",
  prestataireTraiterBon: "Traiter un bon",
  medecinFileAttente: "File d'attente",
  medecinDashboard: "Tableau de bord",
  medecinDossiersPatients: "Mes Dossiers Patients",
  medecinHistoriquePrestations: "Historique des prestations",
  superAdminDashboard: "Tableau de bord",
  superAdminSocietes: "Sociétés",
  superAdminPlans: "Plans d'abonnement",
  superAdminFacturation: "Comptabilité & Facturation",
  superAdminPerformance: "Performance & Usage",
  superAdminTarification: "Tarification",
  superAdminModelesCarte: "Modèles de carte",
  superAdminUtilisateurs: "Utilisateurs",
};
