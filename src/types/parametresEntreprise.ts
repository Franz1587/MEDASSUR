export interface ParametresEntreprise {
  nom: string;
  sousTitre: string;
  adresse?: string | null;
  boitePostale: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  siteWeb: string;
  couleurPrimaire: string;
  couleurSecondaire: string;
  // Repris sur le Décompte de Remboursement Maladie ("Agence : <codeAgence>
  // <nom>", voir DocumentsService.renderDecompteFacture).
  codeAgence?: string | null;
  // Identité (2026-09) — voir demande utilisateur : "on doit pouvoir
  // mettre le logo de l'entreprise... le préfixe du numéro matricule...
  // le modèle de carte." Voir DocumentsService pour leur utilisation
  // réelle (quittances/courriers/PEC/factures/règlements/cartes).
  logo?: string | null;
  prefixeMatricule?: string | null;
  modeleCarteId?: string | null;
  // Texte du verso de carte éditable (2026-09) — voir demande utilisateur :
  // "il faudrait que l'application puisse générer ces deux blocs de texte
  // au lieu de les laisser figés... éditables." Superposés au fond
  // importé (voir DocumentsService.personnaliserTexteVerso) ; vides =
  // fond importé tel quel, comportement historique.
  carteVersoIntro?: string | null;
  carteVersoTelephone?: string | null;
  carteVersoQrExplication?: string | null;
  // Page de garde du rapport Statistiques, personnalisable par société
  // (2026-09) — voir demande utilisateur : "il faut seulement rendre
  // possible la personnalisation de la page de garde par client." Nom de
  // fichier sous uploads/pages-garde-statistiques/ (voir
  // DocumentsService.renderStatistiques pour son usage).
  statistiquesPageGarde?: string | null;
}
