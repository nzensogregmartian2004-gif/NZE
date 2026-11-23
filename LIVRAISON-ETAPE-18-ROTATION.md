# Livraison — Étape 18 : rotation des identifiants

Date : 17 novembre 2026. Décision appliquée : **D-PROD-2** (à confirmer par écrit).

## 1. Objectif

Fermer le premier point bloquant de la procédure de mise en production : les identifiants écrits dans une discussion doivent être remplacés.

## 2. Ce qui a été fait

- **Procédure** (`docs/ROTATION-IDENTIFIANTS.md`) : ce qui a été exposé, l'ordre des six actions, la vérification après chacune, et ce que l'assistant ne fait pas.
- **Contrôle de secrets** (`nze-backend/scripts/verifier-secrets.mjs`, commande `npm run verifier:secrets`) : parcourt le dépôt à la recherche de motifs courants (clés AWS, clés privées, jetons JWT, clés de production). Il n'affiche jamais la valeur trouvée, seulement l'emplacement.
- **Vérification du contrôle** : un motif factice a bien été détecté ; le fichier de test a ensuite été supprimé et le dépôt est revenu à « aucun secret ».

## 3. Ce qui reste à faire par le fondateur

Ces actions se font depuis les comptes Cloudflare, MyPVit, Supabase, Render et Google Cloud. L'assistant ne peut ni les effectuer ni les vérifier :

1. Révoquer le premier jeton R2 et en créer un nouveau, limité au bucket NZE.
2. Obtenir de MyPVit une nouvelle clé de production, et mettre à jour les variables correspondantes dans Render.
3. Si le mot de passe de la base a été exposé, le réinitialiser dans Supabase et mettre à jour `DATABASE_URL`.
4. Si `SESSION_SECRET` a été exposé, le régénérer (les utilisateurs se reconnecteront).
5. Si la clé Google Maps a été exposée, la restreindre ou la régénérer.
6. Créer la clé de service Firebase (O-19).

Me confirmer les actions faites me permet de consigner leur clôture dans le journal.

## 4. Vérifications faites

| Vérification | Commande | Résultat |
|---|---|---|
| Contrôle de secrets sur le dépôt | `npm run verifier:secrets` | 0 emplacement |
| Contrôle de détection | motif factice ajouté, puis retiré | détecté, sans affichage de la valeur |
| Typage backend | `npm run typecheck` | 0 erreur |
| Tests backend | `npm test` | 412 réussis sur 412 (inchangé) |

## 5. Rapport de passation — Étape 18

```
RAPPORT DE PASSATION — Étape 18
Date : 17 novembre 2026
Objectif livré : procédure de rotation des identifiants ; contrôle de secrets dans le dépôt
Décision appliquée : D-PROD-2 (à confirmer par écrit)
Fichiers modifiés / ajoutés / supprimés : nze-backend/package.json (script), nze-backend/scripts/verifier-secrets.mjs, docs/ROTATION-IDENTIFIANTS.md, docs/01-DECISIONS.md, docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md, LIVRAISON-ETAPE-18-ROTATION.md
Migrations : aucune
Tests exécutés : backend typecheck 0 erreur, npm test 412/412 ; contrôle de secrets 0 emplacement
Ce qui n'est pas fait (par le fondateur) : révocation R2, nouvelle clé MyPVit, éventuelles autres expositions, Firebase (O-19), préproduction (O-32)
Statut de mise en production : NON PRÊT tant que les actions de rotation ne sont pas confirmées
Proposition de l'étape suivante : étape 19 — préproduction (O-32) dès que la base de préproduction et les identifiants de test existent, ou Firebase (O-19) selon l'ordre choisi
```
