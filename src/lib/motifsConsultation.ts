// Motifs de consultation — liste de suggestions pour l'écran "Consultation"
// du médecin prescripteur (2026-08) — voir demande utilisateur :
// "l'application doit pouvoir faire remonter une liste des motifs, avec la
// possibilité d'en ajouter plusieurs". Texte libre côté backend
// (Prescription.motifsConsultation, tableau) : cette liste guide la saisie
// sans la bloquer — un motif absent de la liste reste saisissable (voir
// Consultation.tsx, même Combobox de recherche que pour les actes).
export const MOTIFS_CONSULTATION: string[] = [
  "Consultation de routine",
  "Renouvellement d'ordonnance",
  "Suivi de grossesse",
  "Vaccination",
  "Certificat médical",
  "Bilan de santé",
  "Fièvre",
  "Douleur abdominale",
  "Céphalées",
  "Toux",
  "Douleur thoracique",
  "Essoufflement",
  "Vomissements",
  "Diarrhée",
  "Éruption cutanée",
  "Douleur articulaire",
  "Douleur lombaire",
  "Traumatisme / accident",
  "Plaie",
  "Fatigue persistante",
  "Vertiges",
  "Trouble du sommeil",
  "Trouble digestif",
  "Trouble urinaire",
  "Suivi de maladie chronique",
  "Suivi post-opératoire",
  "Consultation d'urgence",
  "Consultation de contrôle",
];
