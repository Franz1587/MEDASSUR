import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

export const chapitresMobile: GuideChapitre[] = [
  {
    id: "mobile-accueil",
    titre: "Accueil et connexion",
    sections: [
      {
        titre: "Connecter l’application mobile et accéder à son espace",
        texte: [
          "L’application mobile MedAssur est dédiée au compte assuré. Une fois installée, l’ouverture de l’application affiche l’écran de connexion, qui demande les mêmes identifiants que le portail web. Les comptes mobiles sont générés depuis le portail interne grâce au contrat de l’assuré principal.",
          "Après connexion, l’écran d’accueil présente les éléments les plus utiles au quotidien : votre carte, vos garanties, les remboursements, le réseau de soins, le carnet santé et la messagerie. C’est le point d’entrée le plus rapide pour la majorité des usages.",
          "Le mode hors ligne est également prévu pour certains parcours, et les notifications peuvent être activées pour être alerté de nouveaux messages ou demandes.",
        ],
        image: img("assure-01-dashboard.png"),
        etapes: [
          {
            titre: "Connexion",
            texte: "Renseignez votre email/matricule ou identifiant et votre mot de passe, puis validez. Le compte mobile est lié à votre contrat et à votre foyer.",
          },
          {
            titre: "Accueil",
            texte: "L’écran d’accueil ouvre directement les services les plus fréquents : carte d’assurance, prises en charge, remboursement, réseau de soins et e-carnet santé.",
          },
        ],
      },
    ],
  },
  {
    id: "mobile-ma-carte",
    titre: "Ma carte",
    sections: [
      {
        titre: "Consulter la carte d’assurance de votre foyer",
        texte: [
          "La section Ma carte affiche la carte de l’assuré principal ainsi que celles des ayants droit. Chaque carte indique le statut, le lien de parenté et les informations de couverture. Vous pouvez ouvrir la carte de manière détaillée et télécharger la version documentaire lorsqu’elle est disponible.",
          "C’est la bonne place pour vérifier si la couverture de votre foyer est active et si l’assuré concerné a bien son accès de soins effectif.",
        ],
        image: img("assure-02-ma-carte.png"),
      },
    ],
  },
  {
    id: "mobile-garanties",
    titre: "Mes garanties",
    sections: [
      {
        titre: "Suivre vos garanties et plafonds",
        texte: [
          "L’écran Mes garanties recense les garanties de votre contrat, avec le taux de remboursement, le plafond appliqué et la périodicité associée. La lecture est simple et destinée à donner immédiatement les informations utiles avant un soin.",
          "Vous pouvez y vérifier si une consultation, un acte, un traitement ou un examen est bien couvert et combien reste à votre charge selon les règles de votre contrat.",
        ],
        image: img("assure-03-garanties.png"),
      },
    ],
  },
  {
    id: "mobile-demandes",
    titre: "Demandes et remboursements",
    sections: [
      {
        titre: "Créer une demande de prise en charge ou de remboursement",
        texte: [
          "Depuis l’application mobile, vous pouvez créer une demande de prise en charge pour un traitement programmé ou une demande de remboursement quand vous avez déjà avancé les frais. Le formulaire guide la saisie avec les champs essentiels, puis vous pouvez joindre un document ou un devis si nécessaire.",
          "La liste des demandes montre le statut de chaque dossier : en attente, accordé, refusé ou rejeté. C’est le bon moyen pour suivre les décisions de l’assureur sans relancer le service par téléphone.",
        ],
        image: img("assure-04-prise-en-charge.png"),
      },
    ],
  },
  {
    id: "mobile-carnet",
    titre: "E-carnet santé",
    sections: [
      {
        titre: "Garder les documents de santé sur votre téléphone",
        texte: [
          "L’e-carnet santé permet de conserver les ordonnances, feuilles de soins, comptes rendus et autres justificatifs dans l’application. Vous pouvez ajouter des documents depuis votre galerie ou directement depuis l’appareil photo.",
          "Les documents sont classés par type et peuvent être consultés à tout moment. C’est utile pour retrouver rapidement un acte, une prescription ou un document de suivi sans chercher dans des dossiers papier.",
        ],
        image: img("assure-09-carnet-sante.png"),
      },
    ],
  },
  {
    id: "mobile-messagerie",
    titre: "Messagerie et profil",
    sections: [
      {
        titre: "Échanger rapidement et gérer vos paramètres",
        texte: [
          "La messagerie mobile permet d’échanger directement avec votre assureur ou avec le service concerné. Les notifications doivent être activées pour être sûr de recevoir les réponses rapidement et d’ouvrir immédiatement le message concerné.",
          "Le profil permet de consulter vos informations, modifier votre mot de passe et gérer votre signature électronique si celle-ci est requise pour les documents générés dans l’application.",
        ],
        image: img("assure-16-mon-profil.png"),
      },
    ],
  },
];
