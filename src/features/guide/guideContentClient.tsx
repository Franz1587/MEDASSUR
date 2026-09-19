import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

// Guide d'utilisateur — portail Client/Souscripteur (2026-09), voir
// guideContent.tsx pour les conventions générales. Un chapitre = une entrée
// du menu latéral du portail client (voir src/auth/roles.ts, rôles
// "client_particulier"/"client_entreprise", et src/layout/navConfig.ts pour
// les libellés). Contenu construit à partir d'une lecture exhaustive du code
// source de chaque écran (src/features/portail-client/*.tsx) et de VRAIES
// captures de l'application, compte de démonstration SEEG (client_entreprise,
// 2 contrats, 8 bénéficiaires) — voir src/assets/guide/client-*.png. Les deux
// rôles du portail client (particulier/entreprise) partagent exactement les
// mêmes écrans (même liste allowedModules) ; seul le contenu réel diffère
// (un particulier a en général un seul contrat et une seule famille, une
// entreprise plusieurs), ce que le texte précise sans jamais s'appuyer sur
// un chiffre figé du compte de démonstration.
export const chapitresClient: GuideChapitre[] = [
  // ══════════════════════════ TABLEAU DE BORD ══════════════════════════
  {
    id: "portailDashboard",
    titre: "Tableau de bord",
    sections: [
      {
        titre: "Vue d'ensemble de votre contrat maladie",
        texte: [
          "Le Tableau de bord est l'écran d'accueil de l'Espace Client. Il affiche deux compteurs d'accès rapide — « Contrats » (nombre de polices en cours) et « Participants » (nombre total de bénéficiaires, assurés principaux et ayants droit confondus) — cliquer sur l'une de ces cartes ouvre directement l'écran correspondant (« Mes contrats » ou « Mes Bénéficiaires »).",
          "En dessous, le bloc « Prises en charge par rubrique » compte le nombre de dossiers de prise en charge de votre contrat, répartis par rubrique de garantie (Hospitalisation, Optique, Pharmacie…). Le sélecteur d'année en haut à droite change l'exercice affiché, et les boutons « Par an » / « Par mois » basculent entre un graphique en barres horizontales (une barre par rubrique, sur l'année choisie) et un graphique empilé mois par mois.",
          "Si aucun contrat n'est encore rattaché à votre compte, ou si aucune prise en charge n'a encore été enregistrée, l'écran l'indique clairement plutôt que d'afficher un graphique vide.",
        ],
        image: img("client-01-dashboard.png"),
      },
    ],
  },

  // ══════════════════════════ MES CONTRATS ══════════════════════════
  {
    id: "portailContrats",
    titre: "Mes contrats",
    sections: [
      {
        titre: "Consulter la liste de vos polices",
        texte: [
          "L'écran « Mes contrats » liste toutes les polices maladie et assistance rattachées à votre compte : référence (numéro de police), branche, compagnie, statut (Actif, En renouvellement…) et date d'effet. Un client particulier n'y voit généralement qu'un seul contrat ; une entreprise peut en avoir plusieurs (par exemple un contrat Maladie et un contrat Assistance liés).",
          "Cliquer n'importe où sur une ligne — ou sur l'icône en forme d'œil — ouvre une page dédiée avec le détail complet du contrat.",
        ],
        image: img("client-02-contrats.png"),
        etapes: [
          {
            titre: "Onglet « Général »",
            texte: "Affiche les informations contractuelles : branche, statut, type d'affaire, dates d'effet et d'échéance, périodicité, prime, numéro de l'exercice en cours et compagnie. En dessous, le tableau des garanties liste chaque rubrique couverte avec son taux assuré, son taux ayants droit et son plafond (montant ou mention libre) — le tableau indique « Aucune garantie renseignée » si le contrat n'en a pas encore.",
            image: img("client-03-contrat-detail-general.png"),
          },
          {
            titre: "Onglet « Mouvements »",
            texte: "Retrace l'historique du contrat sous forme de liste dépliable : la mise en place initiale (« Affaire Nouvelle », toujours en premier) puis chaque avenant appliqué (ajustement de prime, incorporation, retrait, renouvellement…) avec son statut (Brouillon/Validé/Appliqué), sa description, la prime après l'avenant et sa date d'effet. Cliquer sur une ligne la déplie : pour la mise en place du contrat, deux boutons permettent de télécharger la « Quittance » et le « Tableau de garanties » ; pour un avenant, deux boutons équivalents téléchargent la « Quittance avenant » et l'« Avenant » lui-même, et si l'avenant portait sur des personnes (incorporation/retrait), la liste des bénéficiaires concernés apparaît avec une icône verte (incorporation) ou orange (retrait).",
            image: img("client-04-contrat-detail-mouvements.png"),
          },
          {
            titre: "Onglet « Factures de production »",
            texte: "Liste les factures de prime émises sur ce contrat (numéro, date d'émission, objet, montant, statut Réglée/En attente), avec un bouton de téléchargement par ligne. L'écran indique « Aucune facture de production émise pour ce contrat » tant qu'aucune n'a été émise.",
          },
          {
            titre: "Onglet « Données par exercice »",
            texte: "Récapitule, exercice par exercice, la période couverte, la périodicité, la prime, la compagnie et le statut (Actif ou clos) — utile pour retrouver les conditions d'un ancien exercice, par exemple en cas de reprise d'historique.",
          },
          {
            titre: "Revenir à la liste",
            texte: "Le lien « Retour à mes contrats » en haut de la page ramène à la liste sans perdre l'onglet actif si vous rouvrez le même contrat.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ MES BÉNÉFICIAIRES ══════════════════════════
  {
    id: "portailParticipants",
    titre: "Mes Bénéficiaires",
    sections: [
      {
        titre: "Consulter vos bénéficiaires, regroupés par famille",
        texte: [
          "« Mes Bénéficiaires » liste toutes les personnes couvertes par vos contrats, regroupées par famille : chaque ligne principale est un assuré principal, avec le nombre de ses ayants droit (conjoint, enfants). Une flèche à gauche du nom déplie la famille directement dans le tableau pour voir chaque ayant droit sans quitter la liste.",
          "Le champ de recherche filtre par nom ou matricule ; si la recherche ne trouve qu'un ayant droit, sa famille se déplie automatiquement pour le montrer. Quand votre compte a plusieurs contrats, un menu déroulant permet de restreindre la liste à un seul contrat (« Tous mes contrats » par défaut).",
          "Côté statut, le portail simplifie volontairement les nuances de gestion interne : une personne y apparaît seulement « Actif » ou « Retiré ».",
        ],
        image: img("client-05-beneficiaires.png"),
        etapes: [
          {
            titre: "Ouvrir la fiche complète d'une famille",
            texte: "Cliquez sur une ligne (ou sur l'icône en forme d'œil) pour ouvrir une fenêtre avec la fiche détaillée de l'assuré principal puis de chacun de ses ayants droit : photo (si elle a été téléchargée), matricule, numéro d'assuré, date de naissance et âge calculé, sexe, statut de la carte, date d'affiliation, téléphone (celui de l'assuré principal est repris pour ses ayants droit), adresse, et selon le cas le statut matrimonial (assuré principal) ou la scolarisation (enfant). Le bouton « Fermer » referme la fiche.",
            image: img("client-06-beneficiaire-fiche-famille.png"),
          },
          {
            titre: "Télécharger la liste des bénéficiaires",
            texte: "Le bouton « Télécharger la liste » (désactivé tant qu'aucun contrat n'est sélectionné, sauf si vous n'en avez qu'un seul) ouvre un menu à trois choix : « Liste complète », « Bénéficiaires actifs uniquement » ou « Bénéficiaires retirés uniquement ». Le document généré correspond au contrat filtré (ou à votre unique contrat).",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ MES DEMANDES ══════════════════════════
  {
    id: "portailDemandes",
    titre: "Mes demandes",
    sections: [
      {
        titre: "Demander une incorporation ou un retrait",
        texte: [
          "« Mes demandes » est le canal officiel pour signaler un mouvement de population sur votre contrat : ajouter un nouveau bénéficiaire (incorporation) ou en retirer un (retrait). La validation finale reste entre les mains du gestionnaire côté assurance — votre demande reste au statut « En attente » jusqu'à ce qu'il l'accepte (« Accordée ») ou la refuse (« Refusée », avec un motif affiché sous le badge).",
          "Le tableau liste toutes vos demandes passées avec leur type, le ou les bénéficiaires concernés, le contrat, la date et le statut.",
        ],
        image: img("client-07-demandes.png"),
        etapes: [
          {
            titre: "Démarrer une incorporation",
            texte: "Cliquez sur « Nouvelle demande », laissez le type sur « Incorporation », choisissez le Contrat concerné et la Date de la demande. Dans le bloc « Ajouter un bénéficiaire », choisissez le Lien avec l'assuré (Assuré principal, Conjoint ou Enfant) ; pour un conjoint ou un enfant, indiquez aussi la Famille d'accueil (un assuré principal déjà sur le contrat, ou celui que vous venez d'ajouter dans cette même demande si elle en comporte un). Complétez Nom, Prénom, Date de naissance, Sexe, Téléphone, Adresse, et une Photo si vous en avez une (utilisée pour la carte d'assurance). Cliquez sur « Ajouter à la liste » — vous pouvez répéter l'opération pour incorporer plusieurs personnes (par exemple un assuré principal et ses ayants droit) en une seule demande.",
            image: img("client-08-demande-nouvelle-incorporation.png"),
          },
          {
            titre: "Démarrer un retrait",
            texte: "Cliquez sur le bouton « Retrait » en haut du formulaire, choisissez le Contrat puis recherchez le Bénéficiaire à retirer parmi les personnes déjà présentes sur ce contrat, et précisez si besoin le Motif du retrait (ex. « Départ de l'entreprise »).",
            image: img("client-09-demande-nouvelle-retrait.png"),
          },
          {
            titre: "Envoyer la demande",
            texte: "Une fois le formulaire complet, cliquez sur « Envoyer la demande ». Elle apparaît aussitôt dans le tableau avec le statut « En attente » ; un message de confirmation rappelle qu'elle est soumise à la décision du gestionnaire.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ RÉSEAU DE SOINS ══════════════════════════
  {
    id: "portailReseauSoins",
    titre: "Réseau de soins",
    sections: [
      {
        titre: "Trouver un prestataire conventionné",
        texte: [
          "« Réseau de soins » liste tous les prestataires médicaux conventionnés (cliniques, hôpitaux, pharmacies, médecins…), rangés par type puis par ville, sous forme de sections dépliables. Deux menus déroulants filtrent par type et par ville, et un champ de recherche filtre par nom ou spécialité.",
          "Un badge « Public »/« Privé » indique le secteur du prestataire, et une icône de localisation apparaît quand ses coordonnées GPS sont connues.",
        ],
        image: img("client-10-reseau-soins.png"),
        etapes: [
          {
            titre: "Voir la fiche d'un prestataire",
            texte: "Cliquez sur un prestataire pour ouvrir sa fiche : adresse, téléphone, secteur, et si les coordonnées GPS sont renseignées, une carte interactive intégrée à l'application (pas de renvoi vers un site externe) centrée sur son emplacement. Pour un établissement (pas un médecin seul), la fiche liste aussi les médecins qui y interviennent avec leur spécialité.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ PROCÉDURES ══════════════════════════
  {
    id: "portailReglesConsignes",
    titre: "Procédures",
    sections: [
      {
        titre: "Consulter les règles d'utilisation de votre assurance",
        texte: [
          "« Procédures » reprend, en lecture seule, les règles et consignes publiées par votre assureur (par exemple les délais pour une demande d'entente préalable). Chaque règle affiche son titre et son contenu ; si un document a été joint par l'assurance, un lien « Document joint » permet de le télécharger.",
          "Ce contenu est le même pour tous les clients de la société d'assurance (il n'est pas propre à votre contrat) — il vient de la même rubrique gérée côté interne, diffusée ici en lecture seule.",
        ],
        image: img("client-11-procedures.png"),
      },
    ],
  },

  // ══════════════════════════ UTILISATEURS & DROITS ══════════════════════════
  {
    id: "portailUtilisateurs",
    titre: "Utilisateurs & droits",
    sections: [
      {
        titre: "Donner accès au portail à vos collaborateurs",
        texte: [
          "Cet écran permet à une entreprise cliente de créer d'autres comptes du portail pour ses propres collaborateurs (par exemple une personne des ressources humaines) et de choisir, rubrique par rubrique, à quels écrans du menu chacun a accès. Un utilisateur ne peut jamais accorder une rubrique à laquelle il n'a pas lui-même accès — la règle est vérifiée aussi côté serveur.",
          "Le tableau liste chaque utilisateur du portail rattaché à votre compte, son email et le nombre de rubriques qui lui sont accordées (sur le total possible).",
        ],
        image: img("client-12-utilisateurs.png"),
        etapes: [
          {
            titre: "Créer un utilisateur",
            texte: "Cliquez sur « Nouvel utilisateur ». Renseignez le Nom complet, les Initiales, le Téléphone (facultatif), l'Email et un Mot de passe initial (6 caractères minimum). Cochez ensuite, dans la liste « Rubriques accessibles », chaque écran du menu que ce nouvel utilisateur pourra voir — seules les rubriques que vous détenez vous-même sont proposées. Cliquez sur « Créer ».",
            image: img("client-13-utilisateur-nouveau.png"),
          },
          {
            titre: "Modifier les droits d'un utilisateur existant",
            texte: "Cliquez sur « Droits » sur la ligne de l'utilisateur concerné : une fenêtre liste toutes les rubriques du portail, cochées ou non selon ses accès actuels. Les rubriques que vous ne détenez pas vous-même sont grisées et marquées « Non accordable ». Cochez ou décochez, puis cliquez sur « Enregistrer ».",
            image: img("client-14-utilisateur-droits.png"),
          },
          {
            titre: "Supprimer un utilisateur",
            texte: "Cliquez sur l'icône de corbeille sur sa ligne (indisponible sur votre propre compte, repéré par la mention « (vous) ») puis confirmez.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ MESSAGERIE ══════════════════════════
  {
    id: "messagerie",
    titre: "Messagerie",
    sections: [
      {
        titre: "Échanger directement avec votre assureur",
        texte: [
          "La Messagerie permet d'ouvrir une conversation directement depuis l'application, sans passer par le téléphone ou l'email. Contrairement à l'écran interne, il n'y a pas de « file d'attente » côté client : la colonne de gauche liste simplement toutes vos conversations, avec leur statut (Ouverte, En cours, Résolue, Fermée).",
          "Toute conversation démarre avec « Ariana », votre conseillère clientèle — vos messages sont d'abord traités automatiquement, et basculent si besoin vers un vrai conseiller humain sans que cela change l'interlocuteur affiché ni l'organisation de l'écran.",
          "La liste se met à jour automatiquement toutes les 15 secondes, y compris pendant que vous lisez une conversation.",
        ],
        image: img("client-15-messagerie.png"),
        etapes: [
          {
            titre: "Démarrer une conversation",
            texte: "Cliquez sur « Nouvelle conversation », renseignez un Objet (ex. « Question sur ma prise en charge ») et votre premier Message, puis « Envoyer ». La conversation apparaît aussitôt dans la liste et s'ouvre.",
          },
          {
            titre: "Répondre",
            texte: "Sélectionnez une conversation dans la liste, tapez votre message dans la zone de texte en bas (Entrée envoie, Maj+Entrée insère un saut de ligne) et validez avec le bouton d'envoi. L'icône de trombone permet de joindre un fichier.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ STATISTIQUES ══════════════════════════
  {
    id: "portailStatistiques",
    titre: "Statistiques",
    sections: [
      {
        titre: "Analyser la consommation de votre contrat",
        texte: [
          "« Statistiques » est la version allégée, réservée à votre seul contrat, du module de statistiques interne : mêmes calculs, mais sans les rubriques réservées à la gestion de l'assureur (analyse stratégique). Choisissez un Contrat, une période (Date de début / Date de fin, facultatives) puis cliquez sur « Rechercher » pour charger les chiffres — les onglets restent toujours visibles, même avant la première recherche.",
          "Sept onglets horizontaux se partagent les rubriques : Consommation par mois, par Famille, Top 20 des Consommateurs, par Type Bénéficiaire, par Prestataire, par Rubrique, et Évolution du S/P (sinistres/primes).",
        ],
        image: img("client-16-statistiques.png"),
        etapes: [
          {
            titre: "Consommation par mois",
            texte: "Affiche le montant total consommé et la moyenne mensuelle sur la période, un tableau mois par mois et le graphique en barres correspondant.",
          },
          {
            titre: "Consommation par Famille / Top 20 des Consommateurs",
            texte: "Liste chaque famille (ou les 20 plus gros consommateurs) avec son matricule et le montant consommé ; un champ de recherche filtre par matricule ou nom, et un graphique en barres reprend les montants filtrés.",
          },
          {
            titre: "Consommation par Type Bénéficiaire / par Rubrique / par Prestataire",
            texte: "Chacune de ces rubriques croise le montant consommé avec, respectivement, le type de bénéficiaire (assuré principal/conjoint/enfant), la rubrique de garantie ou le prestataire visité — tableau à gauche, camembert (avec légende en pourcentage) à droite.",
          },
          {
            titre: "Évolution du S/P",
            texte: "Affiche le ratio Sinistres/Primes (S/P), avec et sans chargement, sous forme de deux cartes chiffrées (sinistres, primes, ratio, tranche, taux de régularisation) puis d'un graphique comparatif.",
          },
          {
            titre: "Télécharger le rapport",
            texte: "Le bouton « Télécharger PDF » (à côté de « Rechercher ») génère un document reprenant ces statistiques pour le contrat et la période sélectionnés.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ MON PROFIL ══════════════════════════
  {
    id: "mon-profil",
    titre: "Mon profil",
    sections: [
      {
        titre: "Gérer vos informations, votre mot de passe et votre signature",
        texte: [
          "Cliquez sur votre pastille (initiales) en haut à droite de l'écran, puis sur « Mon profil » pour ouvrir cette fenêtre — accessible depuis n'importe quel écran du portail.",
          "La première section affiche vos informations : Nom (modifiable), Email (non modifiable — c'est votre identifiant de connexion), Téléphone, Rôle (non modifiable) et Adresse. Modifiez les champs voulus puis cliquez sur « Enregistrer ».",
          "La section « Changer de mot de passe » demande le mot de passe actuel puis le nouveau (au moins 8 caractères) et sa confirmation ; cliquez sur « Changer le mot de passe ». Une erreur s'affiche si le mot de passe actuel est incorrect ou si la confirmation ne correspond pas.",
          "La section « Signature électronique » permet d'associer une signature à votre compte, ajoutée automatiquement sur les documents qui en ont besoin. Deux façons de l'enregistrer : « Charger un fichier » (une image de votre signature) ou « Signer depuis mon téléphone » — un QR code s'affiche, à scanner avec votre téléphone ; la signature s'enregistre automatiquement dans votre compte dès qu'elle est validée sur l'écran mobile, sans rien avoir à faire de plus ici. Une fois une signature enregistrée, un bouton « Supprimer » permet de la retirer.",
        ],
        image: img("client-17-mon-profil.png"),
      },
    ],
  },
];
