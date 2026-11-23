# Livraison — Étape 1 : réservation du stock au paiement

Date : 17 novembre 2026. Décisions appliquées : **D-STOCK-1** (nouvelle, à valider), voir `docs/01-DECISIONS.md`.

## 1. Objectif

Empêcher la vente en double. Un article réservé pendant un paiement ne peut pas être payé par un autre client. La réservation est libérée en cas d'échec ou d'annulation, comme le demande l'exigence de gestion des stocks (réservation temporaire, libération, pas de vente en double).

## 2. Ce qui change

- Au lancement d'un paiement (en ligne, ou avance échelonnée), la réservation est créée **dans la même transaction** que la création du paiement. Si le stock vendable ne suffit pas, toute la transaction est annulée : aucun paiement n'est créé.
- La **quantité vendable** est le disponible moins le réservé. La fiche produit et le filtre « en stock » n'annoncent que cette quantité.
- À la confirmation du paiement, l'article est vendu une seule fois : le disponible et le réservé diminuent ensemble.
- À l'échec d'un paiement, ou à l'annulation d'un plan échelonné en attente, la réservation est libérée. La commande revient au panier et peut être réessayée.
- Un paiement non tranché (statut incertain, en attente) garde sa réservation tant qu'il n'est pas tranché.
- Un ajustement de stock ou un signalement du partenaire ne peut pas faire passer le disponible sous le réservé (409).
- Le stock réservé pour une commande est suivi par une colonne `stock_statut` sur la commande : `AUCUN`, `RESERVE`, `VENDU`, `LIBERE`.

Le problème corrigé : avant cette étape, le paiement n'engageait aucun stock. Deux clients pouvaient payer le même dernier article, le code acceptait les deux paiements et traçait seulement un écart.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/stock/service.ts` (réécrit), `nze-backend/src/modules/commandes/service.ts`, `nze-backend/src/modules/paiements/service.ts`, `nze-backend/src/modules/echelonnement/service.ts`, `nze-backend/src/modules/catalogue/service.ts`, `nze-backend/tests/commandes.test.ts`, `nze-backend/tests/echelonnement.test.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0020_reservation_stock.sql`, `nze-backend/src/db/migrations/meta/0020_snapshot.json`, `nze-backend/tests/reservation-stock.test.ts`, `LIVRAISON-ETAPE-1-RESERVATION-STOCK.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0020_reservation_stock.sql`** (générée par drizzle-kit, puis relue) :

- ajoute `commandes.stock_statut` (défaut `AUCUN`, valeurs contrôlées) ;
- ajoute la contrainte `reserve <= disponible` sur `stock_niveaux`.

Aucune table, colonne ou ligne n'est supprimée. Toutes les commandes existantes reçoivent `AUCUN`. Le réservé vaut déjà 0 partout (il n'était jamais alimenté), donc la contrainte est respectée.

**Sauvegarde** : faire une sauvegarde de la base Supabase avant le déploiement qui applique cette migration. Les migrations s'exécutent au démarrage sur Render.

## 5. Routes, permissions, événements

Aucune route nouvelle. Comportements modifiés :

- `POST /commandes/:id/paiement` et `POST /echelonnements/:id/avance` : 409 si la quantité vendable ne suffit pas ; aucun paiement n'est créé.
- `POST /admin/produits/:id/ajustements` et signalement du partenaire : 409 si le résultat passerait sous le réservé.
- `GET /produits` (filtre `enStock`) et `GET /produits/:id` : quantité et disponibilité calculées sur la quantité vendable.

Mouvements de stock : nouveaux types `RESERVATION` et `LIBERATION`. Le type `VENTE` porte aussi le delta du réservé.

Permissions : inchangées.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **372 réussis sur 372** (366 avant, 6 nouveaux) |

Les 6 nouveaux tests : 5 dans `reservation-stock.test.ts` (fiche et quantité vendable, deux paiements simultanés pour le dernier article, échec puis reprise par un autre client, ajustement refusé sous le réservé, paiement non tranché) et 1 dans `echelonnement.test.ts` (avance : réservée, libérée à l'échec, vendue une fois au succès). Deux tests existants ont été réécrits pour le nouveau comportement : « stock épuisé entre deux paiements » devient « dernier article », et « paiement échoué » vérifie la libération. Le test « paiement Airtel » se termine maintenant par la libération de son paiement en attente, pour ne pas laisser de réservation d'un test à l'autre.

Les migrations sont rejouées sur une base vide à chaque exécution de la suite.

- Mobile : non modifié, non relancé dans cette étape. Dernier résultat connu : typage 0 erreur, 26 tests sur 26.
- Non fait ici : essai sur une base Supabase réelle, essai sur téléphone.

## 7. Essais à faire sur téléphone

1. Un article avec une seule unité : deux comptes paient en même temps. Un seul paiement aboutit.
2. Pendant un paiement en attente, la quantité affichée baisse. Après un échec, elle revient.
3. Un paiement d'échelonnement en attente, puis annulé : l'article redevient disponible.

## 8. Risques et points ouverts

- **O-13** : une réservation reste bloquée tant que le fournisseur n'a pas répondu à un paiement. Un paiement abandonné peut donc immobiliser un article. Il n'y a pas encore de délai d'expiration.
- **O-14** : une avance encore en cours au moment de l'annulation d'un plan est libérée, mais son succès tardif n'est pas bloqué.
- **Paiements lancés avant le déploiement** (`stock_statut = AUCUN`) : leur succès suit l'ancien chemin. Un écart est alors possible, tracé par le motif `STOCK_INSUFFISANT_APRES_PAIEMENT`.
- **Signalement partenaire** : une vente ou une rupture signalée est refusée (409) tant qu'un paiement réserve des articles.
- **Non traité ici** : alerte de stock faible pour l'administration. Le client voit déjà « stock faible » (seuil existant dans `catalogue/service.ts`).

## 9. Rapport de passation — Étape 1

```
RAPPORT DE PASSATION — Étape 1
Date : 17 novembre 2026
Objectif livré : réservation du stock au paiement (vente en double empêchée)
Décisions appliquées : D-STOCK-1 (à valider)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0020_reservation_stock (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés (commande et résultat) : typecheck 0 erreur ; npm test backend 372 sur 372
Ce qui n'est pas fait : O-13, O-14, alerte admin de stock faible, essai Supabase réel, essai téléphone
Risques : voir section 8
Proposition de l'étape suivante : étape 2 — espace partenaire (historiques des collectes, ventes, stock, retraits) et lien collecte → stock
```
