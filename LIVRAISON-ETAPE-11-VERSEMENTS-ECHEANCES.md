# Livraison — Étape 11 : versements, validation mensuelle, pénalités

Date : 17 novembre 2026. Décisions appliquées : **D-ECH-5**, **D-ECH-6**, **D-ECH-7** (validées, à confirmer par écrit). Point ouvert : **O-24**.

## 1. Objectif

Faire vivre l'échéancier : chaque versement est affecté à un article, chaque mois est suivi, le reste est recalculé, et les pénalités s'appliquent après le dernier mois.

## 2. Ce qui change

**Ouverture des échéances** : à la validation de l'avance, chaque article reçoit une ligne par mois (montant dû, montant payé, date limite). Le mois 1 tombe le même jour du mois suivant, puis chaque mois après.

**Versement** : le client choisit l'article (`echeancierId`). Pour un plan à article unique, le choix est automatique ; pour un plan à plusieurs articles, il est obligatoire. Le montant ne peut pas dépasser le solde de l'article, pénalités comprises.

**Affectation à l'encaissement** : le montant va d'abord au mois le plus ancien non soldé, puis aux pénalités dues. Un trop-perçu, s'il existe, est porté sur le dernier mois et tracé. Chaque affectation est enregistrée (`affectations_versement`).

**Recalcul du reste (option a)** : après chaque versement, le reste de l'achat est réparti sur les mois non soldés, la durée est conservée. Le dernier mois absorbe l'arrondi.

**États d'un mois** : validé si entièrement versé ; partiel si un versement est inférieur ; en retard si la date limite est dépassée sans solde ; à venir sinon.

**Pénalités** : une par mois complet écoulé après la dernière date limite, tant qu'un solde du principal reste dû. Montant : celui du réglage (10 000 FCFA par défaut). Elles sont appliquées par la relance quotidienne existante. Elles reviennent à NZE : elles s'ajoutent à la commission, jamais à la part du commerçant, et elles sont exclues du cumul de l'achat.

**Clôture** : le plan passe à « soldé » seulement quand le principal est réglé et qu'aucune pénalité ne reste due.

**Route** : `GET /echelonnements/:id/echeanciers` (client) : mois par mois, avec statut, montant dû, montant payé, reste, date limite, et pénalités.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/modules/echelonnement/service.ts`, `nze-backend/src/modules/echelonnement/routes.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/modules/echelonnement/echeances.ts`, `nze-backend/src/db/migrations/0027_echeances_mois.sql`, `nze-backend/src/db/migrations/meta/0027_snapshot.json`, `nze-backend/tests/echeances-mois.test.ts`, `LIVRAISON-ETAPE-11-VERSEMENTS-ECHEANCES.md`.
- **Supprimés** : aucun fichier.

## 4. Migration

**`0027_echeances_mois.sql`** : ajoute `versements_echelonnes.echeancier_id` (nullable), et crée `echeances_mois`, `penalites_echeancier` et `affectations_versement`. Additive : aucune donnée existante modifiée. Les plans créés avant l'étape 10 n'ont pas d'échéances : leurs versements suivent l'ancien chemin.

**Sauvegarde** : à faire avant le déploiement (les migrations s'exécutent au démarrage sur Render).

## 5. Routes, permissions, événements

- `POST /echelonnements/:id/versements` : accepte `echeancierId` (optionnel pour un plan à article unique, obligatoire sinon).
- `GET /echelonnements/:id/echeanciers` : nouveau (client).
- `GET /echelonnements/:id/verifier-paiement` : encaisse aussi l'affectation aux mois et aux pénalités.
- `relancerEcheances` (relance quotidienne) : applique d'abord les pénalités.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests échelonnement (existants) | `node --test` sur `echelonnement`, `echelonnement-regles`, `echeancier-article` | 32 réussis sur 32 |
| Tests échéances mensuelles | `node --test` sur `echeances-mois` | 4 réussis sur 4 |
| Tests backend | `npm test` (dans `nze-backend/`) | **402 réussis sur 402** (398 avant, 4 nouveaux) |

Les 4 nouveaux tests : ouverture des trois mensualités avec leurs dates ; versement partiel affecté au mois le plus ancien, avec recalcul ; plan soldé quand tout est réglé ; pénalités après le dernier mois, puis réglées après les mois.

Mobile : aucun changement.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 7. Conséquences à connaître

- **Présentation** : le montant « dû » d'un mois partiel inclut ce qui est déjà payé (O-24). Un écran devra afficher le reste à payer du mois.
- **Situation du plan** : le calcul de situation existant (étape 3) se base encore sur la mensualité totale du plan. Il est approximatif pour un panier aux durées différentes ; les rappels de l'étape 12 le remplaceront par le calcul par article.
- **Application mobile** : aucun écran d'échéancier ni de versement par article n'existe encore côté client.

## 8. Essais à faire

1. Régler l'avance, puis verser 3 000 FCFA sur un article de 6 000 FCFA restant sur 3 mois : le mois 1 est validé, le mois 2 partiel, le reste est recalculé.
2. Laisser passer le dernier mois sans solde, puis déclencher la relance : une pénalité de 10 000 FCFA apparaît.
3. Régler le principal puis les pénalités : le plan passe à « soldé ».

## 9. Rapport de passation — Étape 11

```
RAPPORT DE PASSATION — Étape 11
Date : 17 novembre 2026
Objectif livré : versements affectés aux mois, validation mensuelle, recalcul du reste, pénalités
Décisions appliquées : D-ECH-5, D-ECH-6, D-ECH-7 (validées, à confirmer par écrit)
Point ouvert : O-24 (présentation du reste d'un mois partiel)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : 0027_echeances_mois (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur, npm test 402/402
Ce qui n'est pas fait : écran d'échéancier et de versement dans l'application, rappels par échéance (étape 12), vue commerçant (étape 13), essai Supabase réel, essai téléphone
Proposition de l'étape suivante : étape 12 — rappels d'échéance et alertes de retard, par article et par mois
```
