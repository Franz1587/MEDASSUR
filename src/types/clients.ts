export interface Client {
	id: string;
	nom: string;
	type: "Entreprise" | "Particulier";
	pays: string;
	contact: string;
	tel: string;
	email: string;
	statut: "Actif" | "Inactif";
	contrats: number;
	prime: number;
	// Nom de fichier sous backend/uploads/logos-clients/ — voir
	// uploadClientLogo().
	logo?: string | null;

	// Coordonnées détaillées
	ville?: string;
	adresse?: string;
	boitePostale?: string;
	telSecondaire?: string;

	// Personne morale (type = "Entreprise")
	categorieMorale?: "Société privée" | "Société publique" | "Parapublique" | "Administration publique" | "Ministère" | "Organisme" | "Association" | "Autre";
	formeJuridique?: string;
	rccm?: string;
	nif?: string;
	secteurActivite?: string;
	effectif?: number;
	representantNom?: string;
	representantFonction?: string;
	representantTel?: string;
	representantEmail?: string;

	// Personne physique (type = "Particulier")
	prenom?: string;
	dateNaissance?: string;
	lieuNaissance?: string;
	sexe?: "M" | "F";
	nationalite?: string;
	situationMatrimoniale?: "Célibataire" | "Marié" | "Mariée" | "Divorcé" | "Divorcée" | "Veuf" | "Veuve";
	profession?: string;
	employeur?: string;
	pieceIdentiteType?: "CNI" | "Passeport" | "Permis de conduire" | "Carte consulaire";
	pieceIdentiteNumero?: string;
}

export interface PortfolioContrat {
	reference: string;
	source: "Contrat";
	produit: string;
	compagnie: string;
	dateDebut: string | null;
	dateFin: string | null;
	statut: string;
	prime: number;
}

export interface ClientPortfolio {
	souscripteur: Omit<Client, "contrats" | "prime">;
	resume: {
		totalContrats: number;
		primeTotale: number;
	};
	contrats: PortfolioContrat[];
}
