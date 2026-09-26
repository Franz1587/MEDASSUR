// Modèles Prisma cloisonnés par société (2026-09, Phase 2 multi-tenant) —
// voir SocieteAssurance / schema.prisma. Chacun porte un champ societeId
// nullable + une relation vers SocieteAssurance. Volontairement EXCLUS :
// les référentiels partagés/nationaux (ActeMedical, CodeAffection,
// LettreCle, GarantieCatalogue générique...) qui ne sont pas des données
// propres à une société mais une nomenclature commune à toute la
// plateforme, et ParametresEntreprise/CompteurDocument qui suivent leur
// propre logique de cloisonnement par clé (voir ParametresEntrepriseService)
// plutôt que le middleware générique ci-dessous (voir prisma.service.ts).
export const TENANT_MODELS = new Set<string>([
  // User (2026-09) — comblé après coup : User.societeId existait déjà
  // depuis la Phase 1 mais n'était consulté par AUCUN filtrage automatique,
  // ce qui laissait un administrateur d'une société lister/modifier les
  // comptes d'une AUTRE société via /users. Voir demande utilisateur : la
  // gestion des droits par société doit être réellement cloisonnée.
  "User",
  // AuditLog (2026-09) — comblé après coup : l'écran interne "Journal des
  // opérations" (module journalOperations) montrait l'activité de TOUTES
  // les sociétés faute de filtrage. Pas de relation formelle vers
  // SocieteAssurance (voir schema.prisma) — un simple scalar suffisant
  // pour ce cas, comme AuditLog.utilisateur (email en texte libre, sans FK).
  "AuditLog",
  "Client",
  "Compagnie",
  "Prospect",
  "AppelOffres",
  "Cotation",
  "Contrat",
  "QuittanceLibre",
  "Sinistre",
  "AssureSante",
  "Prestataire",
  "Medecin",
  "AccordPrealable",
  "PriseEnCharge",
  "Facture",
  "Remboursement",
  "RelevePrestataire",
  "Decompte",
  "BordereauReglement",
  "Banque",
  "LettreCheque",
  "FactureProduction",
  "Courrier",
  // Conversation (2026-09) — comblé après coup, voir schema.prisma pour le
  // détail du bug (file de messagerie partagée entre TOUTES les sociétés).
  "Conversation",
  // RapportConversationIA (2026-09) — voir schema.prisma : rapport de
  // clôture interne créé par l'agent IA, même cloisonnement que Conversation.
  "RapportConversationIA",
  // Trésorerie/Recouvrement/Comptabilité (2026-09) — comblé après coup,
  // même bug que Conversation : ces 4 modèles étaient interrogés sans
  // AUCUN filtrage (voir schema.prisma pour le détail).
  "CompteBancaire",
  "FluxTresorerie",
  "Impaye",
  "JournalEntry",
  // Communication/DemandeClient/FondsDeRoulement/HonorairesGestion/
  // GedDocument/CourrierType (2026-09) — même bug, comblé après coup, voir
  // schema.prisma. Volontairement EXCLU : DemandeClientBeneficiaire
  // (enfant de DemandeClient, atteint uniquement via demandeClientId déjà
  // cloisonné, même principe que Message/FactureAbonnementLigne).
  "Communication",
  "DemandeClient",
  "FondsDeRoulement",
  "HonorairesGestion",
  "GedDocument",
  "CourrierType",
  // Avenant/Prescription/ScoringFraude/FactureEnAttente/PrestataireAlias/
  // LotCheques (2026-09) — même bug, comblé après coup, voir schema.prisma.
  // Volontairement EXCLUS : AvenantAssure/PrescriptionLigne/
  // PrescriptionLigneTraitement (enfants déjà atteints via un parent
  // cloisonné, même principe que Message/FactureAbonnementLigne).
  // GarantieCatalogue volontairement EXCLU du mécanisme générique — corrigé
  // À LA MAIN dans GarantieCatalogueService (nature double, partagée pour
  // les lignes génériques, cloisonnée pour les lignes compagnie-owned ; le
  // filtrage strict de TENANT_MODELS ferait disparaître les lignes
  // génériques pour tout le monde).
  "Avenant",
  "Prescription",
  "ScoringFraude",
  "FactureEnAttente",
  "PersonneEnAttenteTransfert",
  // Identité d'un assuré et ses matricules (2026-09-26) — jamais partagées
  // entre sociétés, voir schema.prisma IdentiteAssuree.
  "IdentiteAssuree",
  "MatriculeAssuree",
  "PrestataireAlias",
  "LotCheques",
  // Agence (2026-09) — voir schema.prisma pour le détail de la demande
  // utilisateur ("lier un agent de saisie à une agence... afin que ce soit
  // cette agence qui remonte sur le décompte").
  "Agence",
]);
