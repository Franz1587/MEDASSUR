# Remédiation sécurité — actions à faire par l'équipe

Corrections de code appliquées : voir l'historique Git et `backend/ACCESS-MATRIX.md`.
Ce document liste ce que le code ne peut pas faire à votre place.

## 1. Dépôt GitHub public — URGENT
Le dépôt `Franz1587/MEDASSUR` était public et contenait des données potentiellement réelles
(photos d'assurés, feuilles de soins, factures, ordonnances, classeurs d'assurés).

1. Passer le dépôt en **privé** (Settings → General → Danger Zone).
2. Les fichiers sont déjà retirés de l'index Git (`git rm --cached`) et ajoutés au `.gitignore`,
   mais **ils restent dans l'historique**. Purger l'historique :
   ```
   git filter-repo --path backend/uploads --path "Modèle import pour La Ruche" --invert-paths
   ```
   (idem pour les PDF/images/classeurs racine), puis `git push --force` et demander à GitHub de purger les caches.
3. Considérer ces données comme exposées : si elles sont réelles, évaluer l'obligation de notification
   (données de santé).
4. Régénérer tout secret ayant pu transiter par le dépôt ou des logs.

## 2. Variables d'environnement à définir en production
| Variable | Rôle |
|---|---|
| `JWT_SECRET` | ≥ 32 caractères aléatoires (le démarrage échoue sinon) |
| `EBILLING_CALLBACK_SECRET` | signe les callbacks E-Billing ; sans lui payin/payout sont refusés |
| `ZAVU_WEBHOOK_SECRET` | sans lui le webhook Zavu répond 401 |
| `CORS_ORIGINS` | origines navigateur autorisées (séparées par des virgules) |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | requis pour activer Swagger en production |
| `TRUST_PROXY` | ex. `1` derrière nginx/Coolify (sinon l'IP vue est celle du proxy) |
| `UPLOAD_URL_SECRET` | (optionnel) secret des URL signées d'uploads, sinon dérivé du JWT |

## 3. Changements de comportement à communiquer
- Les mots de passe temporaires sont désormais **aléatoires** (plus de `medassur2024`) et le
  changement est **imposé côté serveur** à la première connexion.
- 8 échecs de connexion en 15 min bloquent le compte pour l'IP concernée (HTTP 429).
- Les fichiers `/uploads` exigent une authentification ou une URL signée.
- Les montants E-Billing doivent être des entiers.
- L'agent IA ne répond plus aux expéditeurs email inconnus ou non authentifiés (SPF/DKIM).
- Un bordereau payé/validé n'est plus modifiable ; avenants/encaissements liés ne sont plus supprimables.

## 4. Reste à décider / planifier
- Prorata sur 365 jours même en année bissextile, taxe 8 % fixe : décisions métier à valider (documentées dans `prime.util.ts`).
- `onDelete: Cascade` sur `PriseEnCharge`→`Facture`/`Remboursement` et `Decompte`→`Facture` : migration à prévoir.
- Comptabilité en écritures à une ligne (pas de partie double) : refonte à planifier.
- Jeton JWT encore en `localStorage` côté web : migrer vers un cookie HttpOnly.
- Découper `documents.service.ts` (~6 700 lignes) et `agent-ia.service.ts`.
- Mises à jour majeures (NestJS 10→11+, Prisma 5→6+, Expo) à planifier avec tests.
