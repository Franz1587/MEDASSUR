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
  libelle?: string | null;
  famille: string;
  categorieGarantie: string | null;
}

// Famille de l'acte placeholder de reprise d'antériorité — même valeur
// que FAMILLE_REPRISE dans resolution-designation.util.ts, répliquée ici
// pour éviter une dépendance circulaire entre les utils.
const FAMILLE_REPRISE_UTIL = "ACTES REPRIS (ANCIEN SYSTÈME)";

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
  // Évacuation sanitaire AVANT Transport : "EVACUATION SANITAIRE" contient
  // "SANIT" qui ne doit pas matcher Hospitalisation avant d'avoir matché ici.
  { rubrique: "Évacuation Sanitaire", motsCles: ["EVASAN", "EVACUATION SANIT", "BILLET", "AVION", "AFRIJET"] },
  { rubrique: "Transport", motsCles: ["TRANSPORT", "AMBULANCE"] },
  { rubrique: "Orthophonie", motsCles: ["ORTHOPHON"] },
  { rubrique: "Orthoptie", motsCles: ["ORTHOPT"] },
  { rubrique: "Hospitalisation", motsCles: ["HOSPI", "HOPSI", "HOPITAL", "CHIRURGIE MAJEURE", "CHAMBRE", "SEJOUR", "NUITEE"] },
  { rubrique: "Pharmacie", motsCles: ["PHARMA", "MEDICAMENT"] },
  { rubrique: "Analyses Médicale", motsCles: ["ANALYS", "LABO", "BIOLOG", "BACTERIO", "PARASITO", "BIOCHIM", "HEMATO", "SEROLO", "VIROLO", "COAGUL", "TYPAGE", "EXAMEN", "PRELEV"] },
  { rubrique: "Imagerie", motsCles: ["IMAGERIE", "RADIO", "ECHOGRAPH", "SCANNER", "IRM"] },
  // Consultations avant Actes de Spécialités : "CS OPHTALMOLOGUE" ou
  // "CONSULTATION SPECIALISTE" sont des consultations, pas des actes. "CS"
  // est l'abréviation gabonaise standard pour "consultation spécialiste".
  { rubrique: "Consultations", motsCles: ["CONSULT", "VISITE", " CS "] },
  // "SPECIALIT" sans "CONSULT" devant → acte (plateau technique, interventions).
  { rubrique: "Actes de Spécialités", motsCles: ["SPECIALIT"] },
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

// Spécialité du prestataire → rubrique (2026-09) — voir demande
// utilisateur : "l'optique souvent traduit en frais d'optique ou verre et
// monture n'apparaît pas dans la statistique de DGDI." Les fichiers repris
// typent l'essentiel des soins d'un opticien ou d'un dentiste en "ACTES
// AMBULATOIRES" (mesuré en prod : 1 477 lignes chez des Opticiens, 297 chez
// des Cabinets Dentaires) — seule la SPÉCIALITÉ du prestataire porte alors
// la vraie rubrique. Basé sur Prestataire.type (fiable), jamais sur le nom
// ("CARREFOUR DE LA VISION" est un ophtalmologue : ses consultations
// restent des Consultations).
const RUBRIQUE_PAR_TYPE_PRESTATAIRE: Record<string, string> = {
  Opticien: "Optique",
  "Cabinet Dentaire": "Dentisterie",
  "Centre de Kinésithérapie": "Kinésithérapie & Cure thermale",
  Laboratoire: "Analyses Médicale",
  "Centre d'Imagerie": "Imagerie",
  Pharmacie: "Pharmacie",
  "Dépôt pharmaceutique": "Pharmacie",
};
// Seules ces rubriques "fourre-tout" cèdent la place à la spécialité du
// prestataire — une rubrique déjà précise (Hospitalisation, Pharmacie,
// Imagerie chez un dentiste...) n'est jamais écrasée.
const RUBRIQUES_GENERIQUES = new Set(["Ambulatoire", "Consultations", "Actes de Spécialités", "Petite Chirurgie/Soins", "Autre", "Non précisé"]);

