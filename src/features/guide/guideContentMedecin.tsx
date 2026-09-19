import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

// Guide d'utilisateur — portail Médecin prescripteur (2026-09), voir
// guideContent.tsx pour les conventions générales. Un chapitre = une entrée
// du menu latéral du portail médecin (voir src/auth/roles.ts, rôle
// "medecin_prescripteur"). Contenu construit à partir d'une lecture
// exhaustive du code source de chaque écran (src/features/portail-medecin/,
// src/portals/MonProfilModal.tsx, src/components/shared/SignatureManager.tsx)
// et de VRAIES captures du compte de démonstration (Dr Alice Mba, CHU
// Libreville) — jamais des maquettes.
export const chapitresMedecin: GuideChapitre[] = [
  {
    id: "medecinDashboard",
    titre: "Tableau de bord",
    sections: [
      {
        titre: "Vue d'ensemble de votre activité",
        texte: [
          "Le Tableau de Bord est l'écran d'accueil de votre compte médecin. Il rappelle votre identité (titre, nom, spécialité) et affiche trois raccourcis vers vos écrans principaux — « File d'attente » (avec le nombre de patients actuellement en attente), « Mes Dossiers Patients » et « Historique des prestations » — cliquer sur une carte vous y emmène directement.",
          "Quatre compteurs résument votre activité : le nombre de « Patients suivis » (patients distincts pour lesquels vous avez déjà rédigé au moins une prescription), le nombre total de « Consultations », le nombre de consultations « Ce mois-ci » et le nombre de « Lignes en attente » (médicaments ou examens que vous avez prescrits mais qu'aucun prestataire n'a encore traités/délivrés).",
          "Un dernier encadré « Vos structures » liste le ou les établissements (hôpital, clinique, cabinet) auxquels vous êtes rattaché — c'est dans ces structures que sont recherchées les consultations qui alimentent votre file d'attente.",
        ],
        image: img("medecin-01-dashboard.png"),
      },
    ],
  },

  {
    id: "medecinFileAttente",
    titre: "File d'attente",
    sections: [
      {
        titre: "Les assurés qui vous attendent, sans jamais les rechercher vous-même",
        texte: [
          "C'est l'écran central de votre compte : contrairement à un gestionnaire interne, vous n'avez jamais à identifier ou rechercher un assuré vous-même. Dès qu'une structure à laquelle vous êtes rattaché facture une consultation qui vous est destinée (écran « Nouvelle prestation » côté prestataire) et que cette consultation n'a pas encore de prescription, elle apparaît automatiquement ici, dans l'ordre où elle a été facturée.",
          "Chaque ligne de la file affiche le nom de l'assuré, le type d'acte et sa date, ainsi que la structure d'où provient la consultation (utile si vous intervenez dans plusieurs établissements). Quand la file est vide, l'écran affiche simplement « Aucun patient en attente pour l'instant » — c'est l'état normal tant qu'aucune structure ne vous a envoyé de nouvelle consultation.",
        ],
        image: img("medecin-02-file-attente.png"),
        etapes: [
          {
            titre: "Recevoir un patient",
            texte: "Cliquez sur la ligne du patient à recevoir (bouton « Consulter » à droite) — vous êtes immédiatement redirigé vers l'écran « Consultation » avec ce patient déjà chargé : son identité, sa structure et l'acte facturé sont repris automatiquement, vous n'avez qu'à rédiger le dossier clinique et l'ordonnance.",
          },
        ],
      },
    ],
  },

  {
    id: "prestataireMedecinPrescripteur",
    titre: "Consultation",
    sections: [
      {
        titre: "Rédiger le dossier clinique et l'e-ordonnance",
        texte: [
          "Cet écran ne peut s'ouvrir qu'après avoir choisi un patient depuis la « File d'attente » — y accéder directement, sans patient sélectionné, affiche seulement une invite à retourner à la file d'attente. Une fois un patient chargé, sa fiche (nom, matricule, acte, date, structure) reste affichée en haut pendant toute la consultation.",
        ],
        image: img("medecin-03-consultation-vide.png"),
        etapes: [
          {
            titre: "Renseigner le dossier clinique",
            texte: "Dans « Motifs de consultation » (obligatoire), recherchez un motif dans la liste proposée ou saisissez-en un personnalisé dans le champ « Ou saisir un motif personnalisé… » puis cliquez sur « Ajouter » — chaque motif ajouté apparaît sous forme d'étiquette retirable (croix). Renseignez ensuite, si besoin, le « Code affection (CNAMGS) » via une recherche à la frappe (code + libellé).",
          },
          {
            titre: "Rédiger l'e-ordonnance (médicaments)",
            texte: "Dans « E-ordonnance (médicaments) », recherchez un médicament du catalogue des actes médicaux et sélectionnez-le : une ligne apparaît avec un champ « Posologie » et une quantité. Si une posologie est déjà connue pour ce médicament (l'IA de l'application la propose automatiquement en fonction du médicament et du patient, le temps d'un court chargement affiché « Suggestion IA en cours… »), elle se pré-remplit seule — vous restez libre de la modifier ou de la remplacer entièrement, ce n'est jamais une valeur imposée. Ajustez la quantité si nécessaire, et retirez une ligne avec l'icône corbeille.",
          },
          {
            titre: "Prescrire un bon d'examen",
            texte: "Dans « Bon d'examen », recherchez de la même façon un acte d'analyse, d'imagerie ou de spécialité, et ajoutez-le — pas de posologie ici, seulement une quantité.",
            image: img("medecin-04-consultation-ordonnance.png"),
          },
          {
            titre: "Valider la prescription",
            texte: "Cliquez sur « Enregistrer la prescription » (au moins un motif et au moins une ligne médicament/examen sont exigés). La prescription est immédiatement enregistrée et deux documents peuvent alors être générés selon son contenu : la « Feuille de Soins » (numérotée FS-…, pour les médicaments — à présenter en pharmacie) et le « Bon d'examen » (pour les analyses/imagerie — à présenter au laboratoire ou au service d'imagerie), chacun avec son propre bouton « Imprimer ». Sur ces documents, les prix des médicaments et la quote-part de l'assuré restent volontairement masqués côté médecin — vous ne voyez jamais les tarifs de la pharmacie.",
          },
        ],
      },
    ],
  },

  {
    id: "medecinDossiersPatients",
    titre: "Mes Dossiers Patients",
    sections: [
      {
        titre: "Retrouver l'historique médical complet d'un patient déjà reçu",
        texte: [
          "Cet écran regroupe, pour chaque patient que vous avez déjà consulté, l'ensemble de ses prescriptions passées — c'est votre carnet de suivi patient par patient. Le tableau liste chaque patient avec son nombre de consultations et la date de sa dernière visite ; une recherche à la frappe (nom, matricule) permet de le retrouver directement dans les cas où la liste est longue.",
        ],
        image: img("medecin-05-dossiers-patients.png"),
        etapes: [
          {
            titre: "Ouvrir un dossier",
            texte: "Cliquez sur une ligne du tableau (ou sur « Ouvrir le dossier ») pour afficher le dossier complet du patient : ses consultations sont classées par année (les plus récentes en premier), et pour chacune apparaissent la date, l'acte, les motifs de consultation, le code affection, le détail des lignes prescrites (médicament ou examen, avec sa posologie et son statut « Traité »/« Partiellement traité »/« En attente »), et les boutons pour réimprimer la feuille de soins ou le bon d'examen correspondants.",
            image: img("medecin-06-dossier-detail.png"),
          },
        ],
      },
    ],
  },

  {
    id: "medecinHistoriquePrestations",
    titre: "Historique des prestations",
    sections: [
      {
        titre: "Toutes vos consultations, en une seule liste chronologique",
        texte: [
          "Contrairement à « Mes Dossiers Patients » (qui organise l'information par patient), cet écran liste chronologiquement toutes vos consultations, groupées par année, avec pour chacune la date, le patient, la structure d'origine, les motifs, le nombre de lignes médicament/examen, un statut global du bon (Non traité/Partiellement traité/Traité) et un accès direct aux documents générés (feuille de soins, bon d'examen). Une recherche par nom ou matricule filtre instantanément la liste.",
        ],
        image: img("medecin-07-historique-prestations.png"),
      },
    ],
  },

  {
    id: "messagerie",
    titre: "Messagerie",
    sections: [
      {
        titre: "Échanger directement avec MedAssur",
        texte: [
          "La « Messagerie » vous permet d'ouvrir une conversation directe avec MedAssur — utile pour toute question qui ne relève pas d'un dossier patient (support, question administrative…). Contrairement à la messagerie interne, il n'y a pas ici de distinction « File d'attente »/« Mes conversations » : vous voyez directement la liste de vos propres conversations.",
        ],
        image: img("medecin-08-messagerie.png"),
        etapes: [
          {
            titre: "Ouvrir une conversation",
            texte: "Cliquez sur « Nouvelle conversation », renseignez un Objet et votre Message, puis « Envoyer ». Votre message est automatiquement pris en charge par l'assistant (identifié « Ariana ») ; si la demande dépasse ce que l'assistant peut traiter, un conseiller humain prend le relais de façon transparente, sans que l'identité de votre interlocuteur ne change à l'écran.",
          },
          {
            titre: "Poursuivre l'échange",
            texte: "Sélectionnez une conversation dans la liste de gauche pour afficher les messages échangés et répondre depuis le champ en bas de l'écran ; une pièce jointe peut être ajoutée via le trombone. La liste se rafraîchit automatiquement toutes les 15 secondes pour faire apparaître les nouvelles réponses.",
          },
        ],
      },
    ],
  },

  {
    id: "mon-profil",
    titre: "Mon profil",
    sections: [
      {
        titre: "Vos informations, votre mot de passe et votre signature électronique",
        texte: [
          "Le popover « Mon profil » s'ouvre en cliquant sur votre avatar (initiales) en haut à droite de l'écran. Il regroupe trois blocs : vos informations personnelles, le changement de mot de passe, et la gestion de votre signature électronique — cette dernière n'apparaît jamais sur l'écran d'accueil, uniquement ici.",
          "Dans le bloc « Informations », vous pouvez modifier votre Nom, votre Téléphone et votre Adresse puis cliquer sur « Enregistrer » ; l'Email (identifiant de connexion) et le Rôle sont affichés mais non modifiables depuis cet écran.",
          "Dans « Changer de mot de passe », renseignez votre Mot de passe actuel puis le Nouveau mot de passe (au moins 8 caractères) et sa Confirmation, puis cliquez sur « Changer le mot de passe ».",
        ],
        image: img("medecin-09-mon-profil.png"),
        etapes: [
          {
            titre: "Ajouter votre signature électronique",
            texte: "Dans la section « Signature électronique », deux méthodes sont proposées : « Charger un fichier » (une image de votre signature, depuis votre ordinateur) ou « Signer depuis mon téléphone » (un QR code s'affiche à l'écran ; en le scannant avec votre téléphone, vous signez sur son écran tactile et la signature s'enregistre automatiquement dans votre compte quelques secondes plus tard, sans rafraîchir la page). Une fois enregistrée, un bouton « Supprimer » permet de la retirer.",
          },
          {
            titre: "Où cette signature est-elle utilisée",
            texte: "Votre signature n'est pas décorative : elle est dessinée automatiquement, à l'emplacement « Signature et cachet du praticien », sur les documents que vous générez depuis vos prescriptions — la Feuille de Soins et le Bon d'examen. Tant qu'aucune signature n'est enregistrée, cet emplacement reste simplement vide sur le document imprimé.",
          },
        ],
      },
    ],
  },
];
