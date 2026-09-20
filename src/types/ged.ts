export interface GedDocument {
  id: string;
  nom: string;
  type: string;
  entiteLiee: string;
  statutOcr: "En attente" | "Analysé" | "Échec";
  statutSignature: string;
  tags: string[];
  date: string;
  fichier?: string | null;
  sens: "Entrant" | "Sortant";
  objet?: string | null;
  resume?: string | null;
  prestataireId?: string | null;
  prestataire?: { nom: string } | null;
  referenceExtraite?: string | null;
  montantExtrait?: number | string | null;
  factureId?: string | null;
  facture?: { id: string; referenceFacture: string; statut: string } | null;
  statutTraitement: "Sans objet" | "Non traité" | "Traité partiellement" | "Traité totalement";
}
