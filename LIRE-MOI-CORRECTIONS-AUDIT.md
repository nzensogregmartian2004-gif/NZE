# LIRE-MOI — Corrections issues de l'audit (16 novembre 2026)

## Étape
Corrections des points 1 et 2 de l'audit : listes tronquées en silence, et récupération du mot de passe bloquée en production. Mise à jour de la documentation.

## Décisions appliquées
- D-LIST-1 : toutes les listes sont paginées (200 au maximum), les totaux lisent l'ensemble des données.
- D-T5 : récupération assistée, prête mais désactivée par défaut. **À décider par le fondateur.**
- D-M-REC : génération du code réservée à l'administrateur principal.
- Règle du registre : un point non tranché reste désactivé en production.

## Fichiers modifiés (chemins depuis NZE/)
Backend : `src/app.ts`, `src/config.ts`, `src/core/http.ts`, `src/core/permissions.ts`, `src/modules/audit/{routes,service}.ts`, `src/modules/auth/{routes,service}.ts`, `src/modules/collectes/{routes,service}.ts`, `src/modules/commandes/{routes,service}.ts`, `src/modules/echelonnement/{routes,service}.ts`, `src/modules/finance/{retraits,routes}.ts`, `src/modules/litiges-partenaire/{routes,service}.ts`, `src/modules/livraisons/{routes,service}.ts`, `src/modules/messagerie/{routes,service}.ts`, `src/modules/notifications/{routes,service}.ts`, `src/modules/parcours/{routes,service}.ts`, `src/modules/reclamations/{routes,service}.ts`, `src/modules/suivi-partenaire/{routes,service}.ts`, `tests/droits-routes.test.ts`, `tests/helpers.ts`.
Backend, ajoutés : `src/core/pagination.ts`, `tests/pagination-listes.test.ts`, `tests/recuperation-assistee.test.ts`.
Mobile : `app/(admin)/{collectes,commandes,produits,reclamations,registres,reglages,retraits,stock}.tsx`, `app/(auth)/mot-de-passe-oublie.tsx`, `app/(livreur)/{collectes,livraisons}.tsx`, `app/(partenaire)/{portefeuille,stock}.tsx`, `app/conversation/[id].tsx`, `app/mes-commandes.tsx`, `app/mes-reclamations.tsx`, `app/notifications.tsx`, `src/i18n/dictionnaire.ts`, `src/lib/pagination.ts`, `tests/pagination.test.ts`.
Mobile, ajoutés : `src/lib/use-liste-paginee.ts`, `src/components/ChargerPlus.tsx`.
Navigation : `app/(admin)/_layout.tsx`, `app/(livreur)/_layout.tsx`, `tests/i18n.test.ts`.
Documentation : `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`, `nze-backend/README.md` (inchangé ici), `LIRE-MOI-CORRECTIONS-AUDIT.md`.
Supprimés : aucun.

## Migrations
Aucune dans cette livraison.

## Routes et paramètres
- Toutes les listes listées ci-dessus acceptent `limite` (défaut propre à la liste, 200 au maximum) et `decalage`. Réponse inchangée (tableau), sauf `GET /conversations/:id/messages` : la page contient les messages les plus récents, dans l'ordre chronologique.
- Nouvelle route : `GET /partenaire/ventes` (paginée, partenaire seulement).
- Nouvelle route : `POST /admin/recuperations-assistees` (administrateur principal, permission `recuperation.assistee`), corps `{ telephone }`, renvoie `{ code, expireDans }` une seule fois.
- `POST /auth/mot-de-passe/oubli` renvoie désormais `mode` : `SMS` ou `ASSISTE`.
- Configuration : `RECUPERATION_ASSISTEE` (`true` ou `false`, défaut `false`).

