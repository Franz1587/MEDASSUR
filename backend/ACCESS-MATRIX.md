# Matrice d'accès de l'API MedAssur+

Règles appliquées globalement (`app.module.ts` → `GlobalJwtAuthGuard` puis `GlobalAccessGuard`) :

1. JWT obligatoire sur toutes les routes, sauf `@Public()`.
2. `@Roles(...)` : seuls les rôles listés passent (`super_admin` n'est donc admis que s'il est listé).
3. Route **sans** `@Roles` : refusée aux rôles externes `prestataire_sante`, `client_particulier`,
   `client_entreprise`, `assure_principal`, `medecin_prescripteur`, sauf `@AllowExternal()`
   (= « Internal default » ci-dessous : tout rôle interne authentifié).
4. `@RequireModule(...)` : au moins un des modules doit figurer dans `User.modules` (relu en base ;
   `super_admin` et `administrateur` exemptés). Une méthode peut neutraliser le module de la classe
   avec `@RequireModule()` (vide).

Un décorateur de méthode prend le pas sur celui de la classe (`getAllAndOverride`).

## Groupes de rôles (`src/auth/access-roles.ts`)

| Groupe | Rôles |
|---|---|
| `ROLES_DIRECTION` | administrateur, direction_generale |
| `ROLES_SANTE` | + directeur_technique, gestionnaire_sinistres, gestionnaire_sante |
| `ROLES_PRODUCTION` | admin, DG, directeur_technique, gestionnaire_production, gestionnaire_sante |
| `ROLES_CLIENTS` | admin, DG, directeur_technique, gestionnaire_production, gestionnaire_sante, gestionnaire_entreprises, commercial |
| `ROLES_COMMERCIAL` | admin, DG, gestionnaire_production, gestionnaire_entreprises, commercial |
| `ROLES_FINANCE` | admin, DG, comptable |
| `ROLES_BANQUES` | admin, DG, directeur_technique, comptable |
| `ROLES_REGLEMENT` | admin, DG, directeur_technique, gestionnaire_sante, comptable |
| `ROLES_RECOUVREMENT` | admin, DG, comptable, agent_recouvrement |
| `ROLES_PRESTATAIRES` | admin, DG, directeur_technique, gestionnaire_sante |
| `ROLES_IMPORT` | admin, DG, directeur_technique, gestionnaire_production, gestionnaire_sinistres, gestionnaire_sante |

Légende : **Public** = sans JWT · **Internal default** = JWT, tout rôle interne · **External** = `@AllowExternal()` ·
**Roles(...)** · **Module(...)** = `@RequireModule`.

## Routes publiques

| Route | Raison |
|---|---|
| `POST /auth/login` | Connexion |
| `POST /webhooks/zavu` (communications) | Webhook fournisseur |
| `GET /verification/...` (documents) | Vérification publique d'un document signé |
| `GET /guide-assets/...` | Illustrations du guide |
| `/signer/...` (users/signature-publique) | Signature mobile via jeton QR |
| `POST /ebilling/callback/payin`, `/callback/payout` | Callbacks du prestataire de paiement |

`/presentations/download` n'est **pas** public : le front utilise `fetch` + `Authorization` (`downloadFile`),
et la liste blanche `lang`/`format` (4 fichiers fixes) exclut tout parcours de chemin.

## Contrôleurs traités dans cette passe (17)

