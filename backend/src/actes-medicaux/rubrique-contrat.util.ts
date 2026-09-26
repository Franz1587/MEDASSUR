// Résolution canonique "ligne de prestation → rubrique du tableau de
// garanties du CONTRAT" (2026-09) — voir demande utilisateur : "les
// statistiques doivent être en harmonie parfaite avec le tableau de
// garantie du contrat... les rubriques sont celles du tableau de garanties
// du contrat." Remplace 4 implémentations dupliquées et incohérentes
// (statistiques.service.ts, portail-membre.util.ts, documents.service.ts,
// ConsommationsTab.tsx côté frontend) — util pur (pas un service Nest,
// comme groupes-actes.util.ts) pour rester importable depuis n'importe quel
// module sans créer de dépendance de module.
export interface ActeInfoRubrique {
  famille: string;
  categorieGarantie: string | null;
}

// Rubriques canoniques (2026-09) — voir demande utilisateur : "on voit des
// rubriques qui se répètent : dentisterie = soins dentaires, frais
// pharmaceutiques = pharmacie... il faut veiller à ce que ça ne se répète
// pas." Trois sources alimentent une rubrique, chacune avec son propre
// vocabulaire : le type BRUT des lignes importées ("PHARMACIE", "FRAIS
// PHARMACEUTIQUES", "HOPSITALISATION" avec faute de frappe, "ACTES
// AMBULATOIRES", "VISITE"...), ActeMedical.categorieGarantie ("Soins &
// Prothèses dentaires", "Analyses Médicale"...) et Garantie.categorie du
// contrat ("Dentisterie", "Consultation/Divers"...). Toute valeur, d'où
// qu'elle vienne, est ramenée à UN SEUL libellé ci-dessous — c'est lui qui
// s'affiche partout (statistiques, rapports, portail membre, mobile), jamais
// la saisie d'origine. Ordre significatif : premier mot-clé trouvé gagne
// ("SOINS DENTAIRES" doit tomber sur Dentisterie avant Petite
// Chirurgie/Soins, "POST HOSPITALISATION" sur Hospitalisation...).
const RUBRIQUES_CANONIQUES: { rubrique: string; motsCles: string[] }[] = [
  { rubrique: "Dentisterie", motsCles: ["DENT", "PROTHESE DENT", "STOMATO", "ORTHODON"] },
  { rubrique: "Optique", motsCles: ["OPTIQ", "LUNETTE", "VERRE", "MONTURE"] },
  { rubrique: "Kinésithérapie & Cure thermale", motsCles: ["KINE", "CURE THERMALE", "REEDUCATION"] },
  { rubrique: "Maternité", motsCles: ["MATERN", "ACCOUCH", "GROSSESSE", "PRENATAL"] },
  { rubrique: "Transport", motsCles: ["TRANSPORT", "AMBULANCE", "EVASAN"] },
  { rubrique: "Orthophonie", motsCles: ["ORTHOPHON"] },
  { rubrique: "Orthoptie", motsCles: ["ORTHOPT"] },
  { rubrique: "Hospitalisation", motsCles: ["HOSPI", "HOPSI", "HOPITAL", "CHIRURGIE MAJEURE"] },
  { rubrique: "Pharmacie", motsCles: ["PHARMA", "MEDICAMENT"] },
  { rubrique: "Analyses Médicale", motsCles: ["ANALYS", "LABO", "BIOLOG"] },
  { rubrique: "Imagerie", motsCles: ["IMAGERIE", "RADIO", "ECHOGRAPH", "SCANNER", "IRM"] },
  { rubrique: "Actes de Spécialités", motsCles: ["SPECIALIT"] },
  { rubrique: "Consultations", motsCles: ["CONSULT", "VISITE"] },
  { rubrique: "Petite Chirurgie/Soins", motsCles: ["PETITE CHIRURGIE", "SOINS INFIRMIER", "SOINS"] },
  { rubrique: "Ambulatoire", motsCles: ["AMBU", "FRAIS MEDICAUX"] },
  { rubrique: "Autre", motsCles: ["AUTRE", "PRESTATION", "DIVERS"] },
];

