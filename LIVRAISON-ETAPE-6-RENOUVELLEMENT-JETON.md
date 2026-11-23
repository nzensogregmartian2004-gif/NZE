# Livraison — Étape 6 : renouvellement du jeton push

Date : 17 novembre 2026. Décision appliquée : **D-PUSH-2** (nouvelle, à valider). Complète D-PUSH-1 ; point ouvert toujours **O-19**.

## 1. Objectif

Éviter qu'un jeton renouvelé par Android coupe les notifications jusqu'à la prochaine connexion.

## 2. Ce qui change

**Application (Android)**
- Au démarrage, si une session est restaurée, l'appareil est réenregistré. Aucune demande de permission n'est faite à ce moment : seule la connexion la demande.
- Pendant que l'application est ouverte, un écouteur réenregistre le jeton dès qu'Android le renouvelle.
- L'écouteur est arrêté à la déconnexion et à l'expiration de la session, avant le retrait de l'appareil.

**Serveur** : aucun changement. `POST /appareils` met déjà à jour l'appareil quand le jeton change.

## 3. Fichiers

- **Modifiés** : `nze-mobile/src/lib/push.ts`, `nze-mobile/src/store/auth.ts`, `docs/01-DECISIONS.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `LIVRAISON-ETAPE-6-RENOUVELLEMENT-JETON.md`.
- **Supprimés** : aucun fichier.

Pas de migration, pas de dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **30 réussis sur 30** |
| Backend | (non modifié) | 389 réussis sur 389 (étape 5) |

Les modules natifs (jeton Android, écouteur de renouvellement) ne sont pas testés unitairement : leur vérification demande une installation Android.

Non fait ici : essai sur téléphone, renouvellement réel d'un jeton.

## 5. Essais à faire (après O-19)

1. Ouvrir l'application avec une session existante : l'appareil est réenregistré (vérifier la date de mise à jour dans `appareils_push`), sans question de permission.
2. Forcer un renouvellement du jeton (réinstallation de l'application ou effacement des données) : le nouveau jeton remplace l'ancien pour le même compte.
3. Se déconnecter puis se reconnecter : aucune notification n'arrive pendant la déconnexion.

## 6. Risques et points ouverts

- **Jeton renouvelé hors application ouverte** : il n'est réenregistré qu'au démarrage suivant. Une notification envoyée entre-temps à l'ancien jeton est perdue ; il n'y a pas de rattrapage.
- **Ancien jeton** : il reste en base jusqu'à ce que Firebase le signale comme périmé, ce qui est retiré à l'envoi suivant.
- **O-19** : tant que les identifiants Firebase ne sont pas fournis, rien n'est envoyé.

## 7. Rapport de passation — Étape 6

```
RAPPORT DE PASSATION — Étape 6
Date : 17 novembre 2026
Objectif livré : réenregistrement du jeton au démarrage et à son renouvellement
Décision appliquée : D-PUSH-2 (à valider)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Tests exécutés : mobile typecheck 0 erreur, npm test 30/30 ; backend inchangé 389/389
Ce qui n'est pas fait : essai téléphone, renouvellement réel du jeton, envoi Firebase (O-19)
Risques : voir section 6
Proposition de l'étape suivante : étape 7 — iOS (Firebase iOS et APNs), ou selon votre priorité
```
