# Migration de la base de données — 19 septembre 2026

Résumé de tout ce qui a été fait aujourd'hui pour donner à MedAssur une copie
locale de sa base de données de production et pour brancher le backend
dessus.

> ⚠️ Ce fichier ne contient volontairement **aucun mot de passe**. Les
> identifiants réels sont dans `/opt/medassur/backend/.env` sur le VPS (et
> dans sa sauvegarde, voir plus bas) — jamais dans ce dépôt Git.

## 1. Point de départ

Avant aujourd'hui, l'application en production (medassur.cloud, VPS
Hostinger `147.79.114.162`) dépendait à 100 % d'une base de données externe
hébergée sur **Supabase Cloud** (PostgreSQL 17.6, ~53 Mo de données) :
`Contrat` (141 lignes), `AssureSante` (11 131), `Facture` (8 674), `User`
(1 642), `SocieteAssurance` (4), etc.

Le VPS héberge aussi, séparément, une pile Supabase auto-hébergée
(conteneurs `supabase-*`) qui appartient à un **autre site** sur ce même
serveur partagé — vérifié vide de toute donnée MedAssur, jamais touchée.

## 2. Ce qui a été mis en place

### a) Une copie complète de la base, hébergée sur le VPS lui-même

- Nouveau conteneur Docker dédié `medassur-pg-local` (image `postgres:17`),
  avec un volume Docker nommé et persistant.
- Lié **uniquement** à `127.0.0.1:5433` — jamais exposé à internet,
  contrairement au port 5432 de l'autre pile Supabase du VPS.
- Base créée : `medassur_prod_copy`, utilisateur dédié `medassur`.
- Contenu obtenu par `pg_dump` (via `DIRECT_URL`, la chaîne de connexion
  directe non poolée de Supabase) puis `pg_restore` dans le nouveau
  conteneur — 3 erreurs sans conséquence ignorées (liées à l'extension
  interne `supabase_vault`, propre à Supabase, pas une table MedAssur).
- **Vérifié ligne par ligne** : les comptages (`Contrat`, `AssureSante`,
  `Facture`, `User`, `SocieteAssurance`) sont strictement identiques entre
  la copie et la vraie production au moment de la restauration.
- Script réutilisable laissé sur le VPS : `/opt/medassur/refresh-pg-copy.sh`
  — permet de relancer une nouvelle photo à jour à la main quand on veut
  (ce n'est **pas** une synchronisation automatique/continue).

### b) Le backend de production branché sur cette copie locale

À la demande explicite de l'utilisateur ("Basculer le backend de
production lui-même") :

- Sauvegarde de l'ancien fichier de configuration :
  `/opt/medassur/backend/.env.backup-supabase-20260919-203142` (contient
  encore les anciens identifiants Supabase, au cas où il faudrait revenir
  en arrière).
- `DATABASE_URL` et `DIRECT_URL` réécrits pour pointer vers
  `127.0.0.1:5433/medassur_prod_copy` (le nouveau conteneur local) au lieu
  de Supabase Cloud.
- Service redémarré (`systemctl restart medassur-backend`).
- **Vérification la plus solide effectuée** : lecture directe des
  connexions réseau réellement ouvertes par le processus Node.js en
  production (`ss -tnp`) — 5 connexions actives vers `127.0.0.1:5433`,
  **zéro** connexion vers un hôte Supabase/AWS. L'application tourne donc
  bel et bien sur la base de données locale, pas sur Supabase.

### c) Ce qui n'a PAS changé

- **Le stockage de fichiers** (logos, photos, documents PDF/Word générés)
  reste sur **Supabase Storage** — c'est un service à part de la base de
  données, non concerné par cette bascule. `backend/src/storage/storage.service.ts`
  a simplement reçu des valeurs de repli codées en dur (à la demande
  explicite de l'utilisateur, en attendant l'installation de Coolify) pour
  que ces identifiants ne dépendent plus uniquement des variables
  d'environnement du VPS.
- La base Supabase Cloud d'origine **existe toujours**, intacte, non
  supprimée — elle sert de filet de sécurité si besoin de revenir en
  arrière.
- La pile Supabase auto-hébergée déjà présente sur le VPS (pour l'autre
  site partagé) n'a jamais été touchée.

## 3. État actuel (au 19/09/2026, fin de journée)

| Élément | Avant | Après |
|---|---|---|
| Base de données de production | Supabase Cloud (AWS) | PostgreSQL local (`medassur-pg-local`, VPS, port 127.0.0.1:5433) |
| Stockage de fichiers (logos, photos, documents) | Supabase Storage | Supabase Storage (inchangé) |
| Base Supabase Cloud d'origine | En service | Conservée intacte, non supprimée (filet de sécurité) |
| Rafraîchissement de la copie locale | — | Manuel, via `/opt/medassur/refresh-pg-copy.sh` |

## 4. Points de vigilance restants

- **Secret versionné dans Git** : la clé de service Supabase Storage a été
  écrite en dur dans `storage.service.ts` (commit `fd1acfd`) — à la
  demande explicite de l'utilisateur, malgré l'avertissement donné qu'elle
  se retrouve alors dans l'historique Git même sur un dépôt privé. **À
  faire lors du passage à Coolify** : retirer ce repli codé en dur ET
  faire tourner (révoquer/régénérer) cette clé, puisqu'elle a transité par
  Git.
- La copie locale n'est **pas** synchronisée en continu avec Supabase —
  c'est un instantané figé au moment de la restauration. Si Supabase
  continuait de recevoir des écritures depuis une autre source, il
  faudrait relancer `refresh-pg-copy.sh` pour rattraper le retard (non
  applicable ici puisque le backend de production pointe maintenant vers
  la copie locale, qui est donc devenue la source de vérité).
- Aucune sauvegarde automatique n'a été mise en place pour
  `medassur-pg-local` (contrairement à Supabase Cloud qui a ses propres
  sauvegardes gérées). À prévoir si cette base locale doit rester la
  source de vérité durablement.
