# Livraison — Étape 3 : réglages de l'échelonnement

Date : 17 novembre 2026. Décisions appliquées : **D-ECH-1** et **D-ECH-2** (nouvelles, à valider), voir `docs/01-DECISIONS.md`.

## 1. Objectif

Deux demandes du fondateur :

- l'acompte et la durée ne doivent pas être codés en dur : l'administrateur principal doit pouvoir les régler ;
- un article ne doit pas devenir échelonnable sans un choix explicite.

## 2. Ce qui change

- **Réglages** : l'acompte (40 % à l'origine) et la durée maximale (3 mois à l'origine) sont stockés dans la table des réglages, sous la clé `echelonnement_parametres`. Bornes : acompte de 10 à 90 % (entier), durée de 1 à 12 mois (entier). Une valeur hors bornes est refusée.
- **Calcul du plan** : l'avance, le reste, la mensualité minimale et le message d'erreur utilisent les réglages. Sans réglage enregistré, les valeurs initiales s'appliquent.
- **Portée** : le réglage ne s'applique qu'aux plans créés après le changement. Les plans existants gardent leurs montants.
- **Notification** : la proposition de plan indique la durée réglée, et non plus une valeur fixe.
- **Article neuf** : le drapeau `echelonnable` vaut `false` par défaut. Un article ne devient échelonnable que par activation explicite de l'administrateur.
- Le nombre maximal d'articles par paiement échelonné reste 5. Il n'a pas été demandé de le régler.

Ce qui ne change pas : le drapeau d'activation global `echelonnement_actif` reste désactivé par défaut, et la logique de versements, de retards et de répartition est inchangée.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/echelonnement/regles.ts`, `nze-backend/src/modules/echelonnement/service.ts`, `nze-backend/src/modules/echelonnement/routes.ts`, `nze-backend/tests/echelonnement.test.ts`, `nze-backend/tests/echelonnement-regles.test.ts`, `nze-backend/tests/migrations-chaine.test.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0022_echelonnable_defaut.sql`, `nze-backend/src/db/migrations/meta/0022_snapshot.json`, `LIVRAISON-ETAPE-3-REGLAGES-ECHELONNEMENT.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0022_echelonnable_defaut.sql`** : `ALTER TABLE produits ALTER COLUMN echelonnable SET DEFAULT false`. Aucune donnée modifiée : les articles existants gardent leur valeur. Sauvegarde recommandée avant déploiement, comme pour toute migration (les migrations s'exécutent au démarrage sur Render).

Un test de la chaîne de migrations vérifiait seulement l'ajout de colonnes ou de tables. Il vérifie désormais aussi les changements de valeur par défaut, pour que cette migration soit reconnue comme une vraie évolution.

## 5. Routes, permissions, événements

Nouvelles routes :

- `GET /admin/reglages/echelonnement/parametres` : lecture, administration (`admin`).
- `PUT /admin/reglages/echelonnement/parametres` : modification, administrateur principal seul (`principal`). Corps : `{ avancePourcent, dureeMaxMois }`.

Journal d'audit : action `ECHELONNEMENT_PARAMETRES`, avec les valeurs saisies.

Comportement modifié : `POST /commandes/:id/echelonnement` utilise les réglages ; un article neuf est refusé tant qu'il n'est pas activé pour l'échelonnement.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **380 réussis sur 380** (376 avant, 4 nouveaux) |
| Tests échelonnement | `node --test` sur `echelonnement-regles` et `echelonnement` | 29 réussis sur 29 |
| Tests migrations | `node --test` sur `migrations-chaine` | 1 réussi sur 1 |

Les 4 nouveaux tests : réglage appliqué au calcul du plan et valeurs initiales (règles pures) ; bornes et entiers refusés (règles pures) ; article neuf non échelonnable ; réglage lu, réservé à l'administrateur principal, refusé hors bornes, et suivi par le plan créé.

Mobile : aucun changement dans cette étape. Dernier résultat connu : typage 0 erreur, 30 tests sur 30.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

Note sur le test de migration : il est étendu aux modifications de valeur par défaut. Sa vérification d'origine (une migration fait évoluer le schéma) est conservée.

## 7. Essais à faire

1. En tant qu'administrateur principal, régler l'acompte à 30 % : un nouveau plan propose 30 %, et l'administrateur secondaire reçoit un refus.
2. Créer un article : il n'est pas proposé en paiement échelonné tant qu'il n'est pas activé.
3. Régler une valeur hors bornes (5 %, 13 mois) : refus avec message clair.

## 8. Risques et points ouverts

- **O-17** : les articles existants restent échelonnables par défaut. Il faut revoir leur liste avant d'activer l'échelonnement.
- **Plans existants** : ils gardent leurs montants. Un changement de réglage ne les modifie pas.
- **Réglage hors bornes en base** : une valeur corrompue est remplacée par les valeurs initiales au calcul, sans alerte. À surveiller.
- **Règles de l'offre** : le cahier demande aussi des conditions par partenaire ; ce changement reste global, comme demandé. Une extension par partenaire est possible si vous la demandez.
- Les aspects juridiques et de trésorerie restent de votre ressort, comme convenu.

## 9. Rapport de passation — Étape 3

```
RAPPORT DE PASSATION — Étape 3
Date : 17 novembre 2026
Objectif livré : acompte et durée réglables ; article neuf non échelonnable par défaut
Décisions appliquées : D-ECH-1, D-ECH-2 (à valider)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0022_echelonnable_defaut (défaut de colonne uniquement, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur ; npm test 380/380
Ce qui n'est pas fait : essai Supabase réel, essai téléphone, revue des articles existants (O-17)
Risques : voir section 8
Proposition de l'étape suivante : étape 4 — retraits partenaires par carte (désactivés en attendant la confirmation de MyPVit), ou selon votre priorité
```
