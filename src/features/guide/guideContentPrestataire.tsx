import { img } from "./guideImages";
import type { GuideChapitre } from "./guideContent";

// Guide d'utilisateur — portail Prestataire de santé (2026-09), voir
// guideContent.tsx pour les conventions générales. Un chapitre = une entrée
// du menu latéral du portail prestataire (voir src/auth/roles.ts, rôle
// "prestataire_sante" ; src/layout/navConfig.ts pour les libellés exacts).
// Contenu construit à partir d'une lecture exhaustive du code source de
// chaque écran (src/features/portail-prestataire/*.tsx) et de VRAIES
// captures de l'application (compte de démonstration « CHU Libreville »,
// facturation@chu-libreville.ga, mot de passe portail fixe "passe" —
// distinct du mot de passe interne). Les rubriques encore au stade
// « Bientôt disponible » (Contacts & Interloc., Logistique) sont décrites
// comme telles, jamais inventées.
export const chapitresPrestataire: GuideChapitre[] = [
  // ══════════════════════════ ACCUEIL ══════════════════════════
  {
    id: "prestataireDashboard",
    titre: "Accueil",
    sections: [
      {
        titre: "Point d'entrée du portail établissement",
        texte: [
          "L'écran « Accueil » affiche le nom de votre établissement (ici CHU Libreville) et deux grandes tuiles d'accès rapide : « Les patients » (ouvre directement l'écran Patients) et « Prestations » (ouvre directement l'écran Prestations). Ce sont de simples raccourcis vers les mêmes écrans que ceux du menu latéral.",
          "Trois compteurs résument l'activité de l'établissement : « Prestations totales » (nombre de factures/prises en charge saisies, tous statuts confondus), « En saisie » (factures encore modifiables, pas encore envoyées à l'assurance) et « Télétransmises » (factures déjà envoyées). Ces chiffres se mettent à jour à chaque nouvelle prestation enregistrée.",
        ],
        image: img("prestataire-01-dashboard.png"),
      },
    ],
  },

  // ══════════════════════════ PATIENTS ══════════════════════════
  {
    id: "prestatairePatients",
    titre: "Patients",
    sections: [
      {
        titre: "Retrouver un patient déjà servi",
        texte: [
          "L'écran « Patients » liste uniquement les assurés déjà servis au moins une fois par votre établissement (jamais l'ensemble des assurés du système). Chaque ligne affiche la photo, le nom, le matricule, le type (Bénéficiaire Principal / Conjoint(e) / Enfant) et un badge « Actif » ou « Non couvert » — ce statut est vérifié en temps réel, pas figé au moment où le patient a été vu pour la première fois.",
          "Le champ de recherche (nom ou matricule) ne filtre la liste qu'au clic sur « Rechercher » (ou Entrée), jamais à la frappe ; le bouton « Réinitialiser » n'apparaît qu'une fois une recherche lancée.",
          "Cliquer sur une ligne de patient actif ouvre directement sa fiche complète (voir ci-dessous), sans repasser par une recherche téléphone/matricule — inutile de le « réidentifier », il est déjà connu. Si le patient n'est plus « Actif », un message d'erreur apparaît : « Désolé, prestation impossible pour ce patient car il n'est plus couvert. »",
        ],
        image: img("prestataire-02-patients.png"),
        etapes: [
          {
            titre: "Identifier un nouvel assuré (jamais vu par l'établissement)",
            texte: "Cliquez sur « Identifier un nouvel assuré » en haut de la liste. Choisissez le canal de recherche — « N° Téléphone », « N° Matricule » ou « N° Adhérent » — saisissez la valeur puis cliquez sur « Rechercher ». Si plusieurs membres d'une même famille correspondent, une grille de cartes apparaît (« Sélectionnez le patient concerné ») : chacune affiche photo, nom, type de bénéficiaire et statut de couverture ; cliquer sur une carte « Non couvert » est bloqué par le même message d'erreur que ci-dessus.",
          },
          {
            titre: "Consulter la fiche du patient identifié",
            texte: "Une fois le patient choisi (depuis la liste « Mes patients » ou après une recherche), sa fiche affiche : photo, nom, type de bénéficiaire, date de naissance, matricule, mobile, la période de validité de sa prise en charge (« Du … au … »), l'assureur et le souscripteur, le statut de sa carte (« Active » ou non), puis le tableau « Liste des règles de prise en charge » — chaque garantie de son contrat avec son taux (%) et son plafond (montant ou texte libre).",
            image: img("prestataire-02b-patients-fiche.png"),
          },
          {
            titre: "Démarrer une prestation depuis la fiche",
            texte: "En bas de la fiche, une rangée de boutons reprend les familles d'actes autorisées pour votre établissement (Consultation, Analyse, Imagerie, Hospitalisation & Chirurgie, Dentaire, Kinésithérapie, Actes de Spécialités, Pharmacie — filtrée automatiquement selon le type de votre structure, par exemple une pharmacie ne voit pas « Consultation »). Cliquer sur l'une d'elles bascule directement vers l'écran Prestations, formulaire de création déjà pré-rempli avec ce patient et cette famille d'actes.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ PRESTATIONS ══════════════════════════
  {
    id: "prestatairePrestations",
    titre: "Prestations",
    sections: [
      {
        titre: "Liste des prestations financières (factures)",
        texte: [
          "L'écran « Prestations » liste toutes les factures/prises en charge saisies par l'établissement : référence, patient(s) concerné(s), date de réception, montant total, statut interne (« En saisie » ou « Soumise ») et statut réel du règlement assurance (Reçu, En validation, Soumise — en attente de règlement, Validé, Payée, Rejeté…, ce dernier reflétant en temps réel le traitement fait côté assurance, pas seulement le cycle interne au portail).",
          "Les champs Référence, Nom du patient et les deux dates Du/Au ne filtrent la liste qu'au clic sur « Rechercher » (jamais à la frappe) ; « Réinitialiser » efface le filtre actif. Cliquer sur une ligne ouvre le détail de la facture.",
        ],
        image: img("prestataire-03-prestations.png"),
        etapes: [
          {
            titre: "Créer une prestation — identifier le patient",
            texte: "Cliquez sur « Créer une prestation ». Si aucun patient n'est déjà en contexte (venant de l'écran Patients), l'écran d'identification s'ouvre en premier : choisissez le canal (N° Téléphone / N° Matricule / N° Adhérent), saisissez la valeur et cliquez sur « Rechercher », puis sélectionnez le patient dans la liste des résultats et une des familles d'actes proposées en bas de sa fiche pour lancer la création.",
            image: img("prestataire-03b-prestations-identification.png"),
          },
          {
            titre: "Renseigner la nouvelle consultation/prestation",
            texte: "Choisissez le Type de prestation (Ambulatoire, Hospitalisation, Dentisterie, Optique, Kinésithérapie, Maternité, Transport, Autre — ou, pour la Pharmacie, un choix simplifié à deux options Ambulatoire/Hospitalisation qui détermine directement le taux appliqué) et la Date des soins (les saisies antidatées sont autorisées, sans limite). Sélectionnez ensuite la Nature de l'affection (Affection Courante ou autre catégorie proposée) — obligatoire pour chaque prestation, à but strictement statistique interne, jamais affiché sur le document remis au patient. Pour le groupe « Consultation » uniquement, un champ supplémentaire « Médecin recevant le patient » est obligatoire : c'est ce choix qui fait apparaître le patient dans la file d'attente de ce médecin précisément.",
          },
          {
            titre: "Ajouter les actes et fixer le tarif",
            texte: "Dans « Prestation médicale », recherchez et ajoutez un ou plusieurs actes du catalogue (filtré à la famille choisie). Chaque ligne ajoutée affiche son prix de référence et son taux/part assurance calculés en direct ; pour un médicament (famille Pharmacie), la ligne se saisit en Prix unitaire × Quantité (le montant total se recalcule automatiquement) ; pour tout autre acte, un champ unique « Frais réels (coût total) » reste éditable. Un message d'alerte orange apparaît si un plafond de garantie est atteint ou dépassé. Le total de la facture s'affiche en bas de la liste. Cliquez enfin sur « Enregistrer » pour créer la facture (statut « En saisie »).",
          },
          {
            titre: "Détail d'une facture, télétransmission et documents",
            texte: "Le détail d'une facture liste chaque ligne (patient, type, date, acte, montant, remboursé, reste patient) avec, par ligne active, des actions rapides : « Feuille de soins » (icône stéthoscope, pour les actes de Consultation) ou « Feuille d'examen » (icône flacon, pour Analyse/Imagerie/Actes de Spécialités) génèrent le document dématérialisé correspondant ; « Modifier » (crayon) rouvre la ligne en édition (acte, famille, date, montant/quantité) ; « Annuler » (icône interdiction) exige un motif obligatoire et exclut la ligne des totaux tout en la gardant visible, barrée, avec son motif affiché. En bas de la facture : « Télétransmettre le dossier » (visible uniquement tant que le statut est « En saisie », envoie définitivement le dossier à l'assurance), « Voir la facture » (document imprimable signé électroniquement), « Historique » (chaque modification, avec le nom de l'utilisateur et l'horodatage) et « Annuler la facture » (annule l'ensemble du dossier avec motif obligatoire, tant qu'elle n'est pas déjà annulée).",
          },
          {
            titre: "Ajouter un acte à une facture déjà saisie",
            texte: "Depuis le détail d'une facture non annulée, le bloc « Ajouter un acte à cette facture » permet de compléter le dossier : choisissez le type de prestation, la date, la famille puis l'acte à ajouter (même bloc de tarification que la création), la Nature de l'affection, et si nécessaire le Médecin (pour une Consultation). Chaque acte ajouté reste « en attente » — retirable via l'icône corbeille — tant que vous n'avez pas cliqué sur « Enregistrer » en bas du bloc, qui envoie toutes les lignes en attente en une seule fois.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ TRAITER UN BON ══════════════════════════
  {
    id: "prestataireTraiterBon",
    titre: "Traiter un bon",
    sections: [
      {
        titre: "Dématérialisation du circuit ordonnance / bon d'examen",
        texte: [
          "Cet écran n'apparaît utile que pour les établissements de type Hôpital, Clinique, Cabinet ou Laboratoire (bons d'examen) ou Pharmacie/Dépôt pharmaceutique (ordonnances) — pour tout autre type d'établissement, un message indique que « Cet écran n'est pas disponible pour ce type d'établissement. » Le titre et les libellés s'adaptent automatiquement : « Traiter un bon d'examen » pour les structures d'examen, « Traiter une ordonnance » pour les structures de dispensation.",
          "Le principe : un médecin prescripteur (portail médecin, écran Consultation) émet un bon numéroté (ordonnance ou bon d'examen) rattaché à un patient. Le présent écran permet à l'établissement qui reçoit le patient de retrouver ce bon et de facturer les actes/produits réellement délivrés, ligne par ligne, avec calcul automatique de la quote-part assurance/patient — sans ressaisir manuellement une nouvelle facture depuis zéro.",
          "Deux points d'entrée indépendants, jamais l'un imposé avant l'autre : rechercher directement par le numéro du bon (comme un papier d'ordonnance physique que le patient présente), ou identifier l'assuré pour voir directement la liste de ses bons en attente, sans connaître de numéro.",
        ],
        image: img("prestataire-04-traiter-bon.png"),
        etapes: [
          {
            titre: "Retrouver le bon — par numéro",
            texte: "Dans le bloc « Rechercher par numéro », saisissez la référence exacte du bon (ex. FE-000001/2026 pour un bon d'examen, FS-000001/2026 pour une ordonnance) et cliquez sur « Rechercher ». Si le bon a déjà été entièrement traité, un message l'indique et il ne s'ouvre pas.",
          },
          {
            titre: "Retrouver le bon — par identification du patient",
            texte: "Dans le bloc « Rechercher un assuré », choisissez le canal (N° Téléphone / N° Matricule / N° Adhérent), saisissez la valeur puis « Rechercher ». Sélectionnez le patient dans la grille de résultats (bloqué avec le même message « non couvert » si son statut n'est plus Actif) : ses bons en attente pour ce type (examen ou ordonnance) s'affichent automatiquement, chacun avec son numéro, le médecin prescripteur, la date et le nombre de lignes — cliquez sur « Ouvrir → » pour le traiter.",
          },
          {
            titre: "Sélectionner les lignes à traiter et fixer le tarif",
            texte: "Une fois le bon ouvert, chaque ligne prescrite est affichée avec son libellé et, si renseignée, sa posologie. Cochez les lignes à traiter aujourd'hui — la quantité et, si un prix de référence existe au catalogue, le montant sont pré-remplis au reste disponible, mais restent librement modifiables (la quantité ne peut jamais dépasser le reste à servir). Dès qu'une ligne est cochée, sa quote-part se calcule et s'affiche automatiquement : base remboursée par MedAssur, taux appliqué et reste à charge du patient. Un bandeau de totaux récapitule, pour l'ensemble de la sélection, le montant total, la part MedAssur et la part assuré. Réglez la Date puis cliquez sur « Traiter la sélection » — une facture est enregistrée automatiquement à partir des lignes cochées.",
          },
          {
            titre: "Accéder à la feuille de soins / d'examen du bon",
            texte: "Depuis un bon ouvert, le lien « Feuille de soins » (ou « Feuille d'examen ») en haut de la carte reste accessible à tout moment, même avant traitement, et reflète les mises à jour au fur et à mesure des traitements effectués sur ce bon.",
          },
          {
            titre: "Bon partagé entre plusieurs prestataires",
            texte: "Un même bon peut être servi partiellement par plusieurs établissements différents (ex. deux pharmacies pour une même ordonnance). Chaque ligne affiche sa propre quantité prescrite et la quantité déjà traitée par n'importe quel prestataire — pas seulement le vôtre. Une ligne déjà entièrement servie apparaît barrée avec la mention « Déjà servi » et n'est plus sélectionnable ; une ligne partiellement servie affiche « x/y déjà servi(s) — reste z à servir » et ne peut être retraitée qu'à hauteur de ce reste (la quantité saisissable est plafonnée automatiquement). Ainsi, si un premier établissement n'a délivré qu'une partie de la quantité prescrite, un second établissement peut ouvrir le même bon et compléter exactement le reste, sans risque de double facturation sur la même ligne.",
          },
          {
            titre: "Historique de vos bons déjà traités",
            texte: "En bas de l'écran (tant qu'aucun bon n'est ouvert), le bloc « Historique des bons d'examen traités » ou « Historique des ordonnances traités » liste, par défaut et sans recherche préalable, uniquement les bons déjà traités par VOTRE établissement (jamais ceux traités par d'autres prestataires) : référence, date, patient, médecin prescripteur et statut. Cliquer sur une ligne rouvre le bon pour consultation ou traitement complémentaire.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ CONTACTS & INTERLOC. ══════════════════════════
  {
    id: "prestataireContacts",
    titre: "Contacts & Interloc.",
    sections: [
      {
        titre: "Rubrique pas encore développée",
        texte: [
          "L'écran « Contacts & Interlocuteurs » affiche actuellement un message « Bientôt disponible » — cette rubrique, destinée à présenter vos interlocuteurs chez MedAssur et les organismes partenaires, n'est pas encore fonctionnelle à ce jour.",
        ],
        image: img("prestataire-05-contacts.png"),
      },
    ],
  },

  // ══════════════════════════ DEVIS ══════════════════════════
  {
    id: "prestataireDevis",
    titre: "Devis",
    sections: [
      {
        titre: "Demander une entente préalable / prise en charge",
        texte: [
          "L'écran « Devis » sert à déposer une demande de prise en charge de tout type (l'entente préalable), pour l'hospitalisation, l'imagerie, ou tout autre acte nécessitant un accord préalable de l'assurance avant réalisation. Un devis déposé ici est une vraie demande, immédiatement visible côté interne dans la file de décision (analyse médicale puis validation financière), avec l'origine « Portail Prestataire ».",
          "La liste affiche référence, patient, type, date, montant du devis et décision (Accordé/Refusé/en attente) avec un badge coloré. Les champs Référence/type, Nom du patient et les deux dates Du/Au ne filtrent qu'au clic sur « Rechercher ».",
        ],
        image: img("prestataire-06-devis.png"),
        etapes: [
          {
            titre: "Identifier le patient concerné",
            texte: "Cliquez sur « Nouveau devis ». Si aucun patient n'est déjà en contexte, la même identification que « Prestations » s'ouvre (canal de recherche, valeur, sélection du membre concerné).",
          },
          {
            titre: "Renseigner la demande",
            texte: "Choisissez le Type de demande (parmi les familles d'actes autorisées pour votre établissement) et la Date de la demande. Ajoutez, si utile, un ou plusieurs actes au devis (montant modifiable par ligne) — le total du devis se calcule automatiquement, mais l'ajout d'actes reste facultatif.",
          },
          {
            titre: "Joindre les pièces obligatoires et envoyer",
            texte: "Pour une demande de type Hospitalisation, un seul document est requis : la « Déclaration d'hospitalisation ». Pour tout autre type, il faut joindre au moins l'un des deux : « Ordonnance » ou « Devis » (un seul suffit, mais l'un des deux est obligatoire). Cliquez sur « Envoyer » — le devis est transmis à l'assurance pour analyse médicale puis validation financière.",
          },
          {
            titre: "Suivre la décision et récupérer le certificat",
            texte: "Le détail d'un devis affiche l'avancement (« Analyse médicale », « Validation financière »), le montant devisé puis, une fois statué, le montant autorisé. Si la décision est « Accordé », un bouton « Certificat de prise en charge » permet de télécharger le document — sa référence, visible dès la création du devis, peut ensuite être rattachée à la prestation d'hospitalisation effective au moment de la facturer.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ GESTION FINANCIÈRE ══════════════════════════
  {
    id: "prestataireFinance",
    titre: "Gestion financière",
    sections: [
      {
        titre: "Regrouper les factures en relevés et suivre les règlements",
        texte: [
          "L'écran « Gestion financière » est organisé en trois sous-onglets, chacun avec ses propres critères de recherche (Rechercher/Réinitialiser, jamais de filtrage à la frappe) : « Lots proposés — à créer », « Liste Relevés créés » et « Toutes les factures déclarées ». Cette dernière montre TOUTES les factures saisies pour l'établissement, quel que soit le compte à l'origine de la saisie (accueil, facturation…) — utile pour faire le point entre ce qui a été déclaré et ce qui a été progressivement réglé.",
        ],
        image: img("prestataire-07-finance.png"),
        etapes: [
          {
            titre: "Créer un relevé à partir d'un lot proposé",
            texte: "Vos factures télétransmises sont automatiquement regroupées par souscripteur et par période (mois). Dans « Lots proposés — à créer », chaque lot détaille ligne à ligne les factures qui le composeront (patient, date, frais réel, part assurance, part patient, TPS le cas échéant, net à payer) avec un total en pied de tableau. Cliquez sur « Créer » à côté du total pour transformer ce lot en un relevé formel, transmis à l'assurance en une fois.",
          },
          {
            titre: "Consulter et exporter un relevé créé",
            texte: "Dans « Liste Relevés créés », chaque relevé affiche son numéro, le souscripteur, la période, le nombre de factures, le montant total et le statut réel de règlement (reflet temps réel du traitement côté assurance). Les boutons « Voir » (ouvre le détail ligne à ligne), « PDF » et « Excel » sont disponibles directement sur chaque ligne.",
          },
          {
            titre: "Ajouter ou retirer une facture d'un relevé déjà créé",
            texte: "Dans le détail d'un relevé, le bouton « Ajouter une facture » ouvre la liste des factures éligibles (même souscripteur/période, pas encore incluses) — cliquez sur « Ajouter » sur la ligne voulue. Chaque facture déjà incluse peut être retirée via le bouton « Retirer », sauf s'il ne reste qu'une seule facture dans le relevé (un relevé ne peut pas être vidé entièrement par ce biais).",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ LOGISTIQUE ══════════════════════════
  {
    id: "prestataireLogistique",
    titre: "Logistique",
    sections: [
      {
        titre: "Rubrique pas encore développée",
        texte: [
          "L'écran « Logistique » affiche actuellement un message « Bientôt disponible » — cette rubrique, destinée à la gestion des ressources et équipements de l'établissement, n'est pas encore fonctionnelle à ce jour.",
        ],
        image: img("prestataire-08-logistique.png"),
      },
    ],
  },

  // ══════════════════════════ MESSAGERIE ══════════════════════════
  {
    id: "messagerie",
    titre: "Messagerie",
    sections: [
      {
        titre: "Échanger directement avec MedAssur",
        texte: [
          "La « Messagerie » du portail prestataire liste vos conversations avec MedAssur (par exemple au sujet d'un règlement), chacune avec un statut (« En cours »…). Contrairement à la messagerie interne, il n'y a pas de distinction « File d'attente »/« Mes conversations » côté externe : vous voyez uniquement vos propres échanges. Toute réponse peut provenir de l'assistant IA (identité « Ariana ») ou d'un agent humain qui reprend la main de façon transparente, sans que cela change l'apparence de la conversation.",
          "Cliquez sur une conversation dans la colonne de gauche pour l'ouvrir et lire les messages échangés ; le panneau de droite affiche « Sélectionnez une conversation » tant qu'aucune n'est choisie.",
        ],
        image: img("prestataire-09-messagerie.png"),
        etapes: [
          {
            titre: "Démarrer une nouvelle conversation",
            texte: "Cliquez sur « Nouvelle conversation ». Renseignez l'Objet (ex. « Question sur ma prise en charge ») et le Message décrivant votre demande, puis cliquez sur « Envoyer » — la conversation s'ouvre immédiatement et apparaît dans votre liste.",
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
        titre: "Vos informations, votre mot de passe et votre signature électronique",
        texte: [
          "Cliquez sur votre avatar (initiales, en haut à droite) puis sur « Mon profil » pour ouvrir cette fenêtre, accessible depuis n'importe quel écran du portail.",
          "Le formulaire principal affiche le Nom (modifiable), l'Email (affiché mais non modifiable ici — c'est l'identifiant de connexion), le Téléphone (modifiable), le Rôle (affiché, non modifiable) et l'Adresse (modifiable). Cliquez sur « Enregistrer » pour appliquer vos changements.",
        ],
        image: img("prestataire-10-mon-profil.png"),
        etapes: [
          {
            titre: "Changer de mot de passe",
            texte: "Dans la section « Changer de mot de passe », renseignez votre Mot de passe actuel, puis le Nouveau mot de passe (au moins 8 caractères) et sa Confirmation (doit correspondre exactement). Cliquez sur « Changer le mot de passe ». Une erreur s'affiche si le mot de passe actuel est incorrect ou si la confirmation ne correspond pas.",
          },
          {
            titre: "Gérer votre signature électronique",
            texte: "La section « Signature électronique » montre votre signature actuelle (ou « Aucune signature »). Elle est ajoutée automatiquement sur les documents où votre signature est requise, jamais affichée sur l'écran d'accueil. Deux façons de l'enregistrer : « Charger un fichier » (image de votre signature depuis votre appareil) ou « Signer depuis mon téléphone » (génère un QR code à scanner ; la signature s'enregistre automatiquement dans votre compte dès qu'elle est validée sur le téléphone, sans autre action ici). Une fois une signature enregistrée, un bouton « Supprimer » permet de la retirer (confirmation demandée).",
          },
        ],
      },
    ],
  },
];
