# Livraison — Étape 13 : vue commerçant et échéancier client

Date : 17 novembre 2026. Décision appliquée : **D-ECH-9** (à confirmer par écrit). Points ouverts : **O-27**, **O-28**.

## 1. Objectif

Donner au commerçant de la visibilité sur les paiements échelonnés de ses articles, et au client la lecture de son échéancier depuis l'application.

## 2. Ce qui change

**Côté commerçant (serveur)** — `GET /partenaire/echeanciers`
- Une ligne par article de son magasin : prix, durée, avance, **encaissé** (avance + mois payés), **attendu** (reste principal non payé), et nombre de mois validés, partiels et en retard.
- Aucune identité de client, seulement la référence de commande.
- Aucune pénalité : elles reviennent à NZE.
- Limité au magasin du commerçant connecté.

**Côté client (serveur)**
- `GET /commandes/:id` renvoie désormais `echelonnementId` quand la commande est échelonnée.

**Côté application**
- Commerçant : nouvel onglet « Échéances » dans l'historique, avec pour chaque article l'encaissé, l'attendu et l'état des mois.
- Client : depuis le détail d'une commande échelonnée, un lien « Voir mon échéancier » ouvre l'écran d'échéancier, mois par mois, avec statut, montant dû, montant payé et pénalités. Lecture seule.

Ce qui ne change pas : la vue par plan existante (`/partenaire/echelonnements`) reste en place.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/echelonnement/echeances.ts`, `nze-backend/src/modules/echelonnement/routes.ts`, `nze-backend/src/modules/commandes/service.ts`, `nze-mobile/src/i18n/dictionnaire.ts`, `nze-mobile/app/commande/[id].tsx`, `nze-mobile/app/(partenaire)/historique.tsx`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/tests/vue-commercant.test.ts`, `nze-mobile/app/echeancier/[id].tsx`, `nze-mobile/src/lib/echeancier.ts`, `nze-mobile/tests/echeancier.test.ts`, `LIVRAISON-ETAPE-13-VUE-COMMERCANT.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests vue commerçant | `node --test` sur `vue-commercant` | 3 réussis sur 3 |
| Tests backend | `npm test` (dans `nze-backend/`) | **409 réussis sur 409** (406 avant, 3 nouveaux) |
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **34 réussis sur 34** (32 avant, 2 nouveaux) |

Les 3 tests : la vue montre encaissé, attendu et états des mois de l'article du commerçant ; elle ne montre ni identité de client ni pénalité, et un autre commerçant ne voit pas l'article ; le client retrouve l'identifiant de son plan dans sa commande.

Point d'attention pendant le développement : une route `/partenaire/echelonnements` existait déjà (étape 3). La nouvelle vue par article a donc été exposée sous `/partenaire/echeanciers` pour ne pas la masquer (O-27).

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 5. Essais à faire

1. Connecté comme commerçant, ouvrir l'historique : onglet « Échéances » ; chaque article affiche l'encaissé, l'attendu et l'état de ses mois.
2. Connecté comme client, ouvrir une commande échelonnée : « Voir mon échéancier » ouvre le détail mois par mois.
3. Vérifier qu'aucun nom ni numéro de client n'apparaît dans la vue commerçant.

## 6. Risques et points ouverts

- **O-27** : deux vues commerçant coexistent (par plan et par article). À fusionner ou à garder séparées.
- **O-28** : le client voit son échéancier, mais il ne peut pas encore régler une échéance depuis l'application. Le paiement d'une mensualité ou d'une pénalité reste à construire (écran de versement par article).
- **Encaissé** : la vue commerçant compte l'avance et les mois payés, mais pas les pénalités. Un désaccord sur cette présentation est à signaler.

## 7. Rapport de passation — Étape 13

```
RAPPORT DE PASSATION — Étape 13
Date : 17 novembre 2026
Objectif livré : vue commerçant en lecture seule par article ; échéancier client en lecture seule
Décision appliquée : D-ECH-9 (à confirmer par écrit)
Points ouverts : O-27 (deux vues commerçant), O-28 (paiement d'une échéance depuis l'application)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : GET /partenaire/echeanciers (commerçant) ; échéancier client via GET /echelonnements/:id/echeanciers
Tests exécutés : backend typecheck 0 erreur, npm test 409/409 ; mobile typecheck 0 erreur, npm test 34/34
Ce qui n'est pas fait : paiement d'une échéance depuis l'application (O-28), fusion des vues commerçant (O-27), essai Supabase réel, essai téléphone
Proposition de l'étape suivante : étape 14 — paiement d'une échéance depuis l'application (versement par article et pénalités), ou selon votre priorité
```