// Rubriques qui ont besoin d'une ligne Garantie (taux/plafond) sur le
// contrat pour être légitimes — même périmètre que RUBRIQUES_PLAFONNEES
// (create-facture-ligne.dto.ts), exprimé en libellés canoniques.
const RUBRIQUES_CANONIQUES_PLAFONNEES = new Set(["Dentisterie", "Optique", "Kinésithérapie & Cure thermale", "Maternité", "Transport", "Orthophonie", "Orthoptie", "Autre"]);

function cleComparaison(valeur: string): string {
  return valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

// Libellé canonique d'une rubrique, quelle que soit sa source/orthographe.
// Une valeur inconnue (aucun mot-clé reconnu) garde son libellé d'origine
// plutôt que d'être rangée arbitrairement ailleurs.
export function normaliserRubrique(valeur: string): string {
  const cle = cleComparaison(valeur);
  if (!cle) return "Non précisé";
  // Mot-clé cherché en DÉBUT de mot ("IRM" ne doit pas matcher
  // "INFIRMIERS", ni "DENT" matcher "ACCIDENT").
  const texte = ` ${cle}`;
  const trouvee = RUBRIQUES_CANONIQUES.find((r) => r.motsCles.some((m) => texte.includes(` ${m}`)));
  return trouvee ? trouvee.rubrique : valeur.trim();
}

export function resoudreRubriqueContrat(
  garantiesContrat: { categorie: string }[],
  ligne: { type: string },
  acteInfo?: ActeInfoRubrique | null,
): string {
  // Garde "DIVERS" — un import d'historique en masse ("reprise
  // d'antériorité") rattache TOUTES ses lignes à un seul acte générique
  // placeholder (famille "DIVERS") dont la categorieGarantie
  // ("Consultation/Divers") ne reflète jamais le type réel de la ligne.
  // Ignorer l'acte dans ce cas précis et se rabattre sur `ligne.type`, qui
  // porte la vraie info (Ambulatoire/Hospitalisation/Autre...) — même
  // garde que portail-membre.util.ts historiquement, désormais partagée.
  const categorieActe = acteInfo && acteInfo.famille.trim().toUpperCase() !== "DIVERS" ? acteInfo.categorieGarantie : null;
  const candidat = (categorieActe ?? ligne.type ?? "").trim();
  if (!candidat) return "Non précisé";
  const rubrique = normaliserRubrique(candidat);

  // Rubrique plafonnée (a besoin d'une ligne Garantie pour avoir un
  // taux/plafond défini) mais aucune ligne ne correspond sur ce contrat —
  // signal honnête d'un tableau de garanties incomplet plutôt qu'un
  // chiffre qui semblerait rattaché à une garantie qui n'existe pas. La
  // comparaison se fait elle aussi sur les libellés canoniques
  // ("Dentisterie" du contrat = "Soins & Prothèses dentaires" de l'acte).
  // Seulement si le contrat A un tableau de garanties saisi : un contrat
  // dont le tableau n'a jamais été renseigné (cas de la plupart des
  // contrats repris) afficherait sinon "Hors tableau (Dentisterie)" là où
  // un autre contrat affiche "Dentisterie" — exactement le doublon de
  // rubrique qu'on cherche à éliminer.
  if (
    RUBRIQUES_CANONIQUES_PLAFONNEES.has(rubrique) &&
    garantiesContrat.length > 0 &&
    !garantiesContrat.some((g) => normaliserRubrique(g.categorie) === rubrique)
  ) {
    return `Hors tableau de garanties (${rubrique})`;
  }

  // Grande rubrique sans plafond (Consultations, Actes de Spécialités,
  // Pharmacie, Imagerie, Analyses Médicale, Petite Chirurgie/Soins,
  // Hospitalisation, Ambulatoire...) — suit le taux plat du contrat, n'a
  // jamais eu besoin d'une ligne Garantie pour être légitime.
  return rubrique;
}
