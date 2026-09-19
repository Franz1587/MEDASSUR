// Types de navigation centraux — NE PAS dupliquer ces routes ailleurs.
// RootStack porte l'écran de connexion, le conteneur d'onglets (Main), et
// tous les écrans "détail/formulaire" poussés par-dessus les onglets.
export type RootStackParamList = {
  Login: undefined;
  ChangementMotDePasseObligatoire: undefined;
  Main: undefined;

  CarteMembre: { assureId: string; nom: string };
  Garanties: undefined;
  ReseauSoins: undefined;
  Historique: undefined;
  Famille: undefined;

  AccordNouveau: undefined;
  AccordDetail: { id: string };

  RemboursementNouveau: undefined;
  RemboursementDetail: { id: string };

  HistoriqueDetail: { id: string };

  FamilleMembreDetail: { id: string };

  Delegations: undefined;
  DelegationNouvelle: { cibleId: string; nom: string };
  DelegationGerer: { cibleId: string; nom: string; modulesActuels: string[] };

  MessagerieListe: undefined;
  MessagerieConversation: { id: string; objet: string };
  MessagerieNouvelle: undefined;

  MonProfil: undefined;

  ReseauSoinsDetail: { id: string };

  // Visionneuse PDF intégrée (2026-09) — voir demande utilisateur : "les
  // documents PDF doivent s'ouvrir dans l'application... au lieu de se
  // télécharger systématiquement", même principe que PdfViewerHost.tsx côté
  // web. `path` : chemin API relatif (ex. cheminFeuilleSoins(id)) déjà
  // authentifié via le token — voir DocumentViewerScreen.
  DocumentViewer: { path: string; titre: string };
};

// MainTabs — barre du bas à 5 onglets max, les rubriques
// restantes vivent dans l'onglet "Plus" (grille de tuiles, voir
// PlusMenuScreen) et sont poussées comme écrans RootStack depuis là.
export type MainTabParamList = {
  Accueil: undefined;
  PriseEnCharge: undefined;
  Remboursement: undefined;
  Carnet: undefined;
  Plus: undefined;
};