| Contrôleur | Groupe de routes | Politique |
|---|---|---|
| `accord-prealable` | GET liste / détail / document-numerise | Module(accordPrealable, prisesEnCharge) |
| | POST création, PATCH update / prendre / decision / annuler, POST ordonnance / devis | Module(idem) + Roles(ROLES_SANTE) |
| | GET `pharmacie/:code`, PATCH `pharmacie/:code/delivrer` | Roles(prestataire_sante, ROLES_SANTE), module neutralisé (portail prestataire « Ordonnances ») |
| `appel-offres` | GET liste / détail / offre-parametres | Module(appelOffres, cotation) |
| | POST/PATCH/PUT/DELETE (appels, propositions, documents, analyser, offre-parametres) | Module(idem) + Roles(ROLES_COMMERCIAL, directeur_technique) |
| | POST `chat` (Ariana) | Module(ia, appelOffres) |
| `modeles-courrier` | GET | Module(courrierMaladie, modelesCourrier) |
| | POST / PATCH / DELETE | Module(idem) + Roles(administrateur, direction_generale, directeur_technique) |
| `courrier` | toutes | Module(courrierMaladie) |
| `dashboard` | `pilotage`, `pilotage/rapport` | Module(comptabilite, rapports) — direction, DT, comptable |
| `facture-production` | GET | Module(factureProduction) |
| | POST création | Module(factureProduction) + Roles(ROLES_PRODUCTION) |
| `factures` | GET liste / export / eligibles-reglement / détail, POST création, lignes, numéros, aperçu | Module(prisesEnCharge, reglementPrestataire, reglementComptable) |
| | PATCH update (statut), annuler, rejeter / annuler ligne, DELETE ligne / numéro | Module(idem) + Roles(ROLES_SANTE) |
| `fraude` | GET | Module(fraude) |
| | POST `evaluer/assure/:id` | Module(fraude) + Roles(ROLES_SANTE) |
| `garantie-catalogue` | GET | Module(garantiesCatalogue, contrats) (lu aussi par le formulaire de contrat) |
| | POST / DELETE | Module(idem) + Roles(ROLES_PRODUCTION) |
| `ged/documents` | GET, upload, fichier, PATCH, rapprocher, rapport-liaison | Module(ged) |
| | DELETE | Module(ged) + Roles(ROLES_SANTE) |
| `ia-assistant` | POST `chat` | Module(ia) |
| `lettres-cles` | GET | Module(lettresCles, accordPrealable, prisesEnCharge, actesMedicaux) |
| | POST / PATCH / DELETE | Module(idem) + Roles(ROLES_SANTE) |
| `medecins` | GET | Module(professionnelsSante, prestataires, reglementPrestataire) |
| | POST / PATCH / DELETE, lier / délier structure | Module(idem) + Roles(ROLES_SANTE) |
| `presentations` | GET `download` | External (tous les shells, portails inclus), JWT requis |
| `quittances-libres` | GET | Module(avenants) |
| | POST, annuler, payer / annuler-paiement tranche | Module(avenants) + Roles(ROLES_PRODUCTION) |
| `statistiques` | GET `:contratId` | Module(statistiques) |

## Autres contrôleurs (décorés précédemment, vérifiés)

