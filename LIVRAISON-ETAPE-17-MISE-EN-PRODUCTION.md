# Livraison — Étape 17 : liste d'administration et procédure de mise en production

Date : 17 novembre 2026. Décision appliquée : **D-PROD-1** (à confirmer par écrit).

## 1. Objectif

Clore O-33 (filtre « en retard » de l'administration) et préparer le déploiement : une procédure complète, sans aucune valeur secrète, qui liste ce qui bloque encore la mise en production.

## 2. Ce qui change

**Administration (serveur)**
- `GET /admin/echelonnements?enRetard=true|false` s'appuie désormais sur le calcul par article, comme les vues du commerçant et du client. L'ancien calcul ne reste que pour les plans antérieurs à l'étape 10.

**Procédure** (`docs/PROCEDURE-MISE-EN-PRODUCTION.md`)
- Points bloquants, dont la révocation des identifiants compromis et la validation de la préproduction.
- Liste des variables d'environnement, par nom, avec leur rôle et leur caractère secret. Aucune valeur.
- Sauvegarde, migrations (dont la 0013, destructive), déploiement pas à pas, tâches planifiées, état par défaut, vérifications, retour arrière.

**Vérifications de préparation faites à cette étape**
- La tâche `alertes-retards` traite les réclamations, pas l'échelonnement : pas de correction à faire.
- La relance quotidienne tourne à 08 h UTC, soit 09 h à Libreville : c'est l'heure visée par O-26.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/echelonnement/service.ts` (liste d'administration), `nze-backend/tests/parcours-echelonnement.test.ts` (test du filtre), `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `docs/PROCEDURE-MISE-EN-PRODUCTION.md`, `LIVRAISON-ETAPE-17-MISE-EN-PRODUCTION.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune route nouvelle. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests du parcours et de l'échelonnement | `node --test` sur `parcours-echelonnement` et `echelonnement` | 18 réussis sur 18 |
| Tests backend | `npm test` (dans `nze-backend/`) | **412 réussis sur 412** (411 avant, 1 nouveau) |
| Mobile | (non modifié) | 38 réussis sur 38 |

Le nouveau test vérifie qu'un plan à jour est listé hors retard, puis listé dans le filtre « en retard » dès que son premier mois dépasse sa date limite.

## 5. Ce qui bloque la mise en production

La procédure, section 2, liste les points bloquants. Les plus importants :

- **Identifiants compromis** : un jeton Cloudflare R2 et une clé MyPVit de production ont été écrits dans une discussion. Ils doivent être révoqués et remplacés dans Render. Je ne les ai ni répétés ni utilisés.
- **Préproduction** (O-32) : le parcours n'a pas été joué sur la base Supabase.
- **Firebase** (O-19) : sans la clé de service et `google-services.json`, aucune notification push n'est envoyée.
- **Décisions à valider par écrit** : D-ECH-3 à D-ECH-12, D-STOCK-2, D-PUSH-1 à D-PUSH-3, D-CMD-1, D-CARTE-1, D-COL-1, D-COL-2, D-PART-1, D-PROD-1.

## 6. Essais à faire avant la mise en production

1. Procédure complète sur la préproduction : migrations, tâches planifiées, smoke test en lecture seule.
2. Restauration de la sauvegarde sur une base de test.
3. Retour arrière simulé, pour vérifier que la procédure de la section 10 fonctionne.
4. Contrôle des identifiants : anciens secrets révoqués, nouveaux secrets en place.

## 7. Rapport de passation — Étape 17

```
RAPPORT DE PASSATION — Étape 17
Date : 17 novembre 2026
Objectif livré : filtre « en retard » par article (O-33) ; procédure de mise en production
Décision appliquée : D-PROD-1 (à confirmer par écrit)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : aucun nouveau
Tests exécutés : backend typecheck 0 erreur, npm test 412/412 ; mobile inchangé 38/38
Statut de mise en production : NON PRÊT (points bloquants, voir section 5 et docs/PROCEDURE-MISE-EN-PRODUCTION.md)
Ce qui n'est pas fait : préproduction (O-32), révocation des identifiants, Firebase (O-19), validations écrites, essai téléphone
Proposition de l'étape suivante : étape 18 — fermer les points bloquants un par un (révocation des identifiants, Firebase, préproduction), selon l'ordre de votre choix
```
