// Groupes d'actes — miroir mobile de
// src/features/portail-prestataire/prestationTypes.ts (constante
// GROUPES_ACTES) + de la logique typeFormulaire() de
// src/features/portail-membre/Historique.tsx (web). MÊME duplication
// assumée qu'ailleurs dans l'app (voir commentaire du fichier source) : la
// vraie source de vérité reste le calcul serveur (acteFamille est déjà
// renvoyé résolu par le backend) — ce fichier ne fait que décider, côté
// affichage, si un bouton "Feuille de soins" ou "Feuille d'examen" doit être
// proposé pour une ligne d'Historique donnée.
//
// N'existe QUE pour HistoriqueScreen/HistoriqueDetailScreen — pas de
// dépendance vers prestationTypes.ts (module hors périmètre mobile, jamais
// importé depuis mobile/).
export interface GroupeActe {
  cle: string;
  label: string;
  familles: string[];
}

export const GROUPES_ACTES: GroupeActe[] = [
  {
    cle: "Consultation", label: "Consultation",
    familles: ["CONSULTATIONS", "ACTES CARDIOLOGIE", "ACTES D'OPHTALMOLOGIE", "ACTES DE L'UROLOGUE", "ACTES DU DERMATOLOGUE", "ACTES DU GASTROLOGUE", "ACTES DU NEUROLOGUE", "ACTES DU RHUMATOLOGUE", "ACTES GYNÉCO", "ACTES ORL"],
  },
  { cle: "Analyse", label: "Analyse", familles: ["EXAMENS LABORATOIRE"] },
  {
    cle: "Imagerie", label: "Imagerie",
    familles: ["RADIOLOGIE", "RADIOLOGIE ABDOMEN", "RADIOLOGIE MEMBRES INFÉRIEURS", "RADIOLOGIE MEMBRES SUPÉRIEURS", "RADIOLOGIE RACHIS", "RADIOLOGIE TRONC", "IRM", "SCANNER / TDM", "ÉCHOGRAPHIE"],
  },
  {
    cle: "Hospitalisation", label: "Hospitalisation & Chirurgie",
    familles: ["ACTES CHIRURGICAUX", "PLÂTRE, ATTELLE ET POINT DE SUTURE", "DIALYSE & RADIOTHÉRAPIE"],
  },
  { cle: "Dentaire", label: "Dentaire", familles: ["SOINS & PROTHÈSES DENTAIRES", "SOINS DENTAIRES & CONSERVATEURS"] },
  { cle: "Kinesitherapie", label: "Kinésithérapie", familles: ["KINÉSITHÉRAPIE & CURES THERMALES"] },
  { cle: "ActesSpecialites", label: "Actes de Spécialités", familles: ["PETITE CHIRURGIE & SOINS INFIRMIERS", "DIVERS"] },
  { cle: "Autre", label: "Pharmacie", familles: ["PHARMACIE"] },
];

// Feuille de soins / feuille d'examen (voir Historique.tsx web) : chaque
// fiche de consultation génère aussi une feuille de soins, et chaque examen/
// acte de spécialité/analyse génère une feuille d'examen. Aucune des deux
// pour les autres familles (Pharmacie/Dentaire/Kinésithérapie/Hospitalisation).
const GROUPES_EXAMEN = new Set(["Analyse", "Imagerie", "ActesSpecialites"]);

export function typeFormulaire(acteFamille: string | null | undefined): "soins" | "examen" | null {
  const groupe = GROUPES_ACTES.find((g) => acteFamille && g.familles.includes(acteFamille))?.cle;
  if (groupe === "Consultation") return "soins";
  if (groupe && GROUPES_EXAMEN.has(groupe)) return "examen";
  return null;
}
