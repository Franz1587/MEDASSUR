import { img } from "./guideImages";

export interface GuideEtape {
  titre?: string;
  texte: string;
  image?: string;
}

export interface GuideSection {
  titre: string;
  texte: string[];
  image?: string;
  etapes?: GuideEtape[];
}

export interface GuideChapitre {
  id: string;
  titre: string;
  sections: GuideSection[];
}

// Guide d'utilisateur intégré (2026-09) — voir demande utilisateur : "je
// veux que l'application génère son propre guide d'utilisateur" puis, en
// détail : "il doit expliquer chaque fonctionnalité, comment exécuter les
// taches... comment se passe la saisie jusqu'à la validation... avec des
// capture et du texte chaque fonctionnalité, chaque commande, chaque
// bouton. Avec détails et précision." Contenu construit à partir d'une
// lecture exhaustive du code source de chaque écran (labels de boutons,
// champs de formulaire, enchaînement réel des statuts) — jamais deviné —
// et de VRAIES captures de l'application (comptes de démonstration,
// données réelles), jamais des maquettes. Voir src/assets/guide/*.png et
// guideImages.ts.
//
// Structure : un chapitre = une zone de la barre latérale (même
// regroupement que AdminShell.tsx, pour que le sommaire du guide
// corresponde exactement à ce que l'utilisateur voit dans le menu). Une
// section = un écran de cette zone. `etapes` = la marche à suivre pas à
// pas (saisie → validation), une capture par étape.

