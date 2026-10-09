import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

export const chapitresGlobal: GuideChapitre[] = [
  {
    id: "global-premiers-pas",
    titre: "Premiers pas",
    sections: [
      {
        titre: "Identifier votre compte et accéder au bon espace",
        texte: [
          "MEDASSUR+ propose un accès unique pour tous les profils : personnel interne, souscripteur, assuré, médecin, prestataire et super admin. La page de connexion demande votre email ou votre identifiant et votre mot de passe. Si vous êtes dans un portail externe, l’application reprend souvent votre profil fonctionnel directement après connexion et ouvre l’écran adapté à votre rôle.",
          "Avant de commencer, vérifiez que vous êtes bien connectés au bon espace. Le rôle affiché dans le coin supérieur droit de l’écran vous indique le type de compte actif. Si vous changez de contexte ou si votre compte donne accès à plusieurs profils, il faut relancer la connexion sur le bon environnement avant de lancer une action importante.",
          "Le bouton de profil permet ensuite de consulter vos informations, modifier votre mot de passe et enregistrer votre signature électronique si le rôle le nécessite.",
        ],
        image: img("01-dashboard.png"),
        etapes: [
          {
            titre: "Étape 1 — Saisir les identifiants",
            texte: "Entrez votre adresse email ou votre identifiant de compte, puis votre mot de passe. Vérifiez bien l’absence de majuscule ou de faute de frappe dans le login si le système refuse l’accès au premier essai.",
          },
          {
            titre: "Étape 2 — Vérifier le rôle actif",
            texte: "Après la connexion, regardez le libellé du rôle et l’avatar en haut à droite. Cela vous confirme que vous êtes bien dans le bon environnement — interne, assuré, client, médecin ou prestataire.",
          },
          {
            titre: "Étape 3 — Ouvrir votre profil",
            texte: "Cliquez sur votre avatar puis sur le menu Profil utilisateur pour vérifier vos informations, votre mot de passe et votre signature électronique. C’est aussi là que vous pouvez régler les éléments personnels utiles à vos documents.",
          },
        ],
      },
    ],
  },
  {
    id: "global-navigation",
    titre: "Navigation générale",
    sections: [
      {
        titre: "Comprendre les écrans, les filtres et les actions de base",
        texte: [
          "La navigation de MEDASSUR+ repose sur une barre latérale ou un menu principal, selon le profil. Chaque écran correspond à un module fonctionnel : Tableau de bord, Contrats, Patients, Prestations, Messagerie, Mon profil, Statistiques et gestion des dossiers selon les accès autorisés.",
          "Le bouton de recherche, les filtres de dates, les sélecteurs de contrat et les listes de résultats permettent de cibler rapidement un dossier. Les écrans de gestion sont conçus pour agir dans le bon ordre : créer, compléter, vérifier, enregistrer puis valider.",
          "Les notifications apparaissent dans le coin supérieur droit. Elles servent à signaler les nouveaux messages, les demandes arrivées, les dossiers en attente de traitement ou les changements importants sur un contrat ou un dossier patient.",
        ],
        image: img("medecin-01-dashboard.png"),
        etapes: [
          {
            titre: "Le menu latéral",
            texte: "Le menu regroupe les modules auxquels votre compte a accès. Il est la base de la navigation. Un écran n’est visible que si vous avez les droits suffisant pour le consulter ou le traiter.",
          },
          {
            titre: "Les filtres",
            texte: "Les écrans possèdent souvent des filtres, des recherches et des sélecteurs de période. Ils permettent de réduire la liste et d’aller directement au dossier concerné sans parcourir de longues tables.",
          },
          {
            titre: "Les actions rapides",
            texte: "Les boutons de création, d’export, d’édition, de suppression ou de téléchargement se trouvent en haut de liste ou dans le détail d’un dossier. Ils suivent presque toujours la même logique : créer, compléter, enregistrer et valider.",
          },
        ],
      },
    ],
  },
  {
    id: "global-interne",
    titre: "Espace interne / société",
    sections: [
      {
        titre: "Le cœur de la gestion opérationnelle",
        texte: [
          "L’espace interne est le centre de gestion de la société. Il regroupe le portefeuille, les souscripteurs, les contrats, les demandes, les règlements, les sinistres, les factures et les outils de suivi. C’est là que les gestionnaires créent les dossiers et valident les actes de production.",
          "Le Tableau de bord donne un état de santé global : production, portefeuille, encaissements, renouvellements et performance. Il sert de point de départ avant toute action opérationnelle ou de reporting.",
          "Les écrans de production — souscripteurs, population, contrats, renouvellements, avenants, factures et règlement — sont conçus pour être utilisés dans un ordre logique de gestion. Chaque action laisse une trace exploitable et peut être suivie dans les historiques.",
        ],
        image: img("03-contrats.png"),
      },
    ],
  },
  {
    id: "global-externes",
    titre: "Portails externes",
    sections: [
      {
        titre: "Le bon portail selon votre profil",
        texte: [
          "Les portails externes sont destinés aux différents acteurs du système : assuré, client/souscripteur, médecin prescripteur et prestataire. Chacun voit uniquement les écrans nécessaires à son rôle. Cela évite une surcharge inutile et aide à se concentrer sur ce qui doit être fait.",
          "L’assuré suit ses garanties, ses remboursements, son réseau de soins et ses demandes de prise en charge. Le client/souscripteur suit ses contrats, ses bénéficiaires, les demandes de changements de population et les statistiques. Le médecin traite sa file d’attente et rédige les ordonnances. Le prestataire saisi les prestations, les bons et les demandes de devis.",
          "Même si les écrans diffèrent, la logique est toujours la même : sélectionner un dossier, remplir les informations utiles, vérifier les montants, joindre les documents demandés, enregistrer puis envoyer ou valider.",
        ],
        image: img("assure-01-dashboard.png"),
      },
    ],
  },
  {
    id: "global-mobile",
    titre: "Application mobile",
    sections: [
      {
        titre: "Le même service, mobilisé au quotidien",
        texte: [
          "L’application mobile MEDASSUR+ est pensée pour les assurés, avec un accès simple aux documents, aux garanties, aux demandes de remboursement, à l’e-carnet santé et à la messagerie. Elle reste très proche de l’expérience web, mais a été optimisée pour le tactil et les écrans plus petits.",
          "Elle permet de consulter sa carte, de visualiser les garanties et de photographier un document médical directement depuis le téléphone. Elle facilite aussi l’accès aux bons et ordonnances, la possibilité de suivre une demande de remboursement et de consulter les faits de soins sans ouvrir le portail web sur un ordinateur.",
          "L’authentification mobile suit les mêmes règles que le portail web, et les notifications doivent être activées pour recevoir les alertes utiles sur les demandes et les réponses en attente.",
        ],
        image: img("assure-09-carnet-sante.png"),
      },
    ],
  },
];