export function resoudreRubriqueContrat(
  garantiesContrat: { categorie: string }[],
  ligne: { type: string; prestataireType?: string | null; prestataire?: string | null },
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
  let rubrique = candidat ? normaliserRubrique(candidat) : "Non précisé";
  const rubriquePrestataire = ligne.prestataireType ? RUBRIQUE_PAR_TYPE_PRESTATAIRE[ligne.prestataireType] : undefined;
  if (rubriquePrestataire && RUBRIQUES_GENERIQUES.has(rubrique)) rubrique = rubriquePrestataire;
  // Cascade de précision pour toutes les rubriques génériques (2026-11) —
  // voir demande utilisateur : "une consultation ophtalmologique est
  // appelée actes de spécialité... il y a beaucoup de problème dans ce
  // sens." Les actes importés avec famille="DIVERS" ont souvent une
  // categorieGarantie précise (ex. "Optique", "Consultations
  // ophtalmologie", "Soins dentaires") que resoudreRubriqueContrat
  // ignorait car famille=DIVERS bloquait l'accès à categorieActe.
  // S'applique à toutes les rubriques RUBRIQUES_GENERIQUES (pas seulement
  // "Ambulatoire") : "ACTES DE SPECIALITES" → "Actes de Spécialités"
  // (générique) peut et doit céder la place à "Consultations" si
  // categorieGarantie dit "Consultations ophtalmologie".
  // Ordre : libellé de l'acte > categorieGarantie (si pas DIVERS) >
  // famille (si pas DIVERS) > categorieGarantie (même DIVERS) >
  // "Consultations" (si Ambulatoire en dernier recours).
  if (RUBRIQUES_GENERIQUES.has(rubrique) && acteInfo) {
    const tenter = (v: string): string | null => {
      const r = normaliserRubrique(v);
      return !RUBRIQUES_GENERIQUES.has(r) && r !== "Non précisé" ? r : null;
    };
    const estDivers = acteInfo.famille === FAMILLE_REPRISE_UTIL
      || acteInfo.famille.trim().toUpperCase() === "DIVERS";
    // Pour les actes DIVERS / reprise d'antériorité, categorieGarantie est
    // souvent "Consultation/Divers" (fourre-tout) — l'utiliser écraserait
    // "ACTES DE SPECIALITES" → "Consultations" à tort et briserait le
    // groupement par facture (doublons). Seuls les actes catalogue réels
    // (non-DIVERS) bénéficient de la cascade libelle→catégorie→famille.
    if (!estDivers) {
      if (acteInfo.libelle) { const r = tenter(acteInfo.libelle); if (r) rubrique = r; }
      if (RUBRIQUES_GENERIQUES.has(rubrique) && acteInfo.categorieGarantie) {
        const r = tenter(acteInfo.categorieGarantie); if (r) rubrique = r;
      }
      if (RUBRIQUES_GENERIQUES.has(rubrique)) {
        const r = tenter(acteInfo.famille); if (r) rubrique = r;
      }
    }
  }
  // Nom du prestataire en dernier recours ("PHARMACIE DU CENTRE" sans
  // prestataireType renseigné) — avant le fallback "Consultations".
  // Guard strict : on n'accepte QUE si le résultat est une rubrique
  // canonique connue ; sinon normaliserRubrique retourne le nom brut du
  // prestataire ("CLINIQUE EL RAPHA" → "CLINIQUE EL RAPHA") qui passerait
  // !RUBRIQUES_GENERIQUES.has() et deviendrait la rubrique — créant autant
  // de pseudo-rubriques que de prestataires inconnus.
  if (RUBRIQUES_GENERIQUES.has(rubrique) && ligne.prestataire) {
    const r = normaliserRubrique(ligne.prestataire);
    if (RUBRIQUES_CANONIQUES.some((rc) => rc.rubrique === r)) rubrique = r;
  }
  if (rubrique === "Ambulatoire") rubrique = "Consultations";
  if (rubrique === "Non précisé") return rubrique;

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
