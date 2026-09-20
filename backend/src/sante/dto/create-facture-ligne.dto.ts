import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Taxonomie du type de prestation d'une ligne de facture (2026-09, voir
// demande utilisateur : "c'est exactement ce qui doit devenir le modèle
// standard du tableau de garanties" — reprise du contrat 3M PARTNERS &
// CONSEILS, police 10005316). Consultations/Pharmacie/Imagerie/Analyses
// Médicale/Petite Chirurgie-Soins/Hospitalisation suivent le calcul au
// pourcentage (taux du Contrat selon secteur du prestataire) — le champ
// `typePrestation === "Hospitalisation"` distingue seul les deux taux
// (voir SanteService.calculerPartAssuranceLigne, tout le reste retombe en
// ambulatoire). Les autres valeurs sont les rubriques plafonnées de
// Garantie.categorie (calcul au plafond restant, fenêtre glissante 1 ou 2
// ans à partir de la date de CHAQUE prestation, voir
// SanteService.calculerPartPlafonnee). "Ambulatoire" reste une valeur
// générique de repli (anciennes saisies, actes hors catalogue).
export const RUBRIQUES_PLAFONNEES = ["Soins & Prothèses dentaires", "Optique", "Kinésithérapie & Cure thermale", "Maternité", "Transport", "Orthophonie", "Orthoptie", "Autre"];
// "Actes de Spécialités" (2026-09) — voir demande utilisateur : "je ne
// veux plus de rubrique de type Consultation/Divers. Les familles d'actes
// tels que Actes de Cardiologie doivent plutôt être rangées dans une
// rubrique de tableau de garantie appelée 'Actes de Spécialités' car ce
// sont des actes que réalisent les médecins spécialistes et non des actes
// de consultation." Suit le calcul au pourcentage (ambulatoire), comme
// Consultations — jamais plafonnée.
export const TYPES_PRESTATION = ["Ambulatoire", "Consultations", "Actes de Spécialités", "Pharmacie", "Imagerie", "Analyses Médicale", "Petite Chirurgie/Soins", "Hospitalisation", ...RUBRIQUES_PLAFONNEES];

export class CreateFactureLigneDto {
  @IsString()
  assureId: string;

  @IsIn(TYPES_PRESTATION)
  typePrestation: string;

  @IsString()
  datePrestation: string;

  // Acte choisi dans le catalogue ActeMedical (578 actes, voir
  // seed-actes-medicaux.ts) — mode de tarification "forfaitaire". Devient
  // facultatif dès qu'une lettre clé est renseignée ci-dessous (mode
  // "codification", voir demande utilisateur) : les deux modes restent
  // mutuellement exclusifs, vérifié dans SanteService.creerLigneFacture.
  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  @IsOptional()
  @IsString()
  accordPrealableId?: string;

  @IsNumber()
  @Min(0)
  montant: number;

  // Quantité (2026-08) — nombre d'unités facturées (ex. séances de kiné) ;
  // montant transmis reste toujours le TOTAL (quantité × prix unitaire),
  // jamais le prix unitaire seul (voir demande utilisateur).
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantite?: number;

  // Codification à la lettre clé (2026-08) — nomenclature à coefficient,
  // alternative au montant forfaitaire d'un ActeMedical (voir schema.prisma
  // LettreCle). Conservés pour traçabilité ; le montant réel reste celui
  // du champ `montant` ci-dessus, calculé côté client.
  @IsOptional()
  @IsString()
  lettreCleCode?: string;

  @IsOptional()
  @IsNumber()
  coefficient?: number;

  // Rejet possible dès la saisie de la ligne (2026-08) — évite un aller-
  // retour "ajouter puis rejeter séparément" quand le gestionnaire sait déjà,
  // au moment de saisir, que l'acte ne sera pas couvert. motifRejet devient
  // obligatoire dans ce cas (vérifié dans SanteService.creerLigneFacture,
  // pas ici, car sa présence dépend de statutInitial).
  @IsOptional()
  @IsIn(["Accepté", "Rejeté"])
  statutInitial?: string;

  @IsOptional()
  @IsString()
  motifRejet?: string;

  // Rejet partiel (2026-08) — une partie seulement des frais réels
  // contestée par le contrôle médical ; retirée du montant AVANT de
  // calculer la part assurance/assuré (voir SanteService.
  // calculerPartAssuranceLigne). motifRejet devient alors obligatoire
  // (même règle que le rejet total ci-dessus).
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantRejete?: number;

  // Dossier sinistre santé (2026-08) — repris sur le Décompte de
  // Remboursement Maladie ; voir schema.prisma PriseEnCharge.nSinistre.
  @IsOptional()
  @IsString()
  nSinistre?: string;

  @IsOptional()
  @IsString()
  nDeclaration?: string;

  // Nature de l'affection + code CNAMGS (2026-08) — voir demande
  // utilisateur : "il fallait créer une rubrique nature de l'affection
  // dans la saisie de la facture... ça permettra à l'application d'avoir
  // des données statistique réels de santé... sans faire remonter ses
  // données dans les documents statistiques." Obligatoires pour toute
  // saisie MANUELLE d'une ligne (vérifié dans SanteService.creerLigneFacture,
  // pas ici, via `opts.exigerAffection` — le traitement d'un bon prescrit
  // hérite du code affection de la Prescription d'origine, potentiellement
  // absent, sans bloquer le prestataire traitant qui ne le saisit jamais
  // lui-même). Jamais affichés sur le Décompte remis au tiers (voir
  // DocumentsService.renderDecompteFacture), strictement internes.
  @IsOptional()
  @IsIn(["AffectionCourante", "AffectionLongue"])
  natureMaladie?: string;

  @IsOptional()
  @IsString()
  codeAffection?: string;

  // Médecin assigné par l'accueil pour une Consultation (2026-09) — voir
  // demande utilisateur : "au niveau de l'accueil, le médecin doit avoir
  // été lié à la prestation consultation qui doit se faire". Facultatif
  // ici (une prestation Pharmacie/Laboratoire n'a pas de médecin) — c'est
  // le frontend qui l'exige quand l'acte choisi appartient au groupe
  // "Consultation" (voir Prestations.tsx).
  @IsOptional()
  @IsString()
  medecinId?: string;
}
