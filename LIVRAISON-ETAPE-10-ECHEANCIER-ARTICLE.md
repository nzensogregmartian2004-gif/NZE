# Livraison — Étape 10 : échéancier par article

Date : 17 novembre 2026. Décisions appliquées : **D-ECH-3** et **D-ECH-4** (validées, à confirmer par écrit). Point ouvert : **O-23**.

## 1. Objectif

Passer du réglage global au réglage par article : durée, avance, échéancier calculé, conditions affichées avant confirmation, pénalité réglable.

## 2. Ce qui change

**Articles (administration)**
- `PATCH /admin/produits/:id/echelonnable` accepte maintenant `echelonnable`, `dureeMois` (1 à 12) et `avancePourcent` (10 à 90). Une durée est obligatoire pour activer l'échelonnement d'un article. Sans avance renseignée, la valeur par défaut de l'offre s'applique (40 % à l'origine).

**Calcul**
- Pour chaque article : avance = prix × pourcentage, arrondie au franc supérieur ; reste = prix − avance ; mensualité de base = reste ÷ durée, arrondie au franc supérieur ; dernier mois = reste − mensualité × (durée − 1). Un calcul qui donnerait un dernier mois inférieur à 1 FCFA est refusé.
- La livraison est réglée avec l'avance.

**Plan**
- Chaque article du panier a sa ligne d'échéancier (`echeanciers_articles`), avec ses conditions et une contrainte qui vérifie que les montants se recoupent.
- L'avance du plan est la somme des avances des articles, plus la livraison. Le reste est la somme des restes. La transaction d'avance reste unique pour tout le panier.
- La mensualité du client n'est plus choisie : l'échéance de base est calculée. Si le client envoie un montant, il doit être au moins égal à la somme des bases ; il n'est pas stocké comme échéance (le versement libre viendra à l'étape 11).

**Conditions avant confirmation**
- `GET /commandes/:id/echelonnement/conditions` : totaux, avance, reste, mensualité, pénalité par mois, et détail par article (prix, avance, reste, durée, mensualité, dernier mois). Rien n'est enregistré.

**Pénalité**
- Réglage `echelonnement_penalite_mois`, 10 000 FCFA par défaut, bornes 0 à 100 000.
- `GET /admin/reglages/echelonnement/penalite` (administration), `PUT` (administrateur principal seul).
- L'application de la pénalité aux retards relève de l'étape 11.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/echelonnement/regles.ts`, `nze-backend/src/modules/echelonnement/service.ts`, `nze-backend/src/modules/echelonnement/routes.ts`, `nze-backend/tests/echelonnement.test.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0026_echeanciers_articles.sql`, `nze-backend/src/db/migrations/meta/0026_snapshot.json`, `nze-backend/tests/echeancier-article.test.ts`, `LIVRAISON-ETAPE-10-ECHEANCIER-ARTICLE.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0026_echeanciers_articles.sql`** :
- crée `echeanciers_articles` (une ligne par article et par plan), avec des contraintes de bornes et de cohérence des montants ;
- ajoute `produits.duree_mois` et `produits.avance_pourcent`, nullables. Les articles existants n'ont pas de durée : voir O-23.

Additive : aucune donnée modifiée.

**Sauvegarde** : à faire avant le déploiement (les migrations s'exécutent au démarrage sur Render).

## 5. Routes, permissions, événements

- `GET /commandes/:id/echelonnement/conditions` (client) : nouveau.
- `GET /admin/reglages/echelonnement/penalite` (administration) : nouveau.
- `PUT /admin/reglages/echelonnement/penalite` (administrateur principal) : nouveau.
- `PATCH /admin/produits/:id/echelonnable` : corps étendu (`dureeMois`, `avancePourcent`).
- `POST /commandes/:id/echelonnement` : la mensualité devient facultative.
- Journal : action `PRODUIT_ECHELONNABLE` enrichie des nouveaux champs ; action `ECHELONNEMENT_PENALITE` ajoutée.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests échelonnement (existants) | `node --test` sur `echelonnement` et `echelonnement-regles` | 29 réussis sur 29 |
| Tests échéancier par article | `node --test` sur `echeancier-article` | 3 réussis sur 3 |
| Tests backend | `npm test` (dans `nze-backend/`) | **398 réussis sur 398** (395 avant, 3 nouveaux) |

Les 3 nouveaux tests : deux articles dans un même panier avec leurs propres conditions (durée 3 et 6 mois, avances 40 % et 20 %), dont les montants sont vérifiés ; durée obligatoire et bornes ; pénalité réglable, avec refus pour l'administrateur secondaire.

Mobile : aucun changement. Dernier résultat connu : 32 réussis sur 32.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 7. Conséquences à connaître

- **Articles existants** : un article déjà marqué échelonnable sans durée ne peut plus être commandé en échelonné. Il faut régler sa durée (O-23).
- **Mensualité du client** : le client n'a plus à choisir son montant mensuel. Les écrans existants qui le proposent (aucun dans l'application à ce jour) devront être adaptés.
- **Situation du plan** : le calcul de situation existant (étape 3) se base sur la mensualité totale du plan. Pour un panier avec des durées différentes, il reste approximatif jusqu'à l'étape 11, qui le remplacera par le calcul article par article.

## 8. Essais à faire

1. Régler la durée et l'avance de deux articles, puis demander les conditions d'un panier qui les contient : chaque article affiche ses propres montants.
2. Tenter d'activer un article échelonnable sans durée : refus clair.
3. Modifier la pénalité en tant qu'administrateur secondaire : refus ; en tant que principal : acceptation.

## 9. Rapport de passation — Étape 10

```
RAPPORT DE PASSATION — Étape 10
Date : 17 novembre 2026
Objectif livré : échéancier par article (durée, avance, échéance de base), conditions avant confirmation, pénalité réglable
Décisions appliquées : D-ECH-3, D-ECH-4 (validées, à confirmer par écrit)
Point ouvert : O-23 (articles existants sans durée)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0026_echeanciers_articles (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur, npm test 398/398
Ce qui n'est pas fait : écran de conditions dans l'application, versements partiels et affectation au mois (étape 11), application des pénalités et surplus (étape 11), rappels (étape 12), vue commerçant (étape 13), essai Supabase réel, essai téléphone
Proposition de l'étape suivante : étape 11 — versements partiels, validation mensuelle, pénalités et surplus
```