export const chapitresInterne: GuideChapitre[] = [
  // ══════════════════════════ ACCUEIL ══════════════════════════
  {
    id: "accueil",
    titre: "Tableau de bord",
    sections: [
      {
        titre: "Vue d'ensemble du portefeuille",
        texte: [
          "Le Tableau de Bord est l'écran d'accueil de votre compte. Il résume en un coup d'œil les primes émises, les commissions perçues, le nombre de contrats actifs, les sinistres en cours, le nombre de clients et d'assurés santé, le taux de recouvrement et la trésorerie, ainsi que deux graphiques : « Production Mensuelle » (primes émises vs l'année précédente) et « Répartition Portefeuille » (contrats actifs par ville).",
          "Le sélecteur « Exercice » en haut à droite permet de changer d'année comptable — tous les chiffres de la page se recalculent automatiquement pour l'exercice choisi.",
          "Le bouton « Rapport PDF » génère immédiatement un rapport imprimable reprenant ces indicateurs, prêt à être partagé en réunion ou envoyé à un tiers.",
        ],
        image: img("01-dashboard.png"),
      },
    ],
  },

  // ══════════════════════════ COMMERCIAL ══════════════════════════
  {
    id: "prospection",
    titre: "Prospection (CRM)",
    sections: [
      {
        titre: "Suivre un prospect du premier contact jusqu'à la signature",
        texte: [
          "L'écran « Prospection » affiche un tableau Kanban avec 6 colonnes représentant les étapes d'un dossier commercial : Nouveau, Qualifié, Proposition envoyée, Négociation, Gagné, Perdu. Un bouton « Statistiques » (en haut) bascule vers une vue chiffrée de l'exercice.",
          "Les boutons « Excel » et « Tableau de prospection » (export PDF) permettent d'extraire la liste des prospects pour un reporting externe.",
        ],
        etapes: [
          {
            titre: "Créer un prospect",
            texte: "Cliquez sur « Nouveau prospect ». Renseignez le Nom, le Type (Entreprise/Particulier), la Source, l'Étape de départ, la Valeur estimée (prime nette FCFA), le Commercial en charge, la Date de dernier contact et le Type de contrat envisagé (Maladie et Assistance / Maladie seule), puis la personne ressource (Nom, Fonction, Téléphone, Email). Cliquez sur « Créer » — le prospect apparaît immédiatement dans la colonne Kanban correspondant à son étape.",
            image: img("crm-02-nouveau-prospect.png"),
          },
          {
            titre: "Faire progresser le dossier",
            texte: "Il n'y a pas de glisser-déposer entre colonnes : cliquez sur la carte du prospect pour rouvrir le même formulaire et changez simplement son champ « Étape » (Qualifié → Proposition envoyée → Négociation → Gagné/Perdu). La carte se déplace alors automatiquement dans la bonne colonne. Le formulaire d'édition ajoute aussi une section « Évolution du dossier » (ajout de notes horodatées) pour tracer l'historique des échanges.",
          },
          {
            titre: "Convertir un prospect gagné en client",
            texte: "Une fois l'étape passée à « Gagné », une section « Conversion en client » apparaît dans la fiche : recherchez le souscripteur réel (déjà créé, ou à créer d'abord dans « Souscripteurs ») et cliquez sur « Rattacher ». Cette étape est manuelle et volontaire — le prospect n'est jamais automatiquement transformé en souscripteur.",
          },
        ],
      },
    ],
  },
  {
    id: "souscripteurs",
    titre: "Souscripteurs",
    sections: [
      {
        titre: "Gérer vos clients (entreprises et particuliers)",
        texte: [
          "L'écran « Souscripteurs » regroupe tous vos clients. La liste est filtrable par nom/contact, par type (Entreprise/Particulier), par statut (Actif/Inactif) et par ville, via le bouton « Rechercher ». Les boutons d'en-tête « Export » et « Import en masse » permettent respectivement d'extraire la liste ou de reprendre un portefeuille existant depuis un fichier.",
        ],
        image: img("02-souscripteurs.png"),
        etapes: [
          {
            titre: "Créer un souscripteur",
            texte: "Cliquez sur « Nouveau souscripteur ». Choisissez d'abord le type — « Personne morale (Entreprise) » ou « Personne physique (Particulier) » — le formulaire s'adapte : pour une entreprise, renseignez Raison sociale, Catégorie, Forme juridique, RCCM, NIF, Secteur d'activité, Effectif puis le Représentant légal (Nom, Fonction, Téléphone, Email) ; pour un particulier, Nom/Prénom, Date et lieu de naissance, Sexe, Nationalité, Situation matrimoniale, Profession, Employeur, Type et numéro de pièce d'identité. Dans les deux cas, complétez aussi Pays, Ville, Adresse, Boîte postale, Téléphone(s), Email, Contact principal et Statut. Cliquez sur « Créer » — le souscripteur est immédiatement actif, aucune validation supplémentaire n'est nécessaire.",
            image: img("souscripteurs-02-nouveau.png"),
          },
          {
            titre: "Compléter la fiche après création",
            texte: "Un logo ne peut être ajouté qu'après la création (bouton « Éditer » sur la fiche, puis « Importer un logo »). Depuis la fiche du souscripteur, le bouton « Portefeuille » ouvre directement la liste de ses contrats dans l'écran Contrats.",
          },
        ],
      },
    ],
  },
  {
    id: "appels-offres",
    titre: "Appels d'Offres",
    sections: [
      {
        titre: "Répondre à un appel d'offres jusqu'à la proposition finale",
        texte: [
          "L'écran « Appels d'Offres » liste les dossiers de mise en concurrence en cours, chacun rattaché à un prospect.",
        ],
        image: img("appel-offres-01-liste.png"),
        etapes: [
          {
            titre: "Créer l'appel d'offres",
            texte: "Cliquez sur « Nouvel appel d'offres ». Sélectionnez le Prospect concerné, résumez le Cahier des charges et les Garanties demandées, indiquez l'historique sinistres si connu, une Projection S/P (%), une Estimation PEPM (prime par personne par mois) et un Fonds de roulement estimé. Cliquez sur « Créer ».",
            image: img("appel-offres-02-nouveau.png"),
          },
          {
            titre: "Joindre les documents reçus",
            texte: "Depuis la fiche du dossier, section « Documents » : choisissez un type (Cahier des charges, Offre compagnie, Autre), la compagnie concernée si pertinent, puis « Importer un fichier ».",
          },
          {
            titre: "Chiffrer des offres via la Cotation",
            texte: "Cliquez sur « Lancer une cotation pour cet AO » — vous êtes redirigé vers le module Cotation avec l'appel d'offres déjà pré-lié ; chaque offre compagnie enregistrée là-bas revient automatiquement dans la section « Offres reçues » du dossier.",
          },
          {
            titre: "Construire la proposition commerciale",
            texte: "Cliquez sur « Nouvelle proposition », donnez-lui un Libellé, une Prime proposée, une Description des garanties, puis cochez les cotations à combiner dans cette offre. Cliquez sur « Créer ». Enfin, faites progresser le statut du dossier via le sélecteur (En cours → Proposition envoyée → Gagné/Perdu) au fil de l'avancement réel.",
          },
        ],
      },
    ],
  },
  {
    id: "cotation",
    titre: "Cotation",
    sections: [
      {
        titre: "Chiffrer une offre auprès d'une ou plusieurs compagnies",
        texte: [
          "Contrairement aux autres écrans, il n'y a pas de bouton « Nouveau » : le formulaire de saisie d'une offre est toujours visible en haut de la page.",
        ],
        image: img("cotation-01-formulaire.png"),
        etapes: [
          {
            titre: "Remplir une offre",
            texte: "Choisissez la Compagnie et la Branche (Maladie/Assistance), rattachez éventuellement un Appel d'offres (le Client se remplit alors seul), la Population, la Territorialité, les taux de couverture (Ambulatoire/Hospitalisation), le Plafond familial, les conditions de fermeté, les limites d'âge adulte/enfant, les exclusions, une clause d'ajustement, puis construisez le tableau de garanties (« Ajouter une garantie ») et enfin la Prime nette/personne, le prix de la Carte/personne et les Accessoires.",
          },
          {
            titre: "Ajouter l'offre à la cotation",
            texte: "Cliquez sur « Ajouter cette offre à la cotation » — l'offre est mise en attente dans la liste « Offres de cette cotation » et le formulaire se réinitialise, prêt pour une autre compagnie ou une autre branche pour le même client.",
          },
          {
            titre: "Enregistrer et générer le document",
            texte: "Une fois toutes les offres ajoutées, cliquez sur « Enregistrer la cotation (n) » — toutes les offres en attente sont sauvegardées en une fois et le document PDF combiné s'ouvre automatiquement. Une cotation déjà enregistrée peut être rouverte via « Modifier » puis « Enregistrer les modifications ».",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ PRODUCTION ══════════════════════════
  {
    id: "contrats",
    titre: "Contrats",
    sections: [
      {
        titre: "Créer et faire vivre une police Maladie ou Assistance",
        texte: [
          "L'écran « Contrats » liste toutes les polices en portefeuille : n° police, souscripteur, branche, compagnie, période, prime annuelle, échéance et statut. Les onglets Tous/Actif/En renouvellement/Expiré/Résilié filtrent instantanément, et un bandeau permet de restreindre l'affichage à « Toutes branches », « Assistance » ou « Maladie ». Les boutons « Import en masse » (reprise CSV d'un portefeuille) et « Nouveau contrat » sont en en-tête.",
        ],
        image: img("03-contrats.png"),
        etapes: [
          {
            titre: "Onglet « Informations générales »",
            texte: "Cliquez sur « Nouveau contrat ». Choisissez la Branche (Maladie/Assistance), le Souscripteur, la Compagnie (ou « Compagnie interne » pour une Mutuelle/Compagnie en auto-gestion), le Numéro de police, le Produit, les dates d'Effet et d'Échéance, la Périodicité (Mensuel/Trimestriel/Semestriel/Annuel), le Statut, le pays de souscription et les extensions de territorialité. Pour un contrat Assistance, vous pouvez le lier à un contrat Maladie existant.",
            image: img("contrats-02-nouveau-infos-generales.png"),
          },
          {
            titre: "Onglet « Population »",
            texte: "Importez la population par fichier CSV (téléchargez d'abord « Télécharger le modèle », remplissez-le, puis déposez-le — un tableau éditable apparaît avant validation finale) ou saisissez les personnes une par une via « Ajouter une personne » (Nom, Date de naissance, Cotisation/mois, nombre d'Ayants droit).",
            image: img("contrats-03-population.png"),
          },
          {
            titre: "Onglet « Calcul de la prime »",
            texte: "Disponible à la création : cet onglet calcule la prime nette du contrat à partir de la population saisie et des taux/tranches d'âge configurés sur la compagnie — la prime n'est cependant pas obligatoire pour créer le contrat, elle peut être affinée plus tard via un avenant.",
          },
          {
            titre: "Onglet « Garanties »",
            texte: "Construisez le tableau de garanties : taux Ambulatoires/Hospitalisations « Résumé global » (impacte automatiquement les rubriques concernées), taux par type de structure (public/privé, affichés sur la carte d'assurance), taux ayants droit optionnels, puis le tableau détaillé rubrique par rubrique — utilisez « Charger le tableau standard » pour partir d'un modèle déjà paramétré, ou « + Ajouter une rubrique » / la liste déroulante « + Depuis le catalogue... » pour construire ligne à ligne.",
            image: img("contrats-04-garanties.png"),
          },
          {
            titre: "Créer, puis faire vivre le contrat",
            texte: "Cliquez sur « Créer » — le contrat, sa population et ses garanties sont enregistrés ensemble en une seule fois, aucune étape de validation séparée n'est requise. Pour le modifier ensuite, cliquez sur la ligne du contrat : le même formulaire s'ouvre avec des onglets supplémentaires « Historique des mouvements », « Consommations » et « Prises en Charge ». Depuis la liste, deux icônes par ligne donnent un accès rapide à « Gérer les assurés » (population) et « Accès au portail assuré » (génération de comptes mobiles).",
          },
        ],
      },
    ],
  },
  {
    id: "renouvellements",
    titre: "Renouvellements",
    sections: [
      {
        titre: "Relancer et transformer une échéance en renouvellement",
        texte: [
          "L'écran « Renouvellements » liste automatiquement les contrats qui arrivent à échéance — ce n'est jamais une saisie manuelle. Les onglets Tous/À renouveler/Relancé/Renouvelé/Perdu filtrent la liste.",
        ],
        image: img("renouvellements-01-liste.png"),
        etapes: [
          {
            titre: "Relancer le souscripteur",
            texte: "Sur une ligne « À renouveler », cliquez sur « Relancer » pour générer/envoyer l'avis d'échéance — le statut passe à « Relancé ». Le bouton d'en-tête « Lancer les relances » fait cette action en masse sur toutes les échéances dues.",
          },
          {
            titre: "Concrétiser ou perdre le renouvellement",
            texte: "Cliquer sur « Renouveler » ne change PAS le statut directement : vous êtes redirigé vers l'écran Avenants pour y créer un avenant de type « Renouvellement », qui doit ensuite être Validé puis Appliqué au contrat (voir le chapitre Quittances et Avenants). Cliquer sur « Perdu » marque au contraire le renouvellement comme perdu et crée automatiquement une demande de résiliation, à traiter dans l'écran Résiliations.",
          },
        ],
      },
    ],
  },
  {
    id: "avenants",
    titre: "Quittances et Avenants",
    sections: [
      {
        titre: "Ajuster un contrat en 3 étapes : Créer → Valider → Appliquer",
        texte: [
          "L'écran « Quittances et Avenants » présente chaque avenant sous forme de carte, avec un badge de statut : Brouillon, Validé ou Appliqué.",
        ],
        image: img("avenants-01-liste.png"),
        etapes: [
          {
            titre: "Créer l'avenant (statut Brouillon)",
            texte: "Cliquez sur « Nouvel avenant ». Choisissez le Contrat, le Type (Ajustement de Prime, Régularisation de Prime, Renouvellement, Incorporation, Retrait), la Date d'effet, la Prime avant / Prime après et une Description, puis cliquez sur « Créer ». L'avenant apparaît avec le badge « Brouillon ».",
            image: img("avenants-02-nouveau.png"),
          },
          {
            titre: "Valider",
            texte: "Sur la carte de l'avenant, cliquez sur « Valider » — le badge passe à « Validé ». Cette étape confirme le contenu de l'avenant sans encore modifier le contrat.",
          },
          {
            titre: "Appliquer au contrat",
            texte: "Cliquez enfin sur « Appliquer au contrat » — c'est cette dernière action, et seulement elle, qui met réellement à jour la prime/la population du contrat. Le badge passe à « Appliqué ». Depuis la carte, vous pouvez aussi télécharger la « Quittance », le document « Avenant » et, pour un renouvellement, le « Tableau de garanties ».",
          },
        ],
      },
    ],
  },
  {
    id: "demandes-client",
    titre: "Demandes client",
    sections: [
      {
        titre: "Traiter les demandes d'incorporation/retrait venues du portail client",
        texte: [
          "Cet écran ne comporte aucun bouton de création : les demandes y arrivent déjà déposées par le client lui-même depuis son portail, avec le statut « En attente ». Les pastilles de filtre (En attente/Accordée/Refusée/Toutes) permettent de retrouver un dossier.",
        ],
        image: img("demandes-client-01-liste.png"),
        etapes: [
          {
            titre: "Accorder la demande",
            texte: "Sur une ligne « En attente », cliquez sur « Accorder ». Renseignez la Date d'effet et, pour une incorporation, le nombre d'Ayants droit et la Cotisation/mois de chaque bénéficiaire, puis « Confirmer » — le mouvement de population est appliqué immédiatement, sans étape supplémentaire.",
          },
          {
            titre: "Refuser la demande",
            texte: "Cliquez sur « Refuser », saisissez le Motif du refus, puis « Confirmer ».",
          },
        ],
      },
    ],
  },
  {
    id: "resiliations",
    titre: "Résiliations",
    sections: [
      {
        titre: "Résilier un contrat en 3 étapes : Demander → Valider → Rendre effective",
        texte: [
          "L'écran « Résiliations » liste les demandes de résiliation avec leur motif, leur initiateur, leur date d'effet et leur statut.",
        ],
        image: img("resiliations-01-liste.png"),
        etapes: [
          {
            titre: "Créer la demande (statut Demandée)",
            texte: "Cliquez sur « Nouvelle résiliation ». Recherchez le Contrat, choisissez le Motif (Non-paiement, Demande client, Non-renouvellement, Fraude, Autre), la Date d'effet, une éventuelle Ristourne et l'Initiateur, puis « Créer ».",
            image: img("resiliations-02-nouvelle.png"),
          },
          {
            titre: "Valider puis rendre effective",
            texte: "Cliquez sur « Valider » (statut → Validée), puis, le moment venu, sur « Rendre effective » (confirmation demandée) — le contrat est alors réellement clôturé et le statut passe à « Effective ». La demande ne peut être supprimée (icône corbeille) qu'avant ce dernier stade.",
          },
        ],
      },
    ],
  },
  {
    id: "participants",
    titre: "Participants",
    sections: [
      {
        titre: "Affilier un assuré et gérer sa famille",
        texte: [
          "L'écran « Participants » liste les assurés principaux avec leur matricule, leur nombre d'ayants droit, leur cotisation mensuelle et le statut de leur carte. Un panneau de recherche avancée filtre par Contrat, Nom/prénom, Matricule, Type et Statut.",
        ],
        image: img("04-participants.png"),
        etapes: [
          {
            titre: "Affilier un nouvel assuré principal",
            texte: "Cliquez sur « Nouvelle affiliation ». Renseignez son Identité (Nom, Prénom, Date de naissance), son Affiliation (Contrat, nombre d'Ayants droit, Cotisation/mois), ses coordonnées (Téléphone, Statut matrimonial) et, si disponible, une Photo, puis cliquez sur « Affilier ». La personne est immédiatement active : matricule, numéro d'assuré et QR code sont générés automatiquement.",
            image: img("participants-02-nouvelle-affiliation.png"),
          },
          {
            titre: "Ajouter un ayant droit",
            texte: "Depuis la fiche de l'assuré principal, cliquez sur « + Ajouter » puis renseignez Nom, Prénom, Lien (Conjoint/Enfant), Date de naissance et, pour un enfant, la case « Enfant scolarisé ».",
          },
          {
            titre: "Explorer la fiche complète",
            texte: "Cliquez sur « Voir le profil » pour ouvrir un tiroir à 4 onglets : « Informations » (identité/contact/photo, éditable), « Carte » (aperçu/génération de carte, feuille d'examen, feuille de soins, activer/désactiver la carte), « Consommations » (historique de soins) et « Statut & mouvements » (Suspendre/Réactiver, Basculer vers un autre contrat, Retirer du contrat — chacune de ces 3 actions crée automatiquement un avenant et prend effet immédiatement une fois confirmée).",
          },
        ],
      },
    ],
  },
  {
    id: "facture-production",
    titre: "Facture Production",
    sections: [
      {
        titre: "Facturer une compagnie sur son papier en-tête",
        texte: [
          "L'écran « Facture Production » liste les factures déjà émises à une compagnie (n°, souscripteur, objet, montant). Les filtres (Compagnie, Souscripteur, dates, n° facture) s'appliquent automatiquement, sans bouton « Rechercher ».",
        ],
        image: img("facture-production-01-liste.png"),
        etapes: [
          {
            titre: "Créer la facture",
            texte: "Cliquez sur « Nouvelle facture de production » et choisissez d'abord le Souscripteur : l'application recherche automatiquement ses mouvements (Affaire Nouvelle/Avenant) pas encore facturés, pré-remplit la Compagnie si elle est unique, et génère les « Lignes de la facture » correspondantes. Complétez la Date et le Lieu d'émission, les références de Bon de Réception/Commande, l'Objet (avec suggestions), le Type de paiement et une Note de paiement (pré-remplie depuis le modèle de la compagnie). Ajustez les lignes si besoin (« Ajouter une ligne » / suppression par ligne).",
            image: img("facture-production-02-modal.png"),
          },
          {
            titre: "Générer",
            texte: "Cliquez sur « Générer la facture » — le PDF s'ouvre automatiquement sur le papier en-tête de la compagnie. Le document reste accessible via « Voir le PDF » sur la ligne correspondante de la liste.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ FACTURES & PRISES EN CHARGE ══════════════════════════
  {
    id: "factures",
    titre: "Factures",
    sections: [
      {
        titre: "De la facture prestataire au règlement : le cycle complet",
        texte: [
          "L'écran « Factures » (onglet « Factures (n) », à côté de « Remboursements (n) » pour les déclarations faites par l'assuré lui-même) recense les factures des prestataires. Un panneau de recherche filtre par Prestataire, Souscripteur, Contrat, Statut, période de réception et référence.",
        ],
        image: img("05-factures.png"),
        etapes: [
          {
            titre: "Étape 1 — Créer la facture (en-tête)",
            texte: "Cliquez sur « Nouvelle facture ». Recherchez le Prestataire puis le Souscripteur (le Contrat se filtre alors sur ce souscripteur), vérifiez la Date de réception et saisissez la Référence de la facture (celle imprimée par le prestataire), puis cliquez sur « Créer la facture ».",
            image: img("factures-02-modal-nouvelle.png"),
          },
          {
            titre: "Étape 2 — Rechercher le prestataire et le souscripteur",
            texte: "Les champs Prestataire et Souscripteur sont des combobox « recherche-à-la-frappe » : tapez quelques lettres, la liste se filtre en direct, cliquez sur le résultat voulu.",
            image: img("factures-04-recherche-prestataire.png"),
          },
          {
            titre: "Étape 3 — La facture est créée, en statut « En saisie »",
            texte: "La création ouvre immédiatement la saisie détaillée (voir ci-dessous) — la facture existe déjà en base avec le statut « En saisie », mais ne contient encore aucune ligne de soins.",
            image: img("factures-06-formulaire-complet.png"),
          },
          {
            titre: "Étape 4 — Ajouter une ligne de soins",
            texte: "Le formulaire de ligne s'ouvre automatiquement (bouton « Ajouter une ligne » / « Masquer le formulaire » pour le rouvrir/refermer). Choisissez l'Assuré/ayant droit, le Type de prestation, une éventuelle Référence de prise en charge déjà accordée, la Date de prestation, puis dans « Identification de l'acte » : la Famille d'acte puis l'Acte médical (et la Quantité). Si l'acte est une lettre-clé « KC » (chirurgie), une case à cocher propose de générer automatiquement les 2 lignes liées KA (anesthésiste) et K Loc (location du bloc) avec leurs coefficients dérivés.",
          },
          {
            titre: "Étape 5 — Dossier sinistre santé et tarification",
            texte: "Complétez N° Sinistre, N° Déclaration, la Nature de l'affection et le Code affection (CNAMGS) — tous deux obligatoires. Le taux/part de prise en charge s'affiche automatiquement (pourcentage ou plafond selon la rubrique — ce choix n'est jamais manuel, l'application le déduit du type de garantie). Ajustez les Frais réels, et si le contrôle médical rejette une partie, indiquez le Montant rejeté et son Motif. Cliquez sur « Ajouter la ligne ». Répétez pour chaque soin de la facture ; chaque ligne peut ensuite être corrigée (crayon), rejetée (icône Interdiction, avec motif) ou supprimée (corbeille, confirmation demandée).",
          },
          {
            titre: "Étape 6 — Terminer la facture",
            texte: "Une fois toutes les lignes saisies, cliquez sur « Terminer la facture » — le statut passe de « En saisie » à « Soumise ». Le bouton « Décompte » imprime à tout moment le document récapitulatif ; « Annuler la facture » (avec motif obligatoire) reste possible en cas d'erreur.",
          },
          {
            titre: "Étape 7 — Générer le règlement",
            texte: "Une fois « Soumise », la facture devient éligible dans l'écran Règlement : un gestionnaire clique sur « Générer un règlement », choisit le Prestataire (obligatoire) et éventuellement Compagnie/Souscripteur/période, clique sur « Rechercher » pour lister les factures non réglées de ce prestataire (toutes pré-cochées), décoche si besoin, puis clique sur « Générer le règlement (n) » — un bordereau est créé au statut « Reçu ».",
          },
          {
            titre: "Étape 8 — Valider puis payer",
            texte: "Dans le détail du bordereau (Règlement), un gestionnaire clique sur « Valider » (statut → Validé), puis sur « Marquer payé », saisit la Référence du virement, et le statut passe à « Payé ». La facture d'origine affiche alors le badge « Réglée — N° {bordereau} » : le cycle est bouclé.",
          },
        ],
      },
      {
        titre: "Remboursements (déclaration par l'assuré ou le souscripteur)",
        texte: [
          "L'onglet « Remboursements » suit exactement le même cycle que les Factures (saisie de lignes → Terminer la déclaration → Générer un règlement → Valider → Marquer payé), avec deux différences à la création : on choisit d'abord « L'assuré principal » ou « Le souscripteur » comme bénéficiaire du remboursement, puis chaque ligne demande en plus le Prestataire consulté — recherché dans le réseau conventionné, ou son nom en texte libre s'il n'est pas conventionné.",
          "La sous-liste « Demandes reçues du portail assuré » regroupe les remboursements que l'assuré a lui-même déclarés en ligne — le bouton « Modifier » y ouvre un formulaire simplifié pour les compléter/corriger avant traitement.",
        ],
      },
    ],
  },
  {
    id: "prise-en-charge",
    titre: "Prise en charge (entente préalable)",
    sections: [
      {
        titre: "Autoriser un soin avant qu'il ne soit dispensé",
        texte: [
          "L'écran « Prise en charge » gère les demandes d'entente préalable — hospitalisation, chirurgie, EVASAN — qui doivent être analysées et autorisées avant d'être dispensées. Un bandeau signale le nombre de demandes en attente de décision.",
        ],
        image: img("06-prise-en-charge.png"),
        etapes: [
          {
            titre: "Créer la demande",
            texte: "Cliquez sur « Nouvelle demande ». Choisissez l'Assuré, l'Origine (Saisie agent / Portail Prestataire / Portail Assuré), le Type (la rubrique de garantie concernée — le plafond s'affiche en aide), le Prestataire et la Date. Joignez si possible l'Ordonnance et le Devis. Ajoutez ensuite un ou plusieurs actes (Famille puis Acte médical — un acte KC ajoute automatiquement ses 3 lignes liées) avec leurs Frais réels ; un tableau récapitule le remboursement estimé et le reste à charge, ligne par ligne. Cliquez sur « Enregistrer la demande » — elle démarre avec la décision « En attente ».",
            image: img("prise-en-charge-02-modal-nouvelle.png"),
          },
          {
            titre: "Validation médicale puis financière",
            texte: "Sur la ligne du dossier, un gestionnaire clique d'abord sur « Valider analyse » (revue médicale), puis, une fois celle-ci faite, sur « Valider finance » (revue financière). Ces deux validations sont un préalable obligatoire à toute décision.",
          },
          {
            titre: "Accorder ou refuser",
            texte: "Une fois les deux validations faites, deux icônes apparaissent : le crochet vert « Accorder » (demande le Montant autorisé, une suggestion est proposée) ou la croix rouge « Refuser ». La décision est enregistrée avec sa date.",
          },
          {
            titre: "Imprimer le certificat",
            texte: "Une fois « Accordé », l'icône « Certificat de prise en charge » permet d'imprimer le document à remettre au prestataire — celui-ci n'a ensuite qu'à saisir la référence du dossier lors de la facturation (voir chapitre Factures, la « Référence de prise en charge » d'une ligne).",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ RÉSEAU DE SOINS ══════════════════════════
  {
    id: "prestataires",
    titre: "Prestataires",
    sections: [
      {
        titre: "Gérer le réseau de soins conventionné",
        texte: [
          "L'écran « Prestataires » affiche une liste maître-détail, groupée par Ville puis par Type, avec une recherche libre et des filtres Type/Ville. Les boutons d'en-tête permettent de « Télécharger le réseau de soins » et de « Géolocaliser le réseau » (localise en masse tous les prestataires non encore géolocalisés).",
        ],
        image: img("07-prestataires.png"),
        etapes: [
          {
            titre: "Créer un prestataire",
            texte: "Cliquez sur « Nouveau prestataire ». Renseignez l'Identité (Nom, Type, Secteur Public/Privé, Spécialité, Pays, Ville, Téléphone, Adresse), le Conventionnement (Statut, Date), la visibilité côté Portail Prestataire (catégories de garanties et groupes d'actes autorisés) et, si applicable, l'assujettissement à la TPS (9,5 % — avec sa date d'effet). Cliquez sur « Créer ».",
            image: img("prestataires-02-nouveau.png"),
          },
          {
            titre: "Gérer un prestataire existant",
            texte: "Depuis sa fiche : le bouton « Imprimer la fiche » édite son document signalétique ; le toggle « Public »/« Privé » enregistre immédiatement le secteur (utilisé dans le calcul des remboursements) ; « Localiser » (en édition) géocode son adresse ; « Suspendre le prestataire » (avec motif) ou « Réhabiliter le prestataire » ferme/rouvre son accès au réseau conventionné.",
          },
        ],
      },
    ],
  },
  {
    id: "reglement-prestataire",
    titre: "Règlement",
    sections: [
      {
        titre: "Regrouper des factures validées en un règlement, puis les payer",
        texte: [
          "L'écran « Règlement » combine un historique consultable (« Historique des factures par exercice », filtrable par prestataire/banque/compagnie/période/référence) et la liste des « Règlements établis » (bordereaux), avec leurs statuts Reçu/En validation/Validé/Payé/Rejeté.",
        ],
        image: img("reglement-prestataire-01-liste.png"),
        etapes: [
          {
            titre: "Générer un règlement (bordereau)",
            texte: "Cliquez sur « Générer un règlement ». Choisissez le Prestataire (obligatoire), puis éventuellement Compagnie, Souscripteur, période, et — si le prestataire a des médecins rattachés — à l'ordre de qui établir le règlement. Cliquez sur « Rechercher » : toutes les factures/remboursements « Soumis » et non réglés de ce prestataire apparaissent, pré-cochés. Décochez ceux à exclure, puis cliquez sur « Générer le règlement (n) ».",
            image: img("reglement-prestataire-02-modal.png"),
          },
          {
            titre: "Valider puis marquer payé",
            texte: "Ouvrez le bordereau créé (statut « Reçu ») : cliquez sur « Valider » (→ « Validé ») ou « Rejeter » si un problème est détecté. Une fois Validé, cliquez sur « Marquer payé », saisissez la Référence du virement — le statut passe à « Payé » et chaque facture d'origine affiche désormais son numéro de règlement.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ FINANCE ══════════════════════════
  {
    id: "comptabilite",
    titre: "Comptabilité",
    sections: [
      {
        titre: "Journal général et lettrage clients/fournisseurs",
        texte: [
          "L'écran « Comptabilité » (plan SYSCOHADA) comporte 3 onglets : « Journal général » (4 indicateurs clés + le journal comptable), « Lettrage clients » et « Lettrage fournisseurs » (comptes soldés vs solde ouvert, avec détail des mouvements non rapprochés par compte).",
        ],
        image: img("comptabilite-01-journal.png"),
        etapes: [
          {
            titre: "Saisir une écriture manuelle",
            texte: "Depuis l'onglet « Journal général », cliquez sur « Nouvelle saisie ». Renseignez la Date, le Compte (plan OHADA, ex. 701000), le Libellé, puis soit un Débit soit un Crédit (renseigner l'un remet l'autre à zéro). Cliquez sur « Enregistrer ».",
            image: img("comptabilite-02-nouvelle-ecriture.png"),
          },
          {
            titre: "Suivre le lettrage",
            texte: "Dans « Lettrage clients »/« Lettrage fournisseurs », cliquez sur un compte pour dérouler ses mouvements (date, libellé, montant, lettre) et identifier ce qui reste non rapproché.",
          },
        ],
      },
    ],
  },
  {
    id: "reglement-comptable",
    titre: "Règlement comptable",
    sections: [
      {
        titre: "Émettre les lettres-chèques aux prestataires",
        texte: [
          "L'écran « Règlement comptable » recherche et liste les lettres-chèques déjà émises (par prestataire, banque, compagnie, période ou référence).",
        ],
        image: img("reglement-comptable-01-liste.png"),
        etapes: [
          {
            titre: "Générer une lettre-chèque",
            texte: "Cliquez sur « Générer un règlement comptable ». Choisissez la Banque puis le Prestataire (Compagnie optionnelle), cliquez sur « Rechercher » : les bordereaux déjà « Validé » en attente de chèque s'affichent, pré-cochés. Cliquez sur « Générer la lettre chèque (n) » — le prochain numéro de chèque du lot actif de la banque est consommé automatiquement.",
            image: img("reglement-comptable-02-modal.png"),
          },
          {
            titre: "Configurer les banques et leurs séries de chèques",
            texte: "Si aucun lot de chèques n'est disponible, cliquez sur « Gérer les banques » : ajoutez une banque (Nom, Code, N° de compte) puis un lot pour cette banque (numéro de chèque de départ et numéro de fin). Chaque génération de lettre-chèque décrémente ensuite le nombre de chèques restants de ce lot.",
          },
        ],
      },
    ],
  },
  {
    id: "etat-tps",
    titre: "État TPS",
    sections: [
      {
        titre: "Consulter la TPS prélevée par prestataire",
        texte: [
          "Écran de consultation uniquement (aucune saisie) : filtrez par Prestataire, Exercice et/ou période, cliquez sur « Rechercher » (un état non filtré se charge aussi automatiquement à l'ouverture). Chaque ligne mensuelle est dépliable pour voir le détail des factures ayant contribué à la TPS de ce mois. Les boutons « Imprimer cet état » et « Liste des prestataires assujettis » génèrent les documents correspondants.",
        ],
        image: img("etat-tps-01-liste.png"),
      },
    ],
  },
  {
    id: "bordereau-sinistres",
    titre: "Bordereau Sinistres",
    sections: [
      {
        titre: "Réclamer le fonds de roulement à une compagnie",
        texte: [
          "Écran de reporting : choisissez obligatoirement une Compagnie, le Type de règlement (« Règlement Maladie » ou « Règlement Comptable ») et une période, cliquez sur « Rechercher » — les sinistres réglés apparaissent groupés par souscripteur avec sous-totaux et total général. « Imprimer » ou « Excel » génèrent le document à adresser à la compagnie pour réclamer le renflouement du fonds de roulement.",
        ],
        image: img("bordereau-sinistres-01-liste.png"),
      },
    ],
  },
  {
    id: "bordereau-production",
    titre: "Bordereau Production",
    sections: [
      {
        titre: "États CIMA d'émission de primes et commissions",
        texte: [
          "Écran de reporting : filtrez par Compagnie et/ou période puis « Rechercher » (se recharge aussi automatiquement au changement de compagnie). Chaque compagnie obtient sa propre table (police, assuré, quittance, primes, taxes, commission) avec un total, exportable en « Imprimer ce bordereau » ou « Excel ».",
        ],
        image: img("bordereau-production-01-liste.png"),
      },
    ],
  },
  {
    id: "bordereau-encaissement",
    titre: "Bordereau Encaissement",
    sections: [
      {
        titre: "Enregistrer les primes réellement encaissées",
        texte: [
          "Même reporting que Bordereau Production (par compagnie, exportable), mais avec en plus une saisie réelle des encaissements.",
        ],
        image: img("bordereau-encaissement-01-liste.png"),
        etapes: [
          {
            titre: "Enregistrer un encaissement",
            texte: "Cliquez sur « Nouvel encaissement ». Choisissez le Contrat/Souscripteur, le Montant encaissé et la Date d'encaissement (obligatoires), puis, si connu, le Mode de paiement (Virement/Chèque/Espèces/Mobile Money), une Référence et une Note. Cliquez sur « Enregistrer » — l'encaissement apparaît aussitôt dans le bordereau de la compagnie concernée.",
            image: img("bordereau-encaissement-02-modal.png"),
          },
        ],
      },
    ],
  },
  {
    id: "commissions",
    titre: "Commissions",
    sections: [
      {
        titre: "Suivre et reverser les commissions du courtier",
        texte: [
          "Les commissions sont calculées AUTOMATIQUEMENT (primes nettes des contrats × taux de commission configuré par compagnie) — il n'existe aucune saisie manuelle de montant. Filtrez par période et cliquez sur « Rechercher » pour voir le détail par compagnie (tableau + graphique).",
        ],
        image: img("commissions-01-liste.png"),
        etapes: [
          {
            titre: "Marquer une commission reversée",
            texte: "Restreignez d'abord le filtre Du/Au à un seul mois, puis cliquez sur « Marquer reversé » sur la ligne concernée — cela confirme que la compagnie a effectivement payé sa commission au courtier pour ce mois-là.",
          },
        ],
      },
    ],
  },
  {
    id: "recouvrement",
    titre: "Recouvrement",
    sections: [
      {
        titre: "Gérer les impayés et leurs relances",
        texte: [
          "L'écran « Recouvrement » propose deux vues : « Liste des impayés » (tableau) et « Vue par niveau de relance » (Kanban : Relance 1, Relance 2, Mise en demeure, Contentieux).",
        ],
        image: img("recouvrement-01-liste.png"),
        etapes: [
          {
            titre: "Relancer",
            texte: "Sur un dossier, cliquez sur « Relancer » pour faire passer son niveau de relance à l'étape suivante — ou cliquez sur « Lancer une relance » en en-tête pour escalader en masse tous les dossiers éligibles d'un cran.",
            image: img("recouvrement-02-kanban.png"),
          },
          {
            titre: "Résoudre",
            texte: "Une fois la dette recouvrée, cliquez sur « Résoudre » — le dossier disparaît de la liste des impayés actifs.",
          },
        ],
      },
    ],
  },
  {
    id: "tresorerie",
    titre: "Trésorerie",
    sections: [
      {
        titre: "Suivre les comptes bancaires et rapprocher les flux",
        texte: [
          "L'écran affiche un solde consolidé, une carte par compte bancaire, puis un fil chronologique des flux récents (entrée/sortie, avec indicateur de rapprochement).",
        ],
        image: img("tresorerie-01-liste.png"),
        etapes: [
          {
            titre: "Enregistrer un mouvement",
            texte: "Cliquez sur « Nouveau mouvement ». Choisissez le Compte, un Libellé, le Type (Encaissement/Décaissement) et le Montant, puis « Enregistrer ».",
            image: img("tresorerie-02-modal.png"),
          },
          {
            titre: "Rapprocher un flux",
            texte: "Sur un flux non encore rapproché (icône horloge orange), cliquez sur l'icône pour le marquer « Rapproché » (coche verte) une fois confirmé avec le relevé bancaire.",
          },
        ],
      },
    ],
  },
  {
    id: "fonds-de-roulement",
    titre: "Fonds de Roulement",
    sections: [
      {
        titre: "Suivre les fonds d'auto-gestion santé par contrat",
        texte: [
          "Chaque contrat en auto-gestion santé est représenté par une carte avec une barre de progression (montant consommé / montant initial) et un badge Normal/Alerte/Épuisé.",
        ],
        image: img("fonds-roulement-01-liste.png"),
        etapes: [
          {
            titre: "Alimenter un fonds",
            texte: "Cliquez sur « Alimenter un fonds ». Choisissez le Contrat, le Montant initial et un Seuil d'alerte, puis « Enregistrer ».",
            image: img("fonds-roulement-02-modal.png"),
          },
          {
            titre: "Enregistrer une consommation",
            texte: "Sur la carte du fonds, cliquez sur « Enregistrer une consommation » — une boîte de dialogue demande le montant consommé ; la barre de progression et le badge se mettent à jour immédiatement.",
          },
        ],
      },
    ],
  },
  {
    id: "honoraires",
    titre: "Honoraires de Gestion",
    sections: [
      {
        titre: "Facturer les honoraires de gestion (sinistres × taux)",
        texte: [
          "Les honoraires de gestion se calculent comme : montant des sinistres × taux convenu, par client et par période.",
        ],
        image: img("honoraires-01-liste.png"),
        etapes: [
          {
            titre: "Créer une facturation d'honoraires",
            texte: "Cliquez sur « Nouvelle facturation ». Choisissez le Contrat, donnez un libellé de Période (ex. « Octobre 2024 »), le Taux (%), le Montant sinistres et, si applicable, un Plafond, puis « Enregistrer ».",
            image: img("honoraires-02-modal.png"),
          },
          {
            titre: "Facturer",
            texte: "Une fois prêt à émettre la facture au client, cliquez sur « Facturer » sur la ligne — le statut passe à « Facturé ».",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ OUTILS ══════════════════════════
  {
    id: "ged",
    titre: "GED & Documents",
    sections: [
      {
        titre: "Classer un document automatiquement par IA",
        texte: [
          "Il n'y a pas de bouton « Nouveau » : on dépose directement un fichier sur la zone « Glissez vos documents ici ».",
        ],
        image: img("13-ged.png"),
        etapes: [
          {
            titre: "Déposer et classer",
            texte: "Glissez un fichier sur la zone de dépôt — l'analyse OCR et le classement automatique se lancent (spinner « Analyse en cours… »). Une fois le type et les tags détectés, saisissez l'« Entité liée » (client, contrat, prestataire…) et cliquez sur « Enregistrer dans la GED ». « Annuler » abandonne le classement proposé.",
          },
          {
            titre: "Supprimer un document",
            texte: "Cliquez sur l'icône corbeille de la ligne concernée (confirmation demandée).",
          },
        ],
      },
    ],
  },
  {
    id: "ia",
    titre: "Assistant IA",
    sections: [
      {
        titre: "Poser une question à l'assistant intelligent",
        texte: [
          "Tapez votre question dans le champ de discussion et appuyez sur Entrée (ou cliquez sur l'icône d'envoi), ou cliquez directement sur l'une des « Suggestions rapides » proposées dans le panneau latéral. Le panneau « Capacités IA » rappelle ce que l'assistant sait faire : analyse de contrats/polices, détection de fraudes/anomalies, génération de courriers, rapports automatisés, audit de conformité CIMA, scoring de risques clients.",
        ],
        image: img("ia-01-chat.png"),
      },
    ],
  },
  {
    id: "rapports",
    titre: "Reporting & KPIs",
    sections: [
      {
        titre: "Télécharger le rapport de pilotage",
        texte: [
          "Cet écran affiche 4 indicateurs clés (taux de transformation, ratio S/P, prime moyenne par contrat, taux de recouvrement), calculés en direct à partir des données réelles. Cliquez sur « Télécharger le rapport de pilotage » pour générer le PDF correspondant à l'exercice en cours.",
        ],
        image: img("rapports-01-kpis.png"),
      },
    ],
  },
  {
    id: "journal-operations",
    titre: "Journal des opérations",
    sections: [
      {
        titre: "Auditer qui a fait quoi",
        texte: [
          "Journal d'audit en lecture seule : chaque action (Créé/Modifié/Clôturé/Supprimé) sur chaque entité (contrats, factures, prises en charge, règlements, souscripteurs, participants, avenants, renouvellements, résiliations, sinistres, prestataires, catalogue, devis, cotation, appels d'offres…) y est journalisée avec l'utilisateur, la date et le dossier concerné. Filtrez par Entité, Action, Agent, N° dossier ou période puis « Rechercher ». Les boutons « Télécharger l'état global » (Excel) et « Imprimer l'état global » (PDF) exportent exactement la vue filtrée à l'écran.",
        ],
        image: img("journal-operations-01-liste.png"),
      },
    ],
  },
  {
    id: "suivi-agents",
    titre: "Suivi de production par agent",
    sections: [
      {
        titre: "Comparer l'activité des gestionnaires",
        texte: [
          "Tableau en lecture seule : nombre de factures et de règlements établis par agent, avec une barre proportionnelle au volume. Filtrez par période (Du/Au) puis « Rechercher ».",
        ],
        image: img("suivi-agents-01-liste.png"),
      },
    ],
  },
  {
    id: "courrier-maladie",
    titre: "Courrier Maladie",
    sections: [
      {
        titre: "Rédiger et imprimer un courrier officiel",
        texte: [
          "L'écran liste les courriers déjà émis (référence, type, destinataire, objet, auteur, date), filtrables par référence/type/destinataire/période.",
        ],
        image: img("courrier-maladie-01-liste.png"),
        etapes: [
          {
            titre: "Rédiger le courrier",
            texte: "Cliquez sur « Nouveau courrier ». Choisissez éventuellement un Modèle (pré-remplit automatiquement le corps avec les bons éléments), la Date, le mode de destinataire — « Libre » (nom/adresse saisis à la main), « Souscripteur » ou « Prestataire » (recherché, nom/adresse auto-remplis) — puis l'Objet et le Corps du courrier (éditeur enrichi).",
            image: img("courrier-maladie-02-editeur.png"),
          },
          {
            titre: "Générer",
            texte: "Cliquez sur « Enregistrer et générer le PDF » — une référence est attribuée automatiquement et le document s'ouvre aussitôt. Chaque courrier reste ensuite accessible via « Voir le PDF » depuis la liste.",
          },
        ],
      },
    ],
  },
  {
    id: "messagerie",
    titre: "Messagerie",
    sections: [
      {
        titre: "Assistant IA et reprise par un agent humain",
        texte: [
          "La « Messagerie » sépare « File d'attente » (conversations non prises en charge, ouvertes automatiquement par l'assistant IA) de « Mes conversations » (celles que vous avez prises). Chaque conversation externe apparaît toujours sous l'identité « Ariana », même après une reprise humaine — en interne, la vraie origine (IA ou agent) reste visible.",
        ],
        image: img("09-messagerie.png"),
        etapes: [
          {
            titre: "Prendre une conversation",
            texte: "Dans « File d'attente », cliquez sur « Prendre » sur la conversation à traiter — elle bascule dans « Mes conversations » et l'assistant IA n'y répond plus tant que vous la traitez.",
          },
          {
            titre: "Répondre",
            texte: "Ouvrez la conversation, tapez votre message dans le champ en bas (Entrée pour envoyer, Maj+Entrée pour un saut de ligne) et joignez éventuellement un fichier via le trombone.",
          },
        ],
      },
    ],
  },
  {
    id: "communications",
    titre: "Communications",
    sections: [
      {
        titre: "Journal des envois Email / SMS / WhatsApp",
        texte: [
          "L'écran liste tous les messages envoyés (canal, destinataire, déclencheur, statut, contenu), filtrables par canal et par type de destinataire.",
        ],
        image: img("communications-01-liste.png"),
        etapes: [
          {
            titre: "Envoyer un message manuel",
            texte: "Cliquez sur « Nouveau message ». Choisissez le Canal (Email/SMS/WhatsApp), le Type de destinataire, son Nom et son contact (adresse email ou numéro selon le canal), un Objet (email uniquement) et le Message, puis « Envoyer ».",
            image: img("communications-02-modal.png"),
          },
          {
            titre: "Enregistrer une réponse reçue",
            texte: "Sur un message sans retour encore enregistré, cliquez sur « Enregistrer un retour », tapez la réponse reçue et validez.",
          },
        ],
      },
    ],
  },

  // ══════════════════════════ SYSTÈME ══════════════════════════
  {
    id: "administration",
    titre: "Gestion des utilisateurs",
    sections: [
      {
        titre: "Comptes, rôles et droits par fonctionnalité",
        texte: [
          "L'écran « Administration » liste tous les comptes utilisateurs de votre société avec leur rôle et leur nombre de fonctionnalités autorisées. Le panneau de droite récapitule le nombre de comptes par rôle.",
        ],
        image: img("12-administration-utilisateurs.png"),
        etapes: [
          {
            titre: "Créer un utilisateur",
            texte: "Cliquez sur « Nouvel utilisateur ». Dans l'onglet « Informations », renseignez Nom complet, Initiales, Email, Téléphone, Adresse et le Rôle (choisir un rôle pré-remplit automatiquement l'onglet « Droits » avec le modèle par défaut de ce rôle).",
            image: img("administration-02-modal-infos.png"),
          },
          {
            titre: "Ajuster les droits",
            texte: "Dans l'onglet « Droits », cochez/décochez individuellement chaque fonctionnalité (regroupées par zone) — un module non couvert par l'abonnement de votre société apparaît verrouillé (🔒) et ne peut pas être coché. Le lien « Réinitialiser au modèle du rôle » revient à la sélection par défaut. Cliquez sur « Créer » — un mot de passe initial est communiqué.",
          },
          {
            titre: "Modifier ou retirer un accès",
            texte: "L'icône bouclier « Droits » rouvre directement l'onglet Droits d'un utilisateur ; l'icône crayon « Modifier » ouvre l'onglet Informations ; l'icône corbeille supprime le compte (impossible sur son propre compte). Le bouclier à côté d'un rôle, dans le panneau de droite, permet d'éditer le modèle par défaut de ce rôle pour les FUTURS utilisateurs (n'affecte jamais ceux déjà créés).",
          },
        ],
      },
    ],
  },
  {
    id: "parametres-entreprise",
    titre: "Paramètres de l'entreprise",
    sections: [
      {
        titre: "Identité, logo, modèle de carte et matricule",
        texte: [
          "L'écran « Paramètres de l'entreprise » définit l'identité visuelle et les coordonnées qui apparaissent sur tous les documents générés : quittances, courriers, prises en charge, factures, règlements et cartes d'assurance.",
        ],
        image: img("11-parametres-entreprise.png"),
        etapes: [
          {
            titre: "Identité et coordonnées",
            texte: "Le Logo s'importe/se supprime immédiatement (« + Télécharger »/« Supprimer », indépendant du bouton Enregistrer). Complétez Nom, Sous-titre, Code agence, puis Adresse, Boîte postale, Ville, Pays, Téléphone, Email, Site web.",
          },
          {
            titre: "Couleurs, carte et matricule",
            texte: "Choisissez la Couleur primaire et la Couleur secondaire (sélecteur ou code hexadécimal) — elles habillent bandeaux, titres et cartes. Choisissez un Modèle de carte (catalogue partagé, géré par le Super Admin) et un Préfixe matricule (ex. « LRX » — un aperçu du prochain matricule s'affiche en direct). Personnalisez si besoin le texte de verso de carte (introduction, numéro d'assistance, explication du QR code), superposé au modèle choisi.",
          },
          {
            titre: "Page de garde du rapport Statistiques",
            texte: "Importez une image A4 portrait pleine page pour remplacer la couverture par défaut du rapport Statistiques — les informations (client, police, période) restent superposées automatiquement par-dessus.",
          },
          {
            titre: "Enregistrer",
            texte: "Cliquez sur « Enregistrer » en haut de la page pour appliquer tous les champs texte/couleurs/sélections en une seule fois (les images, elles, se sauvegardent immédiatement à l'import).",
          },
        ],
      },
    ],
  },
  {
    id: "compagnies",
    titre: "Compagnies",
    sections: [
      {
        titre: "Paramétrer une compagnie porteuse de risque",
        texte: [
          "La grille de cartes liste les compagnies (logo, pays, contrats, taux de commission, primes). Cliquer sur une carte ouvre un tiroir à 9 onglets : Général, Commission, Papier en-tête & RIB, Accessoires, Surprimes d'âge, Clauses d'ajustement, Barèmes de prestations, Garanties, Contrats.",
        ],
        image: img("compagnies-01-grille.png"),
        etapes: [
          {
            titre: "Ajouter une compagnie",
            texte: "Cliquez sur « Ajouter compagnie », renseignez Nom, Pays et Code compagnie, puis « Créer » — le tiroir de paramétrage s'ouvre automatiquement.",
            image: img("compagnies-02-modal-ajout.png"),
          },
          {
            titre: "Paramétrer chaque onglet",
            texte: "Chaque onglet a son propre bouton « Enregistrer » indépendant : ajustez par exemple les taux dans « Commission », le texte légal exact dans « Papier en-tête & RIB », ou construisez les tableaux de « Garanties », « Accessoires », « Surprimes d'âge » et « Clauses d'ajustement » ligne par ligne (icône corbeille pour retirer une ligne). L'onglet « Contrats » est une vue en lecture seule des polices portées par cette compagnie.",
          },
        ],
      },
    ],
  },
  {
    id: "auto-gestion",
    titre: "Auto-Gestion",
    sections: [
      {
        titre: "Placer un souscripteur en auto-gestion santé",
        texte: [
          "Même écran que « Compagnies », mais pour les souscripteurs qui gèrent eux-mêmes leur risque santé (comme une IPM). Cliquez sur « Placer un souscripteur », choisissez le souscripteur (uniquement ceux pas encore en auto-gestion) — son profil s'ouvre alors dans le même tiroir à 9 onglets que pour une compagnie classique (commission, garanties, accessoires…).",
        ],
        image: img("autogestion-01-grille.png"),
      },
    ],
  },
  {
    id: "cartes-assurance",
    titre: "Cartes d'assurance",
    sections: [
      {
        titre: "Générer les cartes recto/verso d'un contrat",
        texte: [
          "Sélectionnez un Contrat pour charger sa population active. Cinq filtres (Nom, Famille, Matricule, Téléphone, Photo) affinent la liste, et des pastilles « Conformité des cartes » signalent en direct combien de dossiers sont complets ou incomplets (sans photo, sans téléphone, sans date de naissance…).",
        ],
        image: img("10-cartes-assurance.png"),
        etapes: [
          {
            titre: "Choisir le contrat",
            texte: "Recherchez le contrat par numéro de police ou nom du client dans le champ « Contrat » — la population active se charge automatiquement.",
            image: img("cartes-assurance-03-choix-contrat.png"),
          },
          {
            titre: "Générer",
            texte: "Cochez une ou plusieurs personnes puis cliquez sur « Générer la sélection (n) », ou cliquez directement sur « Générer tout le contrat » (confirmation demandée) pour produire les cartes de toute la population active en une fois — même sur un contrat de plusieurs milliers d'assurés. Le bouton « Aperçu » sur une ligne prévisualise/imprime une seule carte.",
            image: img("cartes-assurance-04-population-contrat.png"),
          },
          {
            titre: "Compléter les photos/téléphones manquants en masse",
            texte: "Cliquez sur « Import différé (photos/téléphones) », choisissez le Contrat, téléchargez le modèle CSV pré-rempli (uniquement les personnes avec une donnée manquante), complétez-le hors-ligne à côté d'un dossier de photos (chaque fichier nommé par le matricule), puis sélectionnez ce dossier complet (CSV + photos) via le sélecteur de dossier et cliquez sur « Importer » — les fiches sont mises à jour et les photos rattachées par matricule.",
            image: img("cartes-assurance-02-import-differe.png"),
          },
        ],
      },
    ],
  },
  {
    id: "garanties-catalogue",
    titre: "Catalogue de garanties",
    sections: [
      {
        titre: "Constituer la bibliothèque de rubriques réutilisables",
        texte: [
          "Basculez entre les branches Maladie/Assistance pour voir le catalogue de cette branche, organisé par Famille. Pour ajouter une rubrique : choisissez la Branche, saisissez/complétez la Famille (autocomplétion), le libellé de la Rubrique, et pour la branche Maladie les % par défaut Structures privées/publiques (l'Assistance n'utilise pas de taux ici), puis un Plafond de remboursement. Cliquez sur « Ajouter au catalogue ». Ce catalogue alimente ensuite le sélecteur « + Depuis le catalogue... » de l'onglet Garanties d'un Contrat.",
        ],
        image: img("garanties-catalogue-01-liste.png"),
      },
    ],
  },
  {
    id: "actes-medicaux",
    titre: "Catalogue des actes médicaux",
    sections: [
      {
        titre: "Nomenclature des actes et leur tarification",
        texte: [
          "Naviguez par famille (colonne de gauche) ou recherchez un acte par texte. Pour ajouter un acte : famille, libellé, catégorie de garantie liée, puis choisissez la tarification — soit un « Prix forfaitaire » saisi directement, soit une lettre-clé codifiée (le Coefficient saisi calcule alors le prix en direct : coefficient × valeur unitaire de la lettre). Cliquez sur « Ajouter au catalogue ».",
        ],
        image: img("actes-medicaux-01-liste.png"),
      },
    ],
  },
  {
    id: "professionnels-sante",
    titre: "Professionnel de santé",
    sections: [
      {
        titre: "Répertorier les médecins et leurs structures d'exercice",
        texte: [
          "La liste des médecins (spécialité, code praticien, structures rattachées) se recherche par nom/spécialité/code praticien.",
        ],
        image: img("medecins-01-liste.png"),
        etapes: [
          {
            titre: "Créer un médecin",
            texte: "Cliquez sur « Nouveau médecin ». Renseignez Titre, Code praticien (n° à l'ordre des médecins), Nom (seul champ obligatoire), Prénom, Spécialité, Téléphone, Email, puis recherchez et ajoutez une ou plusieurs structures (« Structures où il intervient ») — chacune apparaît comme un badge amovible. Cliquez sur « Créer ».",
            image: img("medecins-02-modal.png"),
          },
          {
            titre: "Activer/désactiver",
            texte: "L'icône alimentation (Power) sur une ligne bascule le médecin Actif/Inactif sans ouvrir le formulaire.",
          },
        ],
      },
    ],
  },
  {
    id: "lettres-cles",
    titre: "Lettres clés (nomenclature)",
    sections: [
      {
        titre: "Coder la tarification des actes (ex. KC, KA)",
        texte: [
          "Pour ajouter une lettre clé : Code (ex. « KC »), Libellé, Valeur unitaire (FCFA), puis restreignez éventuellement les Catégories de garantie et Spécialités médicales auxquelles elle s'applique (sinon « Toutes » par défaut, sans restriction). Cliquez sur « Ajouter à la nomenclature ». Cette table est ensuite utilisée par le Catalogue des actes médicaux pour calculer un prix par coefficient.",
        ],
        image: img("lettres-cles-01-liste.png"),
      },
    ],
  },
  {
    id: "modeles-courrier",
    titre: "Modèles de courrier",
    sections: [
      {
        titre: "Préparer des trames de courrier réutilisables",
        texte: [
          "Cliquez sur « Ajouter le modèle », donnez un Libellé et rédigez le Corps (éditeur enrichi, pré-rempli avec une trame utilisant les jetons {{DATE}}, {{DESTINATAIRE}}, {{OBJET}}, {{REFERENCE}} — remplacés automatiquement par les vraies valeurs lors de la création d'un courrier). Cliquez sur « Ajouter le modèle ».",
        ],
        image: img("modeles-courrier-01-liste.png"),
      },
    ],
  },
  {
    id: "fraude",
    titre: "Contrôle fraude",
    sections: [
      {
        titre: "Évaluer le score de risque d'un assuré",
        texte: [
          "Saisissez l'identifiant d'un assuré (ex. « ASS-001 ») dans le champ prévu et cliquez sur « Évaluer » — un score sur 100 est calculé (vert < 25, orange < 50, rouge ≥ 50) avec les motifs détectés, et vient s'ajouter à l'historique des évaluations déjà réalisées.",
        ],
        image: img("fraude-01-liste.png"),
      },
    ],
  },
  {
    id: "regles-consignes",
    titre: "Procédures",
    sections: [
      {
        titre: "Publier des consignes visibles côté portail client",
        texte: [
          "Cliquez sur « Ajouter », rédigez un Titre et un Contenu (éditeur enrichi), choisissez un Ordre d'affichage et cochez « Visible côté client » si la règle doit apparaître dans le portail client. Cliquez sur « Ajouter ». Une fois la règle créée, vous pouvez lui joindre un document justificatif depuis son formulaire d'édition.",
        ],
      },
    ],
  },
  {
    id: "banques",
    titre: "Banques",
    sections: [
      {
        titre: "Référentiel des banques utilisées pour les règlements",
        texte: [
          "Le panneau « Banques les plus utilisées » classe les banques par volume de règlements sinistres (lettres chèque).",
        ],
        image: img("banques-01-liste.png"),
        etapes: [
          {
            titre: "Créer une banque",
            texte: "Cliquez sur « Nouvelle banque », renseignez le Nom (obligatoire), le Code banque et le N° de compte, puis « Créer ».",
            image: img("banques-02-modal.png"),
          },
          {
            titre: "Consulter les mouvements",
            texte: "Cliquez sur « Mouvements » sur une carte de banque pour voir l'historique des lettres-chèques réglées via cette banque (lettre, n° chèque, date, prestataire, compagnie, montant, statut).",
          },
        ],
      },
    ],
  },
  {
    id: "import-donnees",
    titre: "Import de données",
    sections: [
      {
        titre: "Reprendre un portefeuille existant en masse",
        texte: [
          "Sept catégories d'import sont proposées : Souscripteurs, Contrats, Assurés et ayants droit, Prises en charge, Factures, Règlements prestataires, Photos des bénéficiaires. Un bandeau signale les imports de factures globaux en attente de synchronisation, avec un bouton « Synchroniser maintenant ».",
        ],
        image: img("import-donnees-01-grille.png"),
        etapes: [
          {
            titre: "Importer (méthode générale)",
            texte: "Cliquez sur « Importer » sur la catégorie voulue. Pour Assurés/Factures/Prises en charge, choisissez d'abord le Contrat concerné (les données doivent correspondre à SA population). Téléchargez le modèle Excel, remplissez-le, chargez-le : un aperçu ligne par ligne s'affiche pour validation avant confirmation définitive.",
          },
          {
            titre: "Cas particulier : factures « Tous contrats confondus »",
            texte: "Depuis la carte Factures, le lien « Tous contrats confondus » permet un import global sans aperçu ligne par ligne (adapté aux gros volumes) : seul le matricule suffit à identifier chaque bénéficiaire ; les lignes non reconnues restent « en attente » et sont retentées automatiquement après un nouvel import d'Assurés, ou manuellement via « Synchroniser maintenant ».",
          },
          {
            titre: "Cas particulier : photos en masse",
            texte: "Depuis la carte Photos, choisissez des fichiers individuels ou tout un dossier (récursif) où chaque nom de fichier est le matricule du bénéficiaire, puis cliquez sur « Importer N photo(s) » — l'envoi se fait par lots de 40 avec une barre de progression, pour qu'un échec partiel ne fasse pas perdre les photos déjà traitées.",
          },
        ],
      },
    ],
  },
  {
    id: "statistiques",
    titre: "Statistiques",
    sections: [
      {
        titre: "Arrêté de situation par contrat et par période",
        texte: [
          "Sélectionnez un Contrat et, en option, une période (Du/Au), puis cliquez sur « Générer ». Le rapport calculé en direct comprend une douzaine de sections : bases contractuelles, évolution mensuelle (et annuelle si la période couvre plusieurs exercices) des consommations, consommation par famille (avec détail dépliable par famille), Top 20 des consommateurs, répartition par type de bénéficiaire, consommation par rubrique et par prestataire (avec détail dépliable), Top 20 des prestataires, évolution du S/P (avec et sans chargement), et une analyse narrative pré-rédigée mais librement modifiable avant impression.",
        ],
        image: img("08-statistiques.png"),
        etapes: [
          {
            titre: "Choisir ce qui sera exporté",
            texte: "Une fois le rapport généré, cliquez sur « Rubriques (n) » pour cocher/décocher les sections à inclure dans le fichier téléchargé — l'écran, lui, affiche toujours tout.",
          },
          {
            titre: "Télécharger",
            texte: "Cliquez sur « Télécharger PDF » ou « Télécharger Word » pour générer le document final, avec la page de garde personnalisée de la société.",
          },
        ],
      },
    ],
  },
  {
    id: "profil",
    titre: "Profil utilisateur & signature électronique",
    sections: [
      {
        titre: "Vos coordonnées, votre mot de passe, votre signature",
        texte: [
          "Cliquez sur votre avatar en haut à droite puis sur « Profil utilisateur » pour accéder à vos informations de compte, changer votre mot de passe, et gérer votre signature électronique.",
        ],
        image: img("14-profil-signature.png"),
        etapes: [
          {
            titre: "Enregistrer une signature",
            texte: "Deux méthodes : chargez directement un fichier image via « Charger un fichier », ou cliquez sur « Signer depuis mon téléphone » — un QR code s'affiche, à scanner avec votre téléphone ; une page de signature tactile s'ouvre, vous signez du doigt et validez, la signature est automatiquement enregistrée dans votre compte.",
          },
          {
            titre: "Utilisation automatique",
            texte: "Une fois enregistrée, votre signature s'ajoute automatiquement aux documents où elle est requise (feuilles de soins, bons d'examen, certificats de prise en charge…) — inutile de la joindre manuellement à chaque fois.",
          },
        ],
      },
    ],
  },
];

export const chapitresSuperAdmin: GuideChapitre[] = [
  {
    id: "sa-accueil",
    titre: "Tableau de bord Super Admin",
    sections: [
      {
        titre: "Vue 360° de la plateforme",
        texte: [
          "Le compte Super Admin est celui de l'éditeur de MedAssur — il voit et administre l'ensemble des sociétés qui exploitent l'application (courtiers, mutuelles, compagnies), contrairement à un compte Administrateur qui ne voit que les données de sa propre société.",
          "Le tableau de bord résume le nombre de sociétés actives et leur activité globale sur la plateforme, avec des accès rapides vers Plans d'abonnement, Comptabilité & Facturation et Performance & Usage.",
        ],
        image: img("20-super-admin-home.png"),
      },
    ],
  },
  {
    id: "sa-societes",
    titre: "Sociétés",
    sections: [
      {
        titre: "Créer et administrer une société cliente",
        texte: [
          "L'écran « Sociétés » liste toutes les sociétés utilisatrices de MedAssur, leur plan d'abonnement, leur nombre de comptes utilisateurs et leur statut. Sélectionner une société ouvre son détail (onglets « Aperçu » et « Utilisateurs »).",
        ],
        image: img("21-societes.png"),
        etapes: [
          {
            titre: "Créer la société",
            texte: "Cliquez sur « Nouvelle société ». Section SOCIÉTÉ : Nom (obligatoire), Type (Courtier/Mutuelle/Compagnie, via 3 cartes explicatives), Email, Téléphone, Ville, Pays. Section IDENTITÉ & CARTE : Logo (optionnel, uploadé juste après la création), Modèle de carte, Préfixe matricule. Section PREMIER COMPTE ADMINISTRATEUR : Nom et Email (obligatoires). Section FACTURATION : cycle, prix, frais d'installation. Section ABONNEMENT : choisissez un Plan existant (pré-coche ses modules) ou restez « Sur mesure » et cochez librement les modules dans le sélecteur — un coût mensuel estimé se recalcule en direct.",
            image: img("societes-02-modal-societe.png"),
          },
          {
            titre: "Récupérer les identifiants",
            texte: "Cliquez sur « Créer la société » — une fenêtre de confirmation affiche l'email et le mot de passe initial du premier compte administrateur : transmettez-les à la société.",
          },
          {
            titre: "Gérer une société existante",
            texte: "Depuis sa fiche : « Assistance » connecte le Super Admin directement dans l'interface de cette société (utile pour du support) ; « Suspendre »/« Réactiver » ferme/rouvre son accès ; dans l'onglet « Aperçu », le bouton « Gérer » permet d'ajuster à tout moment sa facturation et ses modules souscrits.",
          },
        ],
      },
    ],
  },
  {
    id: "sa-plans",
    titre: "Plans d'abonnement",
    sections: [
      {
        titre: "Offres commerciales proposées aux sociétés",
        texte: [
          "L'écran « Plans d'abonnement » définit les formules commerciales (modules inclus) proposées aux sociétés clientes — ce catalogue alimente le champ « Abonnement » de la fiche de chaque société.",
        ],
        image: img("22-plans-abonnement.png"),
        etapes: [
          {
            titre: "Créer un plan",
            texte: "Cliquez sur « Nouveau plan ». Donnez-lui un Nom (ex. Essentiel, Business, Premium) et cochez les modules inclus dans le sélecteur, puis « Créer ».",
            image: img("plans-abonnement-02-modal.png"),
          },
          {
            titre: "Modifier un plan existant",
            texte: "Un plan sert de MODÈLE DE DÉPART seulement : le modifier plus tard ne change rien aux sociétés qui l'ont déjà adopté (leur sélection de modules reste indépendante une fois la société créée).",
          },
        ],
      },
    ],
  },
  {
    id: "sa-modeles-carte",
    titre: "Modèles de carte",
    sections: [
      {
        titre: "Maquettes de carte d'assurance réutilisables",
        texte: [
          "L'écran « Modèles de carte » permet d'importer une maquette de carte d'assurance (image de fond recto et verso) fournie par une société — ce modèle devient alors disponible comme choix pour n'importe quelle société. Le modèle « Classique (par défaut) » ne peut pas être désactivé ni supprimé — c'est le repli automatique tant qu'aucune image n'est importée.",
        ],
        image: img("23-modeles-carte.png"),
        etapes: [
          {
            titre: "Créer un modèle",
            texte: "Cliquez sur « Nouveau modèle », donnez-lui un Nom, puis « Créer » — l'édition s'ouvre aussitôt automatiquement pour ajouter les images.",
            image: img("modeles-carte-02-modal-nom.png"),
          },
          {
            titre: "Importer le recto et le verso",
            texte: "Dans les deux zones « Recto » et « Verso », cliquez sur « + Télécharger » pour choisir l'image (upload immédiat et indépendant), ou « Supprimer » pour la retirer. Cliquez enfin sur « Enregistrer » pour valider le Nom/Description.",
          },
        ],
      },
    ],
  },
  {
    id: "sa-tarification",
    titre: "Tarification",
    sections: [
      {
        titre: "Grille tarifaire et rubriques de facturation",
        texte: [
          "L'écran « Tarification » définit les tarifs par module (par groupe, avec devise), la tarification par personne (licence annuelle, frais de carte), les taux de change vers le FCFA, et les rubriques de facturation. Chaque ligne s'enregistre indépendamment via son propre bouton/icône Enregistrer, dès qu'elle est modifiée.",
        ],
        image: img("24-tarification.png"),
      },
    ],
  },
  {
    id: "sa-performance",
    titre: "Performance & Usage",
    sections: [
      {
        titre: "Suivi d'utilisation de la plateforme",
        texte: [
          "L'écran « Performance & Usage » permet de suivre l'activité réelle des sociétés sur la plateforme (connexions, volumes traités) — utile pour identifier une société inactive ou, à l'inverse, un usage intensif à accompagner.",
        ],
        image: img("25-performance.png"),
      },
    ],
  },
];
