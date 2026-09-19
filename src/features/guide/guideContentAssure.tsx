import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

// Guide d'utilisateur — portail Assuré (2026-09), voir guideContent.tsx pour
// les conventions générales (structure des chapitres/sections/étapes, style
// des captures). Un chapitre = une entrée du menu latéral du portail assuré
// (voir src/auth/roles.ts, rôle "assure_principal"). Contenu construit à
// partir d'une lecture exhaustive du code source de chaque écran (src/
// features/portail-membre/*.tsx, src/portals/MonProfilModal.tsx, src/
// components/shared/SignatureManager.tsx) — jamais deviné — et de VRAIES
// captures de l'application (compte de démonstration paul.ondo@assure.
// medassur.local, données réelles du foyer Ondo), jamais des maquettes.
export const chapitresAssure: GuideChapitre[] = [
  // ══════════════════════════ ACCUEIL ══════════════════════════
  {
    id: "membreDashboard",
    titre: "Accueil",
    sections: [
      {
        titre: "Vue d'ensemble de votre couverture",
        texte: [
          "L'écran d'accueil vous salue par votre nom et affiche d'abord le statut de votre carte d'assurance (Active ou non). Juste en dessous, quatre tuiles d'accès rapide (« Ma carte », « Prise en charge », « Remboursement », « Réseau de soins ») vous amènent directement à l'écran correspondant en un clic.",
          "Deux encarts résument votre activité récente : « Prise en charge » indique le nombre de demandes en attente de traitement (avec un lien « Voir »), et « Dernier remboursement » affiche la date et le montant réellement remboursé par l'assurance de votre dernière demande — jamais le montant des frais réels engagés, toujours la part assurance.",
          "Plus bas, un bloc « Consommation » résume votre activité de soins : total des frais engagés et total remboursé. Si vous êtes l'assuré principal du contrat, ce bloc s'intitule « Consommation du foyer » et couvre tout le monde (vous et vos ayants droit) ; si vous êtes un ayant droit connecté avec votre propre accès, il ne montre que « Ma consommation », c'est-à-dire vos soins à vous.",
          "Deux graphiques complètent ce bloc quand vous êtes l'assuré principal : « Par bénéficiaire » (répartition des dépenses entre vous et chaque membre de votre famille, avec une barre de progression par personne) et « Par rubrique » (répartition par catégorie de garantie — Consultation, Pharmacie, Hospitalisation, etc.).",
        ],
        image: img("assure-01-dashboard.png"),
      },
    ],
  },

  // ══════════════════════════ MA CARTE ══════════════════════════
  {
    id: "membreCarte",
    titre: "Ma carte",
    sections: [
      {
        titre: "Consulter votre carte d'assurance et celle de votre famille",
        texte: [
          "Cet écran liste toutes les cartes de votre foyer : la vôtre (assuré principal) puis celles de chacun de vos ayants droit (conjoint(e), enfants). Chaque carte affiche la photo de la personne (si elle a été renseignée), son nom, son lien de parenté (Assuré principal / Conjoint(e) / Enfant) et le statut de sa carte (Active ou non, avec une pastille de couleur).",
          "Le bouton « Voir la carte » ouvre le VRAI modèle de carte d'assurance généré par l'assurance elle-même — la même carte que celle utilisée par les gestionnaires en interne — dans la visionneuse de documents de l'application, jamais une reconstitution visuelle propre au portail.",
        ],
        image: img("assure-02-ma-carte.png"),
      },
    ],
  },

  // ══════════════════════════ MES GARANTIES ══════════════════════════
  {
    id: "membreGaranties",
    titre: "Mes garanties",
    sections: [
      {
        titre: "Consulter les taux et plafonds de votre contrat",
        texte: [
          "Cet écran est une consultation en lecture seule du tableau de garanties de votre contrat, tel qu'il a été configuré par votre gestionnaire d'assurance. Les garanties sont regroupées par catégorie (rubrique) — Consultation, Pharmacie, Hospitalisation, Optique, Dentaire, etc. — chaque catégorie étant présentée dans son propre bloc.",
          "Pour chaque garantie, la ligne affiche son libellé, le taux de remboursement qui vous est réellement applicable (déjà résolu selon que vous êtes assuré principal ou ayant droit) et, à droite, soit un plafond en montant (avec sa périodicité — par exemple « / an »), soit la mention « Sans plafond » si aucune limite n'est fixée.",
        ],
        image: img("assure-03-garanties.png"),
      },
    ],
  },

  // ══════════════════════════ PRISE EN CHARGE ══════════════════════════
  {
    id: "membrePriseEnCharge",
    titre: "Prise en charge",
    sections: [
      {
        titre: "Suivre vos demandes d'entente préalable",
        texte: [
          "Cet écran liste vos demandes de prise en charge (entente préalable), les plus utilisées pour les soins programmés — hospitalisation, optique, actes coûteux — nécessitant un accord de l'assurance avant l'intervention. Chaque carte affiche la description de la demande, le prestataire, la date, et une pastille de décision : « En attente » (orange), « Accordé » (vert) ou « Refusé » (rouge), accompagnée le cas échéant du motif de la décision.",
          "Quand une demande est « Accordée », un lien « Certificat de prise en charge » apparaît pour télécharger/consulter le vrai document PDF généré par l'assurance.",
        ],
        image: img("assure-04-prise-en-charge.png"),
        etapes: [
          {
            titre: "Ouvrir une nouvelle demande",
            texte: "Cliquez sur « Nouvelle » en haut à droite de la liste. Dans le formulaire qui s'ouvre, choisissez d'abord le « Type » de la demande — la liste proposée correspond exactement aux catégories de garanties (rubriques) de votre propre contrat (Consultation, Optique, Hospitalisation…), jamais une liste générique.",
            image: img("assure-05-prise-en-charge-formulaire.png"),
          },
          {
            titre: "Choisir le prestataire et la date",
            texte: "Recherchez le prestataire concerné dans le champ « Prestataire * » — la recherche interroge le vrai réseau de soins conventionné de l'assurance, à la frappe (nom ou ville). Renseignez ensuite la « Date de la demande * ». Ces deux champs sont obligatoires.",
          },
          {
            titre: "Ajouter un ou plusieurs actes (facultatif)",
            texte: "Le champ « Ajouter un acte (facultatif) » permet de rechercher un acte médical dans le vrai catalogue de l'assurance et de l'ajouter à la demande. Chaque acte ajouté apparaît dans un tableau où vous pouvez saisir vous-même le montant du devis (le montant tarifé par l'assurance n'est jamais pré-rempli — vous indiquez le montant réellement inscrit sur le devis du prestataire). Un total du devis se calcule automatiquement en bas du tableau. Une icône de corbeille permet de retirer une ligne ajoutée par erreur.",
          },
          {
            titre: "Joindre l'ordonnance ou le devis",
            texte: "Au moins un des deux documents — « Ordonnance » ou « Devis » — doit être joint pour pouvoir envoyer la demande (l'un des deux devient obligatoire dès que l'autre est absent). Utilisez le sélecteur de fichier prévu pour chacun ; une coche verte confirme qu'un fichier est bien attaché.",
          },
          {
            titre: "Envoyer la demande",
            texte: "Cliquez sur « Envoyer ». La demande part avec le statut « En attente » — la décision (Accordé/Refusé) reste entièrement du ressort du gestionnaire de l'assurance qui l'examine ensuite ; les actes éventuellement ajoutés ne sont qu'une aide facultative à la constitution du dossier, jamais un engagement de montant.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ REMBOURSEMENT ══════════════════════════
  {
    id: "membreRemboursement",
    titre: "Remboursement",
    sections: [
      {
        titre: "Demander et suivre un remboursement de frais avancés",
        texte: [
          "Cet écran liste vos demandes de remboursement — utilisées quand vous avez déjà réglé vous-même des frais médicaux et souhaitez vous faire rembourser la part prise en charge par l'assurance. Chaque carte affiche le type de soin, le prestataire, la date, un badge de statut (« En attente », « Accordé », « Rejeté »), le montant des frais réels engagés et, une fois traité, le montant effectivement remboursé par l'assurance.",
        ],
        image: img("assure-06-remboursement.png"),
        etapes: [
          {
            titre: "Ouvrir une nouvelle demande",
            texte: "Cliquez sur « Nouvelle » en haut à droite. Seule la « Date du sinistre » est obligatoire dans l'en-tête du formulaire.",
            image: img("assure-07-remboursement-formulaire.png"),
          },
          {
            titre: "Compléter les informations utiles (facultatif)",
            texte: "L'« Acte / soin » (recherché dans le vrai catalogue d'actes médicaux), le « Prestataire » (recherché dans le vrai réseau de soins) et le « Montant réel payé » sont tous facultatifs à la saisie — c'est volontaire : le gestionnaire qui examine le dossier peut compléter ou corriger ces informations à partir des justificatifs joints.",
          },
          {
            titre: "Joindre au moins un justificatif",
            texte: "Quatre emplacements de pièce jointe sont proposés : « Prescription médicale », « Facture normalisée », « Quittance laboratoire » et « Autre document ». Au moins un des quatre doit être renseigné pour pouvoir envoyer la demande — la date et les pièces jointes suffisent à constituer un dossier recevable.",
          },
          {
            titre: "Envoyer la demande",
            texte: "Cliquez sur « Envoyer ». La demande apparaît avec le statut « En attente » jusqu'à son traitement par l'assurance ; le montant remboursé (part assurance, jamais les frais réels) s'affiche ensuite dans la liste une fois le dossier traité.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ RÉSEAU DE SOINS ══════════════════════════
  {
    id: "membreReseauSoins",
    titre: "Réseau de soins",
    sections: [
      {
        titre: "Trouver un prestataire conventionné",
        texte: [
          "L'écran présente d'abord une grille de catégories de prestataires (Cabinet, Cabinet Dentaire, Centre d'Imagerie, Clinique, Dépôt pharmaceutique, Hôpital, Laboratoire, Opticien, Pharmacie…), chacune indiquant le nombre de prestataires disponibles. Ces catégories reflètent exactement les types réellement présents dans le réseau conventionné de votre assurance — pas une liste figée.",
          "Cliquez sur une catégorie pour afficher la liste des prestataires correspondants, avec une barre de recherche (nom ou ville) pour affiner. Un bouton flèche « ← » en haut permet de revenir à la grille des catégories.",
        ],
        image: img("assure-08-reseau-soins.png"),
        etapes: [
          {
            titre: "Consulter la fiche d'un prestataire",
            texte: "Cliquez sur un prestataire dans la liste pour ouvrir sa fiche détaillée : adresse complète, téléphone, une carte de localisation interactive quand les coordonnées GPS sont renseignées, et — pour les structures qui en emploient — la liste des médecins qui y exercent avec leur spécialité.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ E-CARNET SANTÉ ══════════════════════════
  {
    id: "membreCarnetSante",
    titre: "E-carnet Santé",
    sections: [
      {
        titre: "Retrouver et compléter vos ordonnances et comptes rendus d'examens",
        texte: [
          "L'E-carnet Santé regroupe deux rubriques : « Ordonnance » et « Examens & Compte rendu ». Il rassemble automatiquement les feuilles de soins et feuilles d'examen déjà générées par les prestataires lors de vos passages (avec la référence du bon, la date de soins, la personne concernée et son statut), et vous permet en plus d'y ajouter vous-même des documents quand le prestataire ne les a pas saisis dans l'application.",
          "Chaque document de la liste propose un lien « Voir » (ouvre le PDF, qu'il vienne d'une feuille de soins/examen générée par l'assurance ou d'un ajout personnel) ; les documents que vous avez vous-même ajoutés peuvent aussi être supprimés (icône corbeille).",
        ],
        image: img("assure-09-carnet-sante.png"),
        etapes: [
          {
            titre: "Ajouter un document",
            texte: "Choisissez d'abord la rubrique concernée (« Ordonnance » ou « Examens & Compte rendu »). Si votre foyer compte plusieurs bénéficiaires, sélectionnez la personne concernée (vous-même ou un ayant droit) dans le menu déroulant — sinon le document est automatiquement rattaché à vous. Une description est facultative.",
          },
          {
            titre: "Photographier ou choisir un fichier",
            texte: "Cliquez sur « Photographier / choisir un fichier » : sur mobile, l'appareil photo s'ouvre directement (fonctionne comme un scanner de document) ; sur ordinateur, un sélecteur de fichier classique s'affiche. Le document est immédiatement converti et ajouté à la liste de la rubrique choisie. Il n'y a pas de reconnaissance automatique du contenu (pas d'OCR) — c'est une simple conservation numérique de vos documents papier.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ HISTORIQUE DE SOINS ══════════════════════════
  {
    id: "membreHistorique",
    titre: "Historique de soins",
    sections: [
      {
        titre: "Consulter tous les soins de votre foyer",
        texte: [
          "Cet écran retrace l'historique complet des soins de tout votre foyer (vous et vos ayants droit), organisé d'abord par exercice comptable, puis par rubrique (catégorie de garantie) à l'intérieur de chaque exercice. Deux filtres en haut de l'écran permettent d'affiner par bénéficiaire et/ou par rubrique.",
          "Chaque ligne de soin indique le type de prestation, un badge indiquant le bénéficiaire concerné (« Vous » ou le nom de l'ayant droit), le prestataire, la date, le mode de paiement (Tiers payant ou Remboursement) et le montant — pour un remboursement, le montant affiché est la part remboursée par l'assurance, jamais les frais réels. Quand une facture regroupe plusieurs actes d'une même famille, un badge « n actes » l'indique et le détail de chaque acte est accessible via « Voir le détail ».",
        ],
        image: img("assure-10-historique.png"),
        etapes: [
          {
            titre: "Consulter le détail d'une ligne",
            texte: "Cliquez sur « Voir le détail » pour dérouler les informations complètes : acte, montant remboursé, reste à charge, taux appliqué, franchise éventuelle, plafond appliqué, statut du contrôle médical, motif de rejet le cas échéant, numéro de sinistre et nature de la maladie — uniquement les champs renseignés pour cette ligne s'affichent.",
          },
          {
            titre: "Télécharger les documents associés",
            texte: "Selon la ligne, un ou plusieurs liens de téléchargement apparaissent : « Décompte » (justificatif de règlement de la facture), « Feuille de soins » (pour une consultation) ou « Feuille d'examen » (pour une analyse, une imagerie ou un acte de spécialité) — chacun ouvre le vrai document PDF correspondant.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ MA FAMILLE ══════════════════════════
  {
    id: "membreFamille",
    titre: "Ma famille",
    sections: [
      {
        titre: "Voir le détail de chaque membre de votre foyer",
        texte: [
          "Cet écran liste toutes les personnes rattachées à votre contrat : vous-même (assuré principal) puis chacun de vos ayants droit (conjoint(e), enfants), avec leur photo quand elle est renseignée, leur lien de parenté, leur date de naissance et le statut de leur couverture (Actif/Inactif).",
        ],
        image: img("assure-11-famille.png"),
        etapes: [
          {
            titre: "Afficher le détail complet d'une personne",
            texte: "Cliquez sur « Voir le détail » sous n'importe quelle carte (y compris la vôtre) pour dérouler ses informations complètes : matricule, statut de la carte, téléphone, email, sexe, adresse, lieu de naissance, nationalité et date d'affiliation au contrat — seuls les champs réellement renseignés apparaissent. « Masquer le détail » referme la fiche.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ ACCÈS FAMILLE ══════════════════════════
  {
    id: "membreDelegations",
    titre: "Accès famille",
    sections: [
      {
        titre: "Donner à un ayant droit son propre accès au portail",
        texte: [
          "Cet écran, réservé à l'assuré principal, permet de créer un compte de connexion autonome pour un ayant droit (conjoint(e) ou enfant) et de décider précisément ce qu'il pourra voir dans le portail. La liste affiche chaque ayant droit avec un badge « Aucun accès » ou « Accès actif · n rubrique(s) » selon qu'un compte a déjà été créé pour lui.",
        ],
        image: img("assure-12-acces-famille.png"),
        etapes: [
          {
            titre: "Créer un accès",
            texte: "Cliquez sur « Donner accès » pour un ayant droit sans compte. Choisissez le canal de connexion — « Matricule » (celui déjà attribué à la personne, affiché à titre indicatif), « Adresse email » ou « Numéro de téléphone » (à saisir, et qui doit être différent du vôtre pour rester non-ambigu) — puis définissez un « Mot de passe initial » (6 caractères minimum).",
            image: img("assure-13-acces-famille-modal.png"),
          },
          {
            titre: "Choisir les rubriques accessibles",
            texte: "Cochez, dans la liste « Rubriques accessibles », les écrans du portail que cette personne pourra consulter (Accueil, Ma carte, Mes garanties, Prise en charge, Remboursement, Réseau de soins, E-carnet Santé, Historique de soins, Ma famille, Messagerie…). Vous ne pouvez jamais accorder plus de droits que vous n'en détenez vous-même — impossible de déléguer un accès à « Accès famille » lui-même, par exemple. Cliquez sur « Enregistrer » pour créer le compte.",
          },
          {
            titre: "Modifier ou révoquer un accès existant",
            texte: "Pour un ayant droit ayant déjà un compte (badge « Accès actif »), le bouton devient « Droits » et rouvre la même fenêtre pour ajuster les rubriques cochées (le canal de connexion et le mot de passe, eux, ne se modifient plus depuis cet écran une fois le compte créé). L'icône de corbeille à côté révoque définitivement l'accès de la personne, après confirmation.",
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
        titre: "Échanger directement avec l'assurance",
        texte: [
          "La Messagerie liste vos conversations avec l'assurance sur la gauche (par exemple une conversation ouverte automatiquement au sujet d'une demande de prise en charge) et affiche les messages de la conversation sélectionnée à droite. Vos échanges sont traités par un assistant qui répond sous l'identité « Ariana, votre Conseiller Clients » ; si la question dépasse ce que l'assistant peut traiter, un conseiller humain prend la suite de façon transparente, sans que vous ayez à changer d'interlocuteur apparent.",
        ],
        image: img("assure-14-messagerie.png"),
        etapes: [
          {
            titre: "Démarrer une nouvelle conversation",
            texte: "Cliquez sur « Nouvelle conversation », renseignez un « Objet » (par exemple « Question sur ma prise en charge ») et votre « Message », puis envoyez. Il n'y a pas de canal à choisir : toute question posée depuis le portail assuré est directement prise en charge par l'assistant.",
            image: img("assure-15-messagerie-nouvelle.png"),
          },
          {
            titre: "Répondre dans une conversation existante",
            texte: "Ouvrez une conversation dans la liste de gauche et tapez votre message dans le champ en bas de l'écran de discussion pour poursuivre l'échange.",
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
          "Cliquez sur votre avatar en haut à droite de l'écran (initiales sur fond bleu, à côté de votre nom) pour ouvrir la fenêtre « Mon profil », accessible depuis n'importe quel écran du portail.",
          "La première section permet de modifier votre Nom, votre Téléphone et votre Adresse, puis d'enregistrer via le bouton « Enregistrer ». L'Email (identifiant de connexion) et le Rôle sont affichés mais non modifiables depuis cet écran.",
          "La section « Changer de mot de passe » demande votre mot de passe actuel puis le nouveau mot de passe (8 caractères minimum) et sa confirmation, avant de cliquer sur « Changer le mot de passe ».",
          "La section « Signature électronique », en bas, permet de gérer la signature qui sera automatiquement apposée sur les documents où votre signature est requise : « Charger un fichier » pour importer une image de votre signature depuis votre ordinateur, ou « Signer depuis mon téléphone » pour afficher un QR code à scanner — la signature réalisée sur l'écran de votre téléphone s'enregistre alors automatiquement dans votre compte, sans rien à télécharger manuellement. Une fois une signature enregistrée, un bouton « Supprimer » permet de la retirer.",
        ],
        image: img("assure-16-mon-profil.png"),
      },
    ],
  },
];
