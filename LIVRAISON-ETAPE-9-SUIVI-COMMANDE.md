# Livraison — Étape 9 : suivi de commande côté client

Date : 17 novembre 2026. Décision appliquée : **D-CMD-1** (nouvelle, à valider). Point ouvert : **O-22**.

## 1. Objectif

Que le client sache où en est sa commande : confirmée, en préparation, prête, en livraison, livrée. Les notifications de suivi s'appuient sur ces mêmes étapes.

## 2. Ce qui change

- **Étapes de préparation** : l'administration (principal ou secondaire) saisit « en préparation », puis « prête », dans cet ordre, une seule fois. Une étape est refusée tant que la commande n'est pas payée, et dès que la commande est partie en livraison (livreur en route, arrivé, livrée, partielle). Une commande déjà confiée à un livreur mais pas encore partie reste saisissable.
- **Notifications** : « Commande en préparation » et « Commande prête », traduites dans les quatre langues.
- **Suivi** : renvoyé dans le détail de commande (`suivi`). Calculé ainsi : livrée si la livraison est livrée ; en livraison si le livreur est en route ou arrivé ; prête ou en préparation selon l'étape ; sinon confirmée. Vide tant que la commande n'est pas payée.
- **Application** : le détail de commande affiche ce suivi sous le statut.

Ce qui ne change pas : les statuts de commande existants (panier, en attente de paiement, payée, échec, annulée), les livraisons et leurs notifications.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/commandes/service.ts`, `nze-backend/src/modules/commandes/routes.ts`, `nze-backend/src/modules/notifications/textes.ts`, `nze-mobile/src/i18n/dictionnaire.ts`, `nze-mobile/app/commande/[id].tsx`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0025_etape_preparation.sql`, `nze-backend/src/db/migrations/meta/0025_snapshot.json`, `nze-backend/tests/suivi-commande.test.ts`, `nze-mobile/src/lib/suivi-commande.ts`, `nze-mobile/tests/suivi-commande.test.ts`, `LIVRAISON-ETAPE-9-SUIVI-COMMANDE.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0025_etape_preparation.sql`** : ajoute `commandes.etape_preparation` (nullable) avec une contrainte de valeur. Additive : aucune donnée modifiée ; les commandes existantes n'ont pas d'étape, donc elles s'affichent « confirmée » si elles sont payées.

**Sauvegarde** : à faire avant le déploiement (les migrations s'exécutent au démarrage sur Render).

## 5. Routes, permissions, événements

- `POST /admin/commandes/:id/etape` : `{ etape: 'EN_PREPARATION' | 'PRETE' }`. Administration seule (principal et secondaire). Journalisée (`COMMANDE_ETAPE`).
- `GET /commandes/:id` (existante) : renvoie désormais `suivi`.
- Nouveaux types de notification : `COMMANDE_EN_PREPARATION`, `COMMANDE_PRETE`.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **395 réussis sur 395** (392 avant, 3 nouveaux dans `suivi-commande.test.ts`) |
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **32 réussis sur 32** (30 avant, 2 nouveaux dans `suivi-commande.test.ts`) |

Les 3 tests : progression complète avec notifications et refus des sauts d'étape ; refus après le départ en livraison (livreur en route) ; saisie réservée à l'administration, et pas de suivi tant que la commande n'est pas payée.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 7. Essais à faire

1. Commander, payer : le détail indique « Commande confirmée ».
2. L'administration marque « en préparation », puis « prête » : le client voit le changement et reçoit la notification.
3. Le livreur démarre la livraison : l'étape « prête » ne peut plus être saisie ; le suivi indique « en livraison ».

## 8. Risques et points ouverts

- **O-22** : pour l'instant, seule l'administration saisit les étapes. Le commerçant ne peut pas encore confirmer sa préparation depuis son espace.
- **Notifications de livraison** : `LIVRAISON_AFFECTEE`, `LIVREUR_ARRIVE` et `LIVRAISON_ECHEC` restent en français pour tous les comptes. À traduire (O-6).
- **Commandes multi-commerçants** : une commande qui contient des articles de plusieurs commerçants n'est pas encore scindée en sous-commandes. L'étape de préparation vaut pour la commande entière.

## 9. Rapport de passation — Étape 9

```
RAPPORT DE PASSATION — Étape 9
Date : 17 novembre 2026
Objectif livré : suivi de commande côté client (confirmée, en préparation, prête, en livraison, livrée)
Décision appliquée : D-CMD-1 (à valider)
Point ouvert : O-22 (saisie par le commerçant ; traduction des notifications de livraison)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0025_etape_preparation (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur, npm test 395/395 ; mobile typecheck 0 erreur, npm test 32/32
Ce qui n'est pas fait : saisie par le commerçant, traduction des notifications de livraison, sous-commandes, essai Supabase réel, essai téléphone
Proposition de l'étape suivante : étape 10 — durée d'échelonnement par article, selon votre réponse, ou saisie des étapes par le commerçant
```
