// Ligne d'une demande de prise en charge (2026-08) — une prise en charge
// peut couvrir plusieurs actes liés, comme une facture (typiquement
// KC/KA/K Loc pour un bloc chirurgical, le prestataire indiquant souvent
// des frais réels distincts pour chacun sur son devis) — voir demande
// utilisateur : "la saisie se fait aussi par ligne même si le système
// calcule automatiquement que l'assurance prendra en charge".
export interface AccordPrealableLigne {
  id?: string;
  acteMedicalId?: string;
  lettreCleCode?: string;
  coefficient?: number;
  description: string;
  // Plafond pris en charge par l'assurance pour cette ligne — figé à la
  // saisie (voir montantDevisPourActe, features/accord-prealable/index.tsx).
  plafondReference: number;
  // Frais réels annoncés par le prestataire sur son devis — peut dépasser
  // plafondReference, l'excédent restant à la charge du bénéficiaire.
  montantDevis: number;
  // Rubrique de garantie saisie directement, sans acte du catalogue
  // (2026-09) — voir "Saisir au plafond de la garantie",
  // features/accord-prealable/index.tsx.
  categorieGarantie?: string;
}

export interface AccordPrealable {
  id: string;
  assureId: string;
  contratId: string;
  assureNom: string;
  prestataire: string;
  type: string;
  description: string;
  dateDemande: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  decision: string;
  montantAutorise?: number;
  // Montant suggéré par le calcul serveur (min(frais réel, plafond de
  // référence) × taux de couverture, par ligne) — sert à préremplir la
  // décision "Accordé" au lieu de partir des frais réels bruts. Null si le
  // dossier n'a pas de lignes (ancien modèle, pas de plafond connu).
  montantAutoriseSuggere?: number | null;
  dateDecision?: string;
  // Motif de la décision (2026-08) — voir demande utilisateur : "si c'est
  // pas accordé il doit donner la raison". Alimenté par la décision
  // automatique de l'agent IA (chambre d'hospitalisation) ; vide pour une
  // décision manuelle classique.
  motifDecision?: string;
  // Validité du certificat — par défaut calculée à l'impression (+30j),
  // modifiable pour prolonger un dossier (voir demande utilisateur).
  dateValidite?: string;
  // Pièces justificatives obligatoires pour instruire une demande — l'accord
  // dépend de leur présentation.
  prescriptionRef?: string;
  montantDevis?: number;
  origine?: string; // "Portail Prestataire" | "Portail Assuré" | "Agent"
  // Pièces jointes (2026-08) — image ou document de l'ordonnance et du
  // devis (nom de fichier stocké côté serveur, voir
  // AccordPrealableService.uploadDocument). Facultatives en saisie Agent ;
  // obligatoires pour valider l'analyse médicale d'une demande déposée via
  // un portail externe (voir AccordPrealableService.decider).
  ordonnanceFichier?: string;
  devisFichier?: string;
  // Rapprochement avec les lignes de Facture qui référencent cet accord
  // (voir AccordPrealableService.findAll) — statistique "prise en charge
  // déjà facturée", dérivée à la lecture, pas une colonne persistée.
  facture?: boolean;
  montantFacture?: number;
  // Lignes d'actes (2026-08) — vide pour les dossiers créés avant ce
  // modèle (une seule valeur montantDevis/description, aucune ligne).
  lignes: AccordPrealableLigne[];
  // Prise en main (2026-09) — voir demande utilisateur : "étendre le fait
  // de prendre en main un dossier aux agents de saisie, gestionnaire
  // sinistre et gestionnaires production". null = encore dans la file
  // partagée, réclamable par tout gestionnaire habilité au module.
  assigneAId?: string | null;
}
