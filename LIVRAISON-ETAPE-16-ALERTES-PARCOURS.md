# Livraison — Étape 16 : alertes par article et parcours de bout en bout

Date : 17 novembre 2026. Décision appliquée : **D-ECH-12** (à confirmer par écrit). Points ouverts : **O-32**, **O-33**.

## 1. Objectif

Clore O-31 : les alertes d'un plan (échéance en cours, retard) doivent venir du calcul par article, et non de l'ancienne situation par plan. Vérifier aussi le parcours complet d'un paiement échelonné.

## 2. Ce qui change

**Alertes par article**
- `alertesPlan` : pour chaque article, le premier mois non soldé donne l'échéance en cours ; la somme de ces restes est affichée. Un retard est signalé dès qu'un mois d'un article est en retard.
- Vue du commerçant (`GET /partenaire/echelonnements`) : `dueCetteEcheanceFcfa` et `enRetard` viennent de ce calcul.
- Vue du client (`GET /echelonnements/:id` et la liste des plans) : mêmes champs, mêmes règles.
- Pour un plan antérieur à l'étape 10 (sans échéancier par article), l'ancien calcul reste en place.

**Parcours de bout en bout** (base de test embarquée, mêmes migrations)
- Achat, avance de 4 000 FCFA, plan actif, trois mensualités ouvertes.
- Premier mois réglé par un versement de 2 000 FCFA.
- Deuxième mois sans solde après sa date : le commerçant voit le retard, et la relance prévient le client (notification `ECHEANCE_RETARD` sur le mois).
- Rattrapage de 4 000 FCFA : le plan est soldé, et le commerçant a reçu toute sa part (8 500 FCFA).

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/echelonnement/echeances.ts` (calcul des alertes), `nze-backend/src/modules/echelonnement/service.ts` (vues commerçant et client), `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/tests/parcours-echelonnement.test.ts`, `LIVRAISON-ETAPE-16-ALERTES-PARCOURS.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune route nouvelle. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests du parcours | `node --test` sur `parcours-echelonnement` | 2 réussis sur 2 |
| Tests backend | `npm test` (dans `nze-backend/`) | **411 réussis sur 411** (409 avant, 2 nouveaux) |
| Mobile | (non modifié) | 38 réussis sur 38 |

Les 2 tests : le parcours complet, de l'avance à la clôture, avec retard et relance ; et les alertes du client, calculées par article.

**Ce qui n'a pas été fait : le parcours n'a pas été joué sur la base Supabase réelle.** Je n'ai pas accès à cette base depuis cet environnement, et je ne demande ni ne répète ses identifiants.

## 5. Procédure pour la base de préproduction (O-32)

1. Exécuter les migrations sur une base de préproduction (`npm run db:migrate`, avec la configuration de préproduction, en variables d'environnement).
2. Jouer le parcours de la section 2 à la main, avec des comptes de test : avance, versement, relance (`job:relances` ou la tâche planifiée), rattrapage.
3. Vérifier la vue du commerçant et le détail du client à chaque étape.
4. Noter les écarts dans un journal, avant toute mise en production.

## 6. Risques et points ouverts

- **O-32** : parcours non joué sur la base réelle ; à faire avant la mise en production.
- **O-33** : le filtre « en retard » de la liste d'administration utilise encore l'ancienne situation par plan. Il peut donc diverger des vues commerçant et client.
- **Mobile** : aucune modification dans cette étape ; les vues ont été mises à jour côté serveur.

## 7. Rapport de passation — Étape 16

```
RAPPORT DE PASSATION — Étape 16
Date : 17 novembre 2026
Objectif livré : alertes du commerçant et du client calculées par article ; parcours complet testé sur la base embarquée
Décision appliquée : D-ECH-12 (à confirmer par écrit)
Points ouverts : O-32 (base Supabase de préproduction, à faire par l'équipe), O-33 (filtre administration)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : aucun nouveau
Tests exécutés : backend typecheck 0 erreur, npm test 411/411 ; mobile inchangé 38/38
Ce qui n'est pas fait : parcours sur la base Supabase réelle (O-32), filtre administration (O-33), essai téléphone
Proposition de l'étape suivante : étape 17 — filtre administration aligné (O-33), puis préparation de la mise en production (procédure de déploiement, sauvegarde, variables d'environnement)
```