## Commandes exécutées et résultats (mesurés)
- Backend, `npm run typecheck` : 0 erreur.
- Backend, `npm test` : **325 réussis sur 325** (313 précédents, 5 pagination des listes, 7 récupération assistée).
- Mobile, `npx tsc --noEmit` : 0 erreur.
- Mobile, `npm test` : **26 réussis sur 26** (24 précédents, 2 de rafraîchissement du fil de messages).
- Onglets : tous les titres d'onglets passent par `t()` (administration et livreur) ; les clés sont vérifiées par le test des libellés.
- Non mesuré : le test de pagination des messages n'a pas été lancé contre l'ancien code. Le défaut est établi par la lecture du code.

## Essais à faire sur téléphone
1. Mes commandes, mes réclamations : défiler, « Charger plus » apparaît au-delà de 50 éléments.
2. Conversation : ouvrir une longue conversation, vérifier que les derniers messages sont en bas ; « Messages plus anciens » en haut ; attendre 10 secondes sans perdre les messages chargés.
3. Portefeuille partenaire : retraits et ventes paginés.
4. Administrateur principal : Réglages → Récupération de mot de passe : générer un code ; un administrateur secondaire ne voit pas cette section.
5. Mot de passe oublié : en mode assisté, le message « contactez NZE » remplace le formulaire.

## Risques et points ouverts
- **Production** : la récupération du mot de passe reste bloquée tant que l'eSMS n'est pas branché **et** que le mode assisté n'est pas activé. Décision D-T5 à prendre.
- Pagination par décalage : un élément ajouté ou retiré pendant le défilement peut décaler une page. Les doublons sont retirés côté application.
- Le filtre « en retard » des échelonnements est appliqué lot par lot : sur un très grand nombre de plans, la réponse peut être plus lente.
- Les tableaux de bord chargent toute la table en mémoire (exact, mais coûteux).
- Traductions des nouveaux libellés (prestataires, récupération, « Charger plus », messages anciens) : à relire (O-6).
- Aucun test automatisé d'écran : les essais ci-dessus sont à faire à la main.

## Rapport de passation
RAPPORT DE PASSATION — corrections de l'audit
Date : 16 novembre 2026
Objectif livré : pagination de toutes les listes, défauts de fond corrigés (messages, livraisons partenaire, échelonnements, synthèse), écrans mobiles branchés, mode de récupération assisté prêt et désactivé.
Décisions appliquées : D-LIST-1, D-T5 (à décider), D-M-REC.
Migrations : aucune.
Routes / permissions / événements : voir ci-dessus ; journal `RECUPERATION_ASSISTEE_CODE` (sans le code).
Tests exécutés : backend 325/325 ; mobile 26/26 ; typage backend et mobile 0 erreur.
Ce qui n'est pas fait : intégrations en attente d'accès ; tests d'écran sur téléphone ; agrégats des tableaux de bord ; relecture des traductions ; réparation de la chaîne de snapshots drizzle.
Proposition de l'étape suivante : décision D-T5 par le fondateur, puis essais sur APK de preview.

## Mise à jour (suite, même jour)
- Onglets administrateur et livreur traduits (`onglets.collectes`, `onglets.entreprises`, `onglets.registres`, `onglets.recuperations`). Clés vérifiées par le test des libellés.
- Tableaux de bord livreur, administrateur et partenaire recalculés en agrégats SQL (`src/modules/livraisons/service.ts`). Test de concordance ajouté dans `tests/livraisons.test.ts`.
- Chaîne de snapshots drizzle réparée : `src/db/migrations/meta/0015…0018_snapshot.json`. `drizzle-kit generate` répond « No schema changes ». Le snapshot 0018 est celui du schéma actuel.
- Export Android (`expo export --platform android`) : réussi, paquet complet sans import non résolu.
- Mesures actualisées : backend **326/326**, mobile **26/26**, typage 0 erreur.
- Restant : intégrations sans accès (O-4), tests d'écran sur téléphone, relecture des traductions (O-6), décision D-T5.

