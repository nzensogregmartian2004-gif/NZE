# Livraison — Étape 2 : espace partenaire et lien collecte → stock

Date : 17 novembre 2026. Décisions appliquées : **D-COL-1**, **D-COL-2**, **D-PART-1** (nouvelles, à valider), voir `docs/01-DECISIONS.md`.

## 1. Objectif

Deux demandes du fondateur :

- l'espace partenaire doit montrer ce qui a été récupéré chez lui, ce qui a été vendu, ce qui est en stock ou en rupture, et ses retraits ;
- la validation d'une collecte doit mettre le stock à jour (ce n'était pas le cas).

## 2. Ce qui change

- **Validation d'une collecte** (`POST /admin/bordereaux/:id/decision`, `valider: true`) : chaque article conforme entre en stock, avec un mouvement `COLLECTE` rattaché au bordereau. Une seule entrée par collecte : une seconde validation est refusée (409).
- **Anomalie** : l'article bloqué n'entre pas en stock à la validation. Il entre à la levée de son blocage (`COLLECTE_DEBLOCAGE`) si la collecte est déjà validée ; sinon il entre à la validation. Aucune double entrée dans les deux ordres. La levée ne se fait qu'une fois.
- **Annulation** (`POST /admin/bordereaux/:id/annulation`) : refusée (409) pour une collecte validée, puisque son stock est déjà entré. La correction passe par un ajustement motivé.
- **Concurrence** : la validation et la levée de blocage verrouillent la collecte avant de lire ou d'écrire les lignes, pour qu'elles ne se croisent pas.
- **Historique partenaire** : nouvel onglet « Historique » avec quatre sections (collectes, ventes, stock en stock ou en rupture, retraits). Les données viennent des routes partenaire existantes. Les mouvements internes de réservation (`RESERVATION`, `LIBERATION`) ne sont plus renvoyés au partenaire.
- Libellés des statuts de collecte et de retrait traduits dans les quatre langues.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/stock/service.ts`, `nze-backend/src/modules/collectes/service.ts`, `nze-backend/src/modules/suivi-partenaire/service.ts`, `nze-mobile/src/i18n/dictionnaire.ts`, `nze-mobile/app/(partenaire)/_layout.tsx`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0021_collecte_stock.sql`, `nze-backend/src/db/migrations/meta/0021_snapshot.json`, `nze-backend/tests/collectes-stock.test.ts`, `nze-mobile/app/(partenaire)/historique.tsx`, `nze-mobile/src/lib/historique-partenaire.ts`, `nze-mobile/tests/historique-partenaire.test.ts`, `LIVRAISON-ETAPE-2-HISTORIQUE-PARTENAIRE.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0021_collecte_stock.sql`** (générée par drizzle-kit, puis relue) : ajoute `mouvements_stock.bordereau_id` (nullable, clé étrangère vers `bordereaux`). Additive : aucune donnée supprimée ni modifiée. Les mouvements existants gardent `NULL`.

**Sauvegarde** : faire une sauvegarde de la base Supabase avant le déploiement (les migrations s'exécutent au démarrage sur Render).

## 5. Routes, permissions, événements

Aucune route ni permission nouvelle. Comportements modifiés :

- `POST /admin/bordereaux/:id/decision` (valider) : crée les entrées de stock des articles conformes.
- `POST /admin/bordereaux/lignes/:id/levee-blocage` : crée l'entrée de stock si la collecte est validée.
- `POST /admin/bordereaux/:id/annulation` : 409 si la collecte est validée.
- `GET /partenaire/mouvements-stock` : ne renvoie plus les mouvements `RESERVATION` et `LIBERATION`.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **376 réussis sur 376** (372 avant, 4 nouveaux dans `collectes-stock.test.ts`) |
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **30 réussis sur 30** (26 avant, 4 nouveaux dans `historique-partenaire.test.ts`) |

Les 4 tests backend : validation (entrée unique, traçable au bordereau), anomalie (entrée à la levée après validation, levée une seule fois), levée avant validation (aucune double entrée), annulation refusée après validation.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 7. Essais à faire sur téléphone

1. Valider une collecte : dans l'onglet Stock, la quantité en stock augmente de la quantité collectée.
2. Collecte avec anomalie : l'article n'apparaît pas en stock ; après levée du blocage, il apparaît.
3. Onglet Historique : les quatre sections se chargent, la liste se complète avec « Charger plus ».
4. Tenter d'annuler une collecte validée : le message refuse l'annulation.

## 8. Risques et points ouverts

- **Collectes validées avant ce déploiement** : leurs articles ne sont pas en stock. Le stock système sera donc inférieur au stock réel tant qu'il n'est pas réconcilié. Décision à prendre : ajustements manuels motivés, ou script de reprise. Rien n'est fait automatiquement ici.
- **O-16 (double comptage)** : si la saisie du stock initial se fait en plus de la collecte, les articles sont comptés deux fois. La règle proposée est un stock initial à zéro, puis la collecte.
- **O-15** : les onglets Portefeuille et Historique se recouvrent (ventes et retraits). Décision à prendre.
- **Annulation d'une collecte validée** : désormais refusée. Si une annulation est nécessaire, elle passe par un ajustement motivé.
- Notifications push : toujours non traitées (étape 5).

## 9. Rapport de passation — Étape 2

```
RAPPORT DE PASSATION — Étape 2
Date : 17 novembre 2026
Objectif livré : historiques de l'espace partenaire ; collecte validée → stock
Décisions appliquées : D-COL-1, D-COL-2, D-PART-1 (à valider) ; D-P10 partiellement remplacée
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0021_collecte_stock (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur, npm test 376/376 ; mobile typecheck 0 erreur, npm test 30/30
Ce qui n'est pas fait : réconciliation des collectes validées avant déploiement, essai Supabase réel, essai téléphone, notifications push
Risques : voir section 8
Proposition de l'étape suivante : étape 3 — réglages de l'échelonnement (acompte, durée) et désactivation par défaut du drapeau par article
```
