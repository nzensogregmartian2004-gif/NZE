# Livraison — Étape 4 : retrait partenaire par carte (désactivé)

Date : 17 novembre 2026. Décision appliquée : **D-CARTE-1** (nouvelle, à valider). Point ouvert : **O-18**.

## 1. Objectif

Préparer le retrait par carte (Visa, Mastercard) sans l'ouvrir avant que MyPVit ait confirmé par écrit ses versements vers carte.

## 2. Ce qui change

- **Verrou** : `RETRAIT_CARTE_DISPONIBLE = false` dans `finance/retraits.ts`. Tant qu'il vaut `false`, toute demande de retrait par carte est refusée (409), et aucune demande n'est créée. Une demande carte déjà acceptée ne peut pas non plus être versée (409).
- **Aucune donnée de carte** : le partenaire ne saisit ni numéro ni donnée de carte pour un retrait par carte. Un numéro envoyé avec un retrait par carte est refusé (400). Un retrait Airtel Money ou Moov Money exige toujours son numéro.
- **Base de données** : l'opérateur `CARTE` est accepté. Le numéro devient facultatif, mais seulement pour `CARTE` : la base refuse une ligne mobile sans numéro.
- **Versement** : le libellé du bénéficiaire reste obligatoire. Le versement mobile n'a pas changé.

Ce qui ne change pas : le retrait Airtel Money et Moov Money, l'approbation par l'administrateur principal, les soldes et les versements.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/finance/retraits.ts`, `nze-backend/src/modules/finance/routes.ts`, `nze-backend/tests/migrations-chaine.test.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0023_retrait_carte.sql`, `nze-backend/src/db/migrations/meta/0023_snapshot.json`, `nze-backend/tests/retraits-carte.test.ts`, `LIVRAISON-ETAPE-4-RETRAIT-CARTE.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0023_retrait_carte.sql`** (générée par drizzle-kit, relue) :

- supprime la contrainte d'opérateur, puis la recrée avec `CARTE` ;
- rend `numero` facultatif (`DROP NOT NULL`) ;
- ajoute la contrainte `retrait_numero_chk` : un numéro est obligatoire sauf pour `CARTE`.

Aucune donnée n'est supprimée. Toutes les lignes existantes ont un numéro et un opérateur mobile : elles respectent les nouvelles contraintes.

**Sauvegarde** : à faire avant le déploiement, comme pour toute migration (les migrations s'exécutent au démarrage sur Render).

Le test de la chaîne de migrations vérifiait l'ajout ou la modification de défaut, mais pas la nullabilité. Il vérifie désormais aussi la nullabilité, pour que cette migration soit reconnue comme une vraie évolution.

## 5. Routes, permissions, événements

- `POST /partenaire/retraits` : accepte `operateur` = `AIRTEL_MONEY`, `MOOV_MONEY` ou `CARTE` ; `numero` est requis pour les opérateurs mobiles et interdit pour `CARTE`.
- Aucune route ni permission nouvelle. Le retrait carte est refusé tant que le verrou est fermé.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **383 réussis sur 383** (380 avant, 3 nouveaux dans `retraits-carte.test.ts`) |
| Test de migration | `node --test tests/migrations-chaine.test.ts` | 1 réussi sur 1 (après extension à la nullabilité) |

Les 3 nouveaux tests : retrait carte refusé (409, aucune demande créée) ; données de carte refusées et numéro mobile exigé (400) ; base de données qui accepte une ligne carte sans numéro et refuse une ligne mobile sans numéro.

Mobile : aucun changement dans cette étape. Dernier résultat connu : typage 0 erreur, 30 tests sur 30.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone, versement carte (volontairement non branché).

## 7. Essais à faire

1. Côté partenaire, un retrait Airtel Money ou Moov Money fonctionne comme avant.
2. Une tentative de retrait par carte est refusée avec un message clair, et aucune demande n'apparaît.

## 8. Risques et points ouverts

- **O-18** : tant que MyPVit n'a pas confirmé par écrit, le verrou reste fermé. La confirmation doit aussi préciser comment les données de carte du bénéficiaire sont saisies, car NZE ne les collecte pas.
- **Branchement du versement carte** : à faire une fois la confirmation reçue. Le verrou devra alors passer à `true`, après le branchement et les tests du versement.
- **Application mobile** : aucune option carte n'est affichée, ce qui est volontaire tant que le retrait est désactivé.

## 9. Rapport de passation — Étape 4

```
RAPPORT DE PASSATION — Étape 4
Date : 17 novembre 2026
Objectif livré : retrait partenaire par carte préparé et désactivé ; aucune donnée de carte stockée
Décision appliquée : D-CARTE-1 (à valider)
Point ouvert : O-18 (confirmation MyPVit)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0023_retrait_carte (nullabilité et contraintes, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur ; npm test 383/383 ; test de migration 1/1
Ce qui n'est pas fait : versement carte, option carte dans l'application, essai Supabase réel, essai téléphone
Risques : voir section 8
Proposition de l'étape suivante : étape 5 — notifications push (Firebase), selon votre priorité
```