| Contrôleur | Groupe de routes | Politique |
|---|---|---|
| `auth` | login | Public |
| | `me`, `consentement` | External |
| `users/moi` | profil, mot de passe, signature | External |
| `users` | administration des comptes | Roles(administrateur, direction_generale, super_admin) |
| `notifications` | liste, lue, toutes-lues | External |
| | POST (création) | Roles(administrateur, direction_generale) |
| `messagerie` | conversations / messages | External |
| `rapports-ia` | rapports | Roles(ROLES_RAPPORTS_IA) |
| `codes-affection` | GET | External |
| `actes-medicaux` | GET liste / détail | External |
| | POST / PATCH / DELETE | Roles(ROLES_SANTE) |
| `prestataires` | GET `reseau`, `reseau/:id` | External (réseau de soins, portails + mobile) |
| | GET liste / détail / statistiques | Internal default |
| | écriture, fusion, comptes portail, accès sociétés | Roles(ROLES_PRESTATAIRES) |
| `regles-consignes` | GET liste / détail | External |
| | écriture, documents | Roles(ROLES_GESTION) |
| `documents` | GET `reseau-soins` | External |
| | bordereaux, encaissements | Roles(ROLES_BANQUES) |
| | cotation-offre, offre-sante archiver / envoyer-email | Roles(ROLES_COMMERCIAL) |
| | lettre-cheque, reglement, historique-reglements | Roles(ROLES_REGLEMENT) |
| | autres PDF (quittance, carte, décompte, population…) | Internal default |
| `demandes-client` | création, mine, photo bénéficiaire | Roles(client_entreprise, client_particulier) |
| | liste, prendre, décision | Roles(ROLES_GESTION_DEMANDES_CLIENT) |
| `portail-client`, `portail-client/utilisateurs` | toutes | Roles(client_entreprise, client_particulier) |
| `portail-membre`, `portail-membre/suivi` | toutes | Roles(assure_principal) |
| `portail-medecin`, `portail-medecin/suivi` | toutes | Roles(medecin_prescripteur) |
| `portail-prestataire`, `portail-prestataire/suivi` | toutes | Roles(prestataire_sante) |
| `abonnement` | GET `moi` | Internal default |
| `agences` | GET | Internal default |
| | écriture | Roles(ROLES_BANQUES) |
| `audit` | journal, stats-agents, export | Roles(ROLES_SANTE) |
| `avenants` | GET, POST, PATCH | Internal default |
| | appliquer, DELETE | Roles(ROLES_PRODUCTION) |
| `banques` | GET liste | Internal default |
| | statistiques, mouvements, écriture, lots, comptes | Roles(ROLES_REGLEMENT) |
| `bordereaux`, `encaissements` | toutes | Roles(ROLES_BANQUES) |
| `clients` | lecture / écriture courante | Internal default |
| | import, DELETE | Roles(ROLES_CLIENTS) |
| | synchroniser-statuts | Roles(administrateur, direction_generale, directeur_technique) |
| `commissions` | GET | Internal default |
| | PATCH `reverser` | Roles(ROLES_FINANCE) |
| `communications` | toutes | Roles(administrateur, direction_generale, gestionnaire_entreprises, commercial) |
| `compagnies` | lecture / écriture | Internal default |
| | DELETE | Roles(ROLES_PRODUCTION, gestionnaire_entreprises) |
| `comptabilite/journal`, `fonds-de-roulement`, `honoraires` | toutes | Roles(ROLES_FINANCE) |
| `comptes-mobile` | génération | Roles(administrateur, direction_generale, directeur_technique, gestionnaire_production, gestionnaire_sante) |
| `contrats` | lecture / écriture courante | Internal default |
| | import, DELETE | Roles(ROLES_PRODUCTION) |
| | réimputer agences, recalculer primes | Roles(administrateur, direction_generale, directeur_technique) |
| `cotation` | lecture / écriture | Internal default |
| | DELETE | Roles(ROLES_COMMERCIAL, directeur_technique) |
| `crm/prospects` | lecture / écriture | Internal default |
| | DELETE | Roles(ROLES_COMMERCIAL) |
| `ebilling` | callbacks | Public |
| | payin / transactions | Roles(ROLES_FINANCE) + Module(ebilling) |
| | payout | Roles(ROLES_PAYOUT) + Module(ebilling, reglementPrestataire) |
| `import`, `import-libre` | imports | Roles(ROLES_IMPORT) |
| | doublons (détection / nettoyage) | Roles(administrateur, direction_generale) |
| `lettrage`, `reglement-comptable`, `reglement-prestataire` | toutes | Roles(ROLES_REGLEMENT) |
| `modeles-carte` | écriture | Roles(super_admin) |
| | lecture | Internal default |
| `parametres-entreprise` | GET | Internal default |
| | écriture, logo, page de garde | Roles(ROLES_DIRECTION) |
| `recouvrement` | toutes | Roles(ROLES_RECOUVREMENT) |
| `relances` | toutes | Roles(ROLES_DIRECTION) |
| `renouvellements` | GET | Internal default |
| | relancer, renouveler, perdu | Roles(ROLES_PRODUCTION) |
| `resiliations` | GET | Internal default |
| | création, valider, effective, DELETE | Roles(ROLES_PRODUCTION) |
| `role-templates` | toutes | Roles(administrateur, direction_generale) |
| `sante` | assurés / prises en charge (lecture, saisie) | Internal default |
| | import, retrait, bascule, suppression, transferts, corrections | Roles(ROLES_PRODUCTION) |
| `sinistres` | lecture / écriture | Internal default |
| | DELETE | Roles(ROLES_SANTE) |
| `tresorerie` | GET `comptes` | Roles(ROLES_RECOUVREMENT) (tableau de bord finance) |
| | flux, rapprochement | Roles(ROLES_FINANCE) |
| `societes` (`facturation`, `performance`, `plans-abonnement`, `rubriques-facturation`, `societes`, `societes/:id/users`, `tarification`) | toutes | Roles(super_admin) |

## Notes

- Les rôles `courtier_partenaire`, `compagnie_assurance` et `expert_sinistres` ne figurent pas dans la liste
  « externes » du garde : ils sont traités comme internes par défaut (aucun portail dédié n'existe côté API).
- Les fichiers statiques `/uploads/...` ne passent pas par ces contrôleurs.
- Le lien `<a href=".../accord-prealable/:id/document-numerise">` du front n'envoie pas d'en-tête
  `Authorization` (route protégée par JWT) : à corriger côté front (fetch authentifié).
