// Demande de mouvement de population initiée depuis le portail client
// (2026-08) — voir demande utilisateur : "initier des opérations comme des
// incorporations et retrait, mais la validation finale revient au
// gestionnaire côté assurance". Voir backend/prisma/schema.prisma
// DemandeClient/DemandeClientBeneficiaire.

// Une personne à incorporer — voir demande utilisateur : "on doit pouvoir
// choisir la famille s'il s'agit d'un conjoint ou d'un enfant. Mais s'il
// s'agit d'un assuré principal il faut rendre possible aussi l'ajout de ses
// ayants droit". familleId référence un AssureSante existant sur le
// contrat ; familleRefLocale=true référence l'assuré principal ajouté DANS
// LA MÊME demande (résolu à l'approbation, pas encore un id réel avant).
export interface DemandeClientBeneficiaire {
  id: string;
  nom: string;
  prenom?: string | null;
  dateNaissance?: string | null;
  typeAssure: "AS" | "CJ" | "EF";
  sexe?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  scolarise?: boolean | null;
  photo?: string | null;
  familleId?: string | null;
  familleRefLocale: boolean;
}

export interface DemandeClient {
  id: string;
  contratId: string;
  clientId: string;
  demandeurId: string;
  dateDemande: string;
  type: "Incorporation" | "Retrait";
  statut: "En attente" | "Accordée" | "Refusée";
  dateTraitement?: string | null;
  gestionnaireId?: string | null;
  motifRefus?: string | null;
  avenantId?: string | null;

  beneficiaires: DemandeClientBeneficiaire[];

  // Retrait
  assureId?: string | null;
  motifRetrait?: string | null;

  // Enrichissements de lecture (relations backend)
  contratReference?: string;
  clientNom?: string;
  demandeurNom?: string;
  assureRetraitNom?: string;
}

export interface BeneficiaireInput {
  nom: string;
  prenom?: string;
  dateNaissance?: string;
  typeAssure: "AS" | "CJ" | "EF";
  sexe?: string;
  telephone?: string;
  adresse?: string;
  scolarise?: boolean;
  familleId?: string;
  familleRefLocale?: boolean;
  // Local uniquement — fichier choisi avant l'envoi de la demande, jamais
  // transmis dans le JSON de création (voir Demandes.tsx : uploadé à part
  // une fois le bénéficiaire créé, pour connaître son id réel).
  photoFile?: File;
}

export interface CreateDemandeClientInput {
  contratId: string;
  type: "Incorporation" | "Retrait";
  dateDemande: string;
  beneficiaires?: Omit<BeneficiaireInput, "photoFile">[];
  assureId?: string;
  motifRetrait?: string;
}

export interface CotisationBeneficiaireInput {
  beneficiaireId: string;
  beneficiaires: number;
  cotisation: number;
}

export interface DecisionDemandeClientInput {
  decision: "Accordée" | "Refusée";
  motifRefus?: string;
  dateEffet?: string;
  cotisations?: CotisationBeneficiaireInput[];
}
