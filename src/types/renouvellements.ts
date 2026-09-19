// Miroir de la forme renvoyée par services/renouvellements.service.ts
// (mapRenouvellement) — plus aucune dépendance à un fichier mock (voir
// demande utilisateur : "le tableau de bord [doit] faire remonter les
// informations en fonction du profil de l'utilisateur").
export interface Renouvellement {
  id: string;
  contrat: string;
  clientId: string;
  client: string;
  branche: string;
  compagnie: string;
  dateFin: string;
  joursRestants: number;
  primeActuelle: number;
  primeProposee: number;
  sinistralite: string | null;
  statut: string;
  gestionnaireId: string | null;
}
