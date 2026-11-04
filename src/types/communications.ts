export interface Communication {
  id: string;
  canal: "Email" | "SMS" | "WhatsApp";
  destinataireType: "Prestataire" | "Client" | "AssureSante" | "Prospect" | "Libre";
  destinataireId?: string;
  destinataireNom: string;
  destinataireContact: string;
  cc?: string | null;
  objet?: string;
  contenu: string;
  contenuHtml?: string | null;
  pieceJointe?: string;
  piecesJointes: string[];
  statut: "Simulé" | "Échec" | "Envoyé" | "Reçu" | "Brouillon";
  declencheur: string;
  retour?: string;
  retourDate?: string;
  auteurId?: string;
  lu: boolean;
  archive: boolean;
  supprime: boolean;
  suivi: boolean;
  createdAt: string;
}

export type DossierCommunication = "reception" | "envoyes" | "brouillons" | "archive" | "corbeille" | "suivi" | "tous";

export interface CompteursCommunications {
  reception: number;
  nonLus: number;
  envoyes: number;
  brouillons: number;
  archive: number;
  corbeille: number;
  suivi: number;
}

export interface SignatureCommunication {
  signatureEmail?: string | null;
  signatureSms?: string | null;
}
