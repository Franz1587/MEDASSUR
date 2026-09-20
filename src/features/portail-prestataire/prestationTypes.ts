// Groupes d'actes (2026-08) — voir demande utilisateur : "il faut par
// contre faire remonter les familles des actes [en boutons 'Nouvelle
// prestation']. Exemple: Consultation, Analyse, Hospitalisation,
// Imagerie…". DOIT rester strictement identique à
// backend/src/actes-medicaux/groupes-actes.util.ts — même duplication
// assumée qu'ailleurs dans l'app (ex. FactureSaisie.tsx / TYPES_PRESTATION),
// la vraie source de vérité reste le calcul serveur.
export interface GroupeActe {
  cle: string;
  label: string;
  familles: string[];
  typePrestationDefaut: string;
}

// Consultation, généraliste ou spécialisée (2026-08) — voir demande
// utilisateur : "qu'elle soit généralisées ou spécialisées, il faut
// regrouper les consultations simplement dans la rubrique 'Consultation'"
// — un seul groupe, plus de bouton "Consultations spécialisées" séparé.
export const GROUPES_ACTES: GroupeActe[] = [
  {
    cle: "Consultation", label: "Consultation",
    familles: ["CONSULTATIONS", "ACTES CARDIOLOGIE", "ACTES D'OPHTALMOLOGIE", "ACTES DE L'UROLOGUE", "ACTES DU DERMATOLOGUE", "ACTES DU GASTROLOGUE", "ACTES DU NEUROLOGUE", "ACTES DU RHUMATOLOGUE", "ACTES GYNÉCO", "ACTES ORL"],
    typePrestationDefaut: "Ambulatoire",
  },
  { cle: "Analyse", label: "Analyse", familles: ["EXAMENS LABORATOIRE"], typePrestationDefaut: "Ambulatoire" },
  {
    // Familles radiologie consolidées (2026-09) — voir demande utilisateur :
    // "au lieu d'avoir radio membre inférieur, radio membre supérieur,
    // radiologie, il faut juste tout regrouper les actes de ces famille
    // d'acte sous une seule famille appelée 'Radiologie'." Anciens noms
    // listés en repli, sans effet une fois la migration du catalogue
    // appliquée.
    cle: "Imagerie", label: "Imagerie",
    familles: ["Radiologie", "RADIOLOGIE", "RADIOLOGIE ABDOMEN", "RADIOLOGIE MEMBRES INFÉRIEURS", "RADIOLOGIE MEMBRES SUPÉRIEURS", "RADIOLOGIE RACHIS", "RADIOLOGIE TRONC", "IRM", "SCANNER / TDM", "ÉCHOGRAPHIE"],
    typePrestationDefaut: "Ambulatoire",
  },
  {
    cle: "Hospitalisation", label: "Hospitalisation & Chirurgie",
    familles: ["ACTES CHIRURGICAUX", "PLÂTRE, ATTELLE ET POINT DE SUTURE", "DIALYSE & RADIOTHÉRAPIE"],
    typePrestationDefaut: "Hospitalisation",
  },
  // Familles dentaires consolidées (2026-09) — voir demande utilisateur :
  // "mettre tout sous la rubrique 'Soins & Prothèses Dentaires'."
  { cle: "Dentaire", label: "Dentaire", familles: ["Soins & Prothèses Dentaires", "SOINS & PROTHÈSES DENTAIRES", "SOINS DENTAIRES & CONSERVATEURS"], typePrestationDefaut: "Soins & Prothèses dentaires" },
  { cle: "Kinesitherapie", label: "Kinésithérapie", familles: ["KINÉSITHÉRAPIE & CURES THERMALES"], typePrestationDefaut: "Kinésithérapie & Cure thermale" },
  // "Actes de Spécialités" détaché d'Hospitalisation (2026-08) — voir
  // demande utilisateur : "il faut détacher pharmacie et soins et
  // renommer soins par 'Actes de Spécialités'". "DIVERS" y est ajouté
  // (2026-08) — voir demande utilisateur : "Pharmacie ne doit concerner
  // que les médicaments pharmaceutiques. Les données actuellement dans la
  // rubrique Pharmacie doivent basculer dans Actes de Spécialités".
  { cle: "ActesSpecialites", label: "Actes de Spécialités", familles: ["PETITE CHIRURGIE & SOINS INFIRMIERS", "DIVERS"], typePrestationDefaut: "Ambulatoire" },
  // "Pharmacie" — uniquement les médicaments (2026-08) — voir demande
  // utilisateur ci-dessus. La clé reste "Autre" (déjà stockée dans
  // Prestataire.categoriesActesVisibles pour les pharmacies) — seule la
  // famille rattachée change, vers la nouvelle famille dédiée "PHARMACIE".
  // typePrestationDefaut Ambulatoire, pas "Autre" (2026-08) — voir demande
  // utilisateur : "si on coche la case ambulatoire c'est le taux en
  // ambulatoire qui s'applique... et si on coche hospitalisation, ce sera
  // le taux en hospitalisation" — voir groupes-actes.util.ts (backend) pour
  // le détail ; Prestations.tsx restreint le choix à ces deux valeurs pour
  // ce groupe au lieu du menu complet des 8 types de prestation.
  { cle: "Autre", label: "Pharmacie", familles: ["PHARMACIE"], typePrestationDefaut: "Ambulatoire" },
];