## Mise à jour — stockage des photos (R2)
- Fichiers modifiés ou ajoutés depuis la dernière archive :
  - `nze-backend/.env.example`
  - `nze-backend/package-lock.json`
  - `nze-backend/package.json`
  - `nze-backend/src/app.ts`
  - `nze-backend/src/config.ts`
  - `nze-backend/src/db/migrations/0019_fiche_photo.sql`
  - `nze-backend/src/db/migrations/meta/0019_snapshot.json`
  - `nze-backend/src/db/migrations/meta/_journal.json`
  - `nze-backend/src/db/schema.ts`
  - `nze-backend/src/modules/publicite/routes.ts`
  - `nze-backend/src/modules/publicite/service.ts`
  - `nze-backend/src/modules/stockage/r2.ts`
  - `nze-backend/src/server.ts`
  - `nze-backend/tests/droits-routes.test.ts`
  - `nze-backend/tests/helpers.ts`
  - `nze-backend/tests/photo-fiche.test.ts`
  - `nze-backend/tests/publicite.test.ts`
  - `nze-backend/tests/stockage-r2.test.ts`
- Migration : `0019_fiche_photo` (colonne `photo_cle`).
- Routes : `POST /admin/prestataires/:id/photo` (administrateur, permission `publicite.gerer`). Les fiches publiques renvoient `photoUrl`.
- Configuration : `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (et `R2_ENDPOINT` facultatif), toutes ou aucune.
- Dépendances ajoutées : `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- Mesures : backend **339/339**.
- À faire : saisir les variables dans Render ; révoquer le premier jeton ; envoi depuis l'application mobile (nouvelle version native).

## Mise à jour — temps réel Supabase, partie serveur
- Fichiers ajoutés : `src/modules/realtime/jeton.ts`, `src/modules/realtime/routes.ts`, `tests/realtime-jeton.test.ts`.
- Fichiers modifiés : `src/config.ts` (`SUPABASE_URL`, `SUPABASE_SIGNING_KEY`), `src/app.ts`, `src/server.ts`, `tests/helpers.ts`, `.env.example`, documentation.
- Route : `GET /realtime/jeton` (utilisateur connecté). Répond 503 `REALTIME_NON_CONFIGURE` sans clé.
- Mesures : backend **347/347**.
- Étapes du fondateur : générer la clé ES256 avec la CLI Supabase, l'importer dans Settings > JWT Signing Keys, la faire passer active (« Rotate keys »), puis saisir `SUPABASE_URL` et `SUPABASE_SIGNING_KEY` dans Render.
- Suite : autorisations `realtime.messages`, publication des messages, branchement mobile.

## Lot 1 de l'audit P0 — finance (17 novembre 2026)
- Fichiers modifiés : `nze-backend/src/modules/finance/retraits.ts` (litige ouvert sans réclamation = blocage global), `nze-backend/src/modules/finance/ecritures.ts` (répartition vérifiée avant écriture), `nze-backend/src/modules/paiements/service.ts` (paiement réussi conservé, alerte si répartition incohérente), `nze-backend/render.yaml` (doublon TRUST_PROXY supprimé), `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- Fichiers ajoutés : `nze-backend/tests/p0-paiement-doublon.test.ts` ; tests ajoutés à `nze-backend/tests/p0-retrait-collecte.test.ts`.
- Migrations : aucune.
- Journal : nouvelle action `PAIEMENT_ECRITURE_ECHEC` (alerte système, sans acteur).
- Décisions du fondateur appliquées : D-AUD-1 (retrait déclenché par le commerçant, versé par l'administrateur principal), D-AUD-2 (frais MyPVit à la charge du client, mécanisme à valider en sandbox), D-AUD-3 (liste IP des callbacks), D-AUD-4 (Cron d'échelonnement en attente, inchangé).
- Mesures : backend **351/351** ; typage backend et mobile 0 erreur.
- Étapes du fondateur : saisir `MYPVIT_WEBHOOK_ALLOWED_IPS=176.31.65.18,176.31.65.20,176.31.65.21,13.59.249.167` dans Render ; surveiller `callback_ip_refusee` au premier déploiement.
- Non traité : affichage du frais MyPVit avant paiement (lot 4, sandbox) ; Cron d'échelonnement (en attente).

## Lots 1 (fin) et 2 de l'audit P0 (17 novembre 2026)
- Ajouté : `nze-backend/tests/repartition-vente.test.ts` (répartition d'une commande avec livraison).
- Mesures : backend **352/352** ; typage backend 0 erreur.
- Lot 2 : aucune migration nouvelle ; contrôle du journal, des fichiers et de drizzle-kit concordant ; aucune opération destructive de données hors `0013` (suppression des colonnes OTP de livraison, à confirmer par écrit).
- Avant le premier déploiement : sauvegarde Supabase ; confirmation écrite du retrait de l'OTP de livraison (O-9).

## Lot 3 de l'audit P0 : configuration de production (17 novembre 2026)
- Fichiers modifiés : `nze-backend/src/modules/paiements/providers/mypvit/config.ts` (IP obligatoires en production, IPv4 valides), `docs/LANCEMENT.md` (liste de lancement mise à jour), `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- Fichiers ajoutés : `nze-backend/tests/config-production-lot3.test.ts`.
- Migrations : aucune.
- Mesures : backend **366/366** ; typage backend 0 erreur.
- Non vérifiable depuis l'environnement de contrôle : les variables réelles de Render, la restauration de sauvegarde (`pg_dump` absent), le démarrage réel en production. Ces points restent à faire par le fondateur, avec la liste de `docs/LANCEMENT.md`.

