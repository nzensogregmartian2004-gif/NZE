# Livraison — Étape 12 : rappels et alertes par mois

Date : 17 novembre 2026. Décision appliquée : **D-ECH-8** (validée, à confirmer par écrit). Points ouverts : **O-25**, **O-26**.

## 1. Objectif

Informer le client de chaque échéance : approche de la date limite, jour de l'échéance, retard, et chaque pénalité ajoutée. Les rappels sont calculés mois par mois, et non plus par plan.

## 2. Ce qui change

**Rappels par mois** (relance quotidienne existante, `relancerEcheances`) :
- trois jours avant la date limite (jusqu'à trois jours inclus) : rappel `ECHEANCE_RAPPEL` ;
- le jour même : alerte `ECHEANCE_DU_JOUR` ;
- le lendemain, si le mois n'est toujours pas soldé : `ECHEANCE_RETARD`.

Un mois soldé ne génère aucun rappel. Chaque type n'est envoyé qu'une fois par mois : une relance faite deux fois le même jour ne crée pas de doublon.

**Pénalités** : chaque pénalité ajoutée déclenche `PENALITE_APPLIQUEE` pour le client.

**Canaux** : notification dans l'application et push. Jamais de SMS.

**Textes** : quatre types, traduits en français, anglais, arabe et chinois simplifié, avec le produit, le numéro du mois, le montant restant et la date.

**Plans antérieurs** : les plans créés avant l'étape 10 (sans échéancier par article) gardent l'ancien suivi par plan.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/echelonnement/service.ts` (relance quotidienne), `nze-backend/src/modules/echelonnement/echeances.ts` (rappels par mois, notification des pénalités), `nze-backend/src/modules/notifications/textes.ts`, `nze-backend/tests/echelonnement.test.ts` (dates des mois décalées, assertion de type), `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/tests/echeances-relances.test.ts`, `LIVRAISON-ETAPE-12-RAPPELS-ECHEANCES.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune route nouvelle. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests relances et échelonnement | `node --test` sur `echeances-relances` et `echelonnement` | 19 réussis sur 19 |
| Tests backend | `npm test` (dans `nze-backend/`) | **406 réussis sur 406** (402 avant, 4 nouveaux) |

Les 4 nouveaux tests : rappel à trois jours, une seule fois ; alerte le jour même puis retard le lendemain ; mois soldé sans rappel ; notification de chaque pénalité.

Le test de relance existant a été adapté : les dates décalées sont désormais celles des mois, et l'assertion vérifie le type `ECHEANCE_RETARD` (la cible est le mois, et non plus le plan).

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 5. Essais à faire

1. Un plan dont la première échéance tombe dans deux jours : le client reçoit « Échéance prochaine » dans l'application et, si le push est actif, sur son téléphone.
2. Le jour de l'échéance non réglée : « Échéance aujourd'hui », puis le lendemain « Échéance non soldée ».
3. Un mois réglé avant sa date : aucune notification.

## 6. Risques et points ouverts

- **O-25 (fuseau)** : les jours sont comptés en UTC. Libreville est en UTC+1 toute l'année : un rappel peut tomber un jour décalé selon l'heure de la relance.
- **O-26 (heure du cron)** : la relance doit tourner tôt le matin, heure de Libreville. Son heure reste à vérifier dans `render.yaml`.
- **Push** : les rappels suivent le même chemin que les autres notifications. Sans identifiants Firebase (O-19), ils restent dans l'application.
- **Plans antérieurs** : ils gardent l'ancien suivi, qui n'est pas traduit.

## 7. Rapport de passation — Étape 12

```
RAPPORT DE PASSATION — Étape 12
Date : 17 novembre 2026
Objectif livré : rappels et alertes par mois (trois jours avant, jour J, retard le lendemain), notification des pénalités
Décision appliquée : D-ECH-8 (validée, à confirmer par écrit)
Points ouverts : O-25 (fuseau), O-26 (heure du cron)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : aucun nouveau ; types ECHEANCE_RAPPEL, ECHEANCE_DU_JOUR, ECHEANCE_RETARD (par mois), PENALITE_APPLIQUEE
Tests exécutés : backend typecheck 0 erreur, npm test 406/406
Ce qui n'est pas fait : écran d'échéancier dans l'application, vue commerçant (étape 13), essai Supabase réel, essai téléphone
Proposition de l'étape suivante : étape 13 — vue commerçant et échéancier côté client
```