// Type de prestation, taxonomie de facturation (2026-08) — doit rester
// strictement identique à TYPES_PRESTATION côté backend (voir
// backend/src/sante/dto/create-facture-ligne.dto.ts) : sert au calcul de la
// quote-part (SanteService.calculerPartAssuranceLigne), distinct des
// GROUPES_ACTES ci-dessus (qui pilotent les boutons "Nouvelle prestation"
// et le filtrage du catalogue d'actes). Le groupe choisi pré-remplit ce
// type via typePrestationDefaut, modifiable ensuite dans le formulaire.
export const TYPES_PRESTATION_LABELS = [
  { value: "Ambulatoire", label: "Ambulatoire" },
  { value: "Consultations", label: "Consultations" },
  { value: "Actes de Spécialités", label: "Actes de Spécialités" },
  { value: "Pharmacie", label: "Pharmacie" },
  { value: "Imagerie", label: "Imagerie" },
  { value: "Analyses Médicale", label: "Analyses Médicale" },
  { value: "Petite Chirurgie/Soins", label: "Petite Chirurgie/Soins" },
  { value: "Hospitalisation", label: "Hospitalisation" },
  { value: "Soins & Prothèses dentaires", label: "Soins & Prothèses dentaires" },
  { value: "Optique", label: "Optique" },
  { value: "Kinésithérapie & Cure thermale", label: "Kinésithérapie & Cure thermale" },
  { value: "Orthophonie", label: "Orthophonie" },
  { value: "Orthoptie", label: "Orthoptie" },
  { value: "Maternité", label: "Maternité" },
  { value: "Transport", label: "Transport" },
  { value: "Autre", label: "Autre" },
];

// Rubriques de garanties (2026-09) — même taxonomie que Garantie.categorie
// (voir schema.prisma), utilisée pour configurer Prestataire.garantiesVisibles
// côté interne (écran Prestataires). Alignée sur le modèle standard (voir
// STANDARD_GARANTIES, contrats/index.tsx).
export const CATEGORIES_GARANTIES = ["Consultations", "Actes de Spécialités", "Pharmacie", "Imagerie", "Analyses Médicale", "Petite Chirurgie/Soins", "Hospitalisation", "Soins & Prothèses dentaires", "Optique", "Kinésithérapie & Cure thermale", "Orthophonie", "Orthoptie", "Maternité", "Transport", "Autre"];

// Clé de handoff patient → prestation (2026-08) — voir demande utilisateur,
// capture de référence "identification du patient" puis "nouvelle
// prestation" : deux écrans distincts côté portail (Patients/Prestations,
// même structure de nav que la maquette), reliés par ce petit relais
// sessionStorage plutôt que par un état partagé au niveau du shell (le
// portail n'a pas de mécanisme de navigation avec paramètres, voir
// ShellNavigationContext — triggerShellAction n'est câblé que côté AdminShell).
export const PRESTATION_HANDOFF_KEY = "medassur-prestataire-handoff";

export interface PrestationHandoff {
  patientId: string;
  groupeActe: string;
}