## Lot 4 de l'audit P0 : banc d'essai MyPVit (17 novembre 2026) — non exécuté
- Fichiers ajoutés : `nze-backend/scripts/sandbox-mypvit.ts`, `nze-backend/src/modules/paiements/providers/mypvit/sandbox-garde.ts`, `nze-backend/tests/sandbox-garde.test.ts`, `docs/SANDBOX-MYPVIT.md`.
- Fichiers modifiés : `nze-backend/package.json` (script `sandbox:mypvit`), `nze-backend/tsconfig.json` (scripts inclus dans la vérification de types), `nze-backend/.gitignore` (identifiants de test et rapport locaux), `docs/01-DECISIONS.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`, `docs/LANCEMENT.md`.
- Vérifié : refus du banc d'essai en production, sans adresse explicite, en http, sans confirmation ; exécution avec une adresse fictive réservée : échec réseau propre, aucun identifiant écrit.
- Non fait : tout appel réel à MyPVit (non joignable depuis l'environnement de contrôle, et identifiants de test non fournis). Frais MyPVit (D-AUD-2) bloqué jusqu'aux réponses de MyPVit.
- Migrations : aucune. Mesures : backend 366/366 ; typage 0 erreur.

## Frais MyPVit : question posée (17 novembre 2026)
- Fichiers modifiés : `nze-backend/src/modules/paiements/providers/mypvit/sandbox-garde.ts` (classement de la relation montant / frais / total), `nze-backend/scripts/sandbox-mypvit.ts` (ligne « relation » du rapport), `nze-backend/tests/sandbox-garde.test.ts`, `docs/SANDBOX-MYPVIT.md`, `docs/paiements/MYPVIT-INTEGRATION.md` (section 7), `docs/01-DECISIONS.md`, `docs/LANCEMENT.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- Vérifié : toutes les variables MyPVit lues par le code sont déclarées dans le Blueprint Render.
- Réponse : non tranchée. Indice : `getFees` renvoie `totalAmount`. Sources à lire : l'application de référence en production, et l'essai sandbox.
- Mesures : backend 366/366 ; typage 0 erreur.

## Frais de service et frais MyPVit (17 novembre 2026)
- Documentation seule : `docs/01-DECISIONS.md` (D-AUD-6, D-AUD-7), `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- Aucun changement de code : la commission est déjà versionnée et définie par partenaire ; aucun frais de service client n'existe dans le cahier ni dans le code.
- Décisions à prendre : frais de service payés par le client (montant, bénéficiaire, écriture) ; valeur par défaut éventuelle de la commission.

