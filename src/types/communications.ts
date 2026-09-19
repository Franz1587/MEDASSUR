// Communications externes (2026-08) — voir demande utilisateur : "l'application
// doit pouvoir rendre possible l'envoi des mails, sms et whatsapp. et
// recevoir des retours sous forme de notification et message interne."
// AUCUN fournisseur n'est branché (voir CommunicationsService, backend) —
// chaque envoi est SIMULÉ, journalisé ici, jamais réellement transmis.
export interface Communication {
  id: string;
  canal: "Email" | "SMS" | "WhatsApp";
  destinataireType: "Prestataire" | "Client" | "AssureSante" | "Prospect" | "Libre";
  destinataireId?: string;
  destinataireNom: string;
  destinataireContact: string;
  objet?: string;
  contenu: string;
  pieceJointe?: string;
  statut: "Simulé" | "Échec";
  declencheur: string;
  retour?: string;
  retourDate?: string;
  auteurId?: string;
  createdAt: string;
}
