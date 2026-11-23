# Livraison — Étape 5 : notifications push Android

Date : 17 novembre 2026. Décision appliquée : **D-PUSH-1** (nouvelle, à valider). Point ouvert : **O-19**.

## 1. Objectif

Faire apparaître dans la barre de notification Android les notifications de l'application (suivi de commande, collecte, retrait, échéances), comme demandé.

## 2. Ce qui change

**Serveur**
- Table `appareils_push` : un jeton par appareil, rattaché à un seul compte. Un jeton déclaré par un autre compte change de propriétaire.
- Route `POST /appareils` (enregistrer) et `DELETE /appareils` (retirer). Chacun ne gère que ses propres appareils.
- Colonne `notifications.poussee_le` : marque une notification envoyée. Une notification n'est marquée qu'après un envoi réussi ; un échec la laisse à réessayer.
- Envoi : seules les notifications de moins de 24 heures sont poussées, pour qu'un stock ancien n'arrive pas en retard. Un jeton signalé comme périmé par Firebase est retiré.
- Sans `FIREBASE_SERVICE_ACCOUNT_JSON`, la tâche ne fait rien et le dit.
- Tâche `job:push-notifications`, planifiée toutes les deux minutes dans `render.yaml`.

**Application (Android)**
- `expo-notifications` 58.1.7 installé ; plugin ajouté dans `app.json`.
- Après connexion : demande de permission (une fois), puis enregistrement de l'appareil. Un refus est respecté : l'application fonctionne sans push.
- À la déconnexion, y compris session expirée : l'appareil est retiré du compte, pour que ses notifications ne suivent pas la personne suivante.
- Affichage des notifications pendant que l'application est ouverte.

Ce qui ne change pas : les notifications restent consultables dans l'application ; leurs textes sont déjà traduits selon la langue du destinataire.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/db/schema.ts`, `nze-backend/src/db/migrations/meta/_journal.json`, `nze-backend/src/app.ts`, `nze-backend/package.json`, `nze-backend/package-lock.json`, `render.yaml`, `nze-mobile/app.json`, `nze-mobile/package.json`, `nze-mobile/package-lock.json`, `nze-mobile/src/store/auth.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/src/db/migrations/0024_push_notifications.sql`, `nze-backend/src/db/migrations/meta/0024_snapshot.json`, `nze-backend/src/modules/push/service.ts`, `nze-backend/src/modules/push/firebase.ts`, `nze-backend/src/modules/push/routes.ts`, `nze-backend/src/jobs/push-notifications.ts`, `nze-backend/tests/push.test.ts`, `nze-mobile/src/lib/push.ts`, `LIVRAISON-ETAPE-5-PUSH.md`.
- **Supprimés** : aucun fichier.

Dépendances ajoutées : `firebase-admin` (backend, version 14) et `expo-notifications` (application, version 58.1.7).

## 4. Migration

**`0024_push_notifications.sql`** : crée `appareils_push` (avec contrainte de plateforme et index sur le compte), et ajoute `notifications.poussee_le` (nullable). Additive : aucune donnée modifiée. Les notifications existantes restent non poussées, mais la fenêtre de 24 heures les écarte.

**Sauvegarde** : à faire avant le déploiement (les migrations s'exécutent au démarrage sur Render).

## 5. Routes, permissions, événements

- `POST /appareils` : `{ jeton, plateforme: 'android' | 'ios' }`, réponse 204. Authentifié.
- `DELETE /appareils` : `{ jeton }`, réponse 204. Authentifié, limité aux appareils du compte.

Aucune permission nouvelle. Aucun événement de journal d'audit ajouté.

## 6. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `nze-backend/`) | **389 réussis sur 389** (383 avant, 6 nouveaux dans `push.test.ts`) |
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **30 réussis sur 30** (inchangé : le module natif n'est pas testé unitairement) |

Les 6 tests push : enregistrement sans doublon et changement de compte d'un jeton ; refus d'une plateforme ou d'un jeton invalide ; suppression limitée au propriétaire ; rien d'envoyé sans configuration ; envoi aux seuls appareils du destinataire, retrait des jetons périmés, marquage ; échec d'envoi laissant la notification à réessayer.

**L'envoi réel à Firebase n'a pas été exécuté.** Aucun identifiant n'a été fourni. Les tests utilisent un envoyeur factice.

## 7. Essais à faire (après O-19)

1. Installer l'application sur un téléphone Android, se connecter, accepter la notification : l'appareil apparaît dans la table `appareils_push`.
2. Déclencher une notification (par exemple une collecte validée) : elle apparaît dans la barre de notification dans les deux minutes.
3. Se déconnecter : l'appareil n'apparaît plus pour ce compte ; une notification ultérieure n'arrive pas.
4. Refuser la permission : l'application fonctionne, sans erreur.

## 8. Risques et points ouverts

- **O-19** : tant que le projet Firebase, la clé de service et `google-services.json` ne sont pas fournis, aucune notification push n'est envoyée. L'application ne peut pas encore être compilée avec le push.
- **Jeton qui change** : le jeton n'est enregistré qu'à la connexion. Si Android le renouvelle, l'appareil ne reçoit plus rien jusqu'à la prochaine connexion. À traiter en réenregistrant au démarrage de l'application.
- **iOS** : non couvert. Il faudra Firebase iOS (APNs).
- **Coût Render** : la tâche toutes les deux minutes est facturée à l'usage. À valider avec le fondateur.
- **Fenêtre de 24 heures** : une notification plus ancienne n'est jamais poussée. C'est volontaire, mais elle reste consultable dans l'application.
- **Volume** : la sélection des notifications non poussées n'a pas d'index dédié. À ajouter si le volume augmente.

## 9. Rapport de passation — Étape 5

```
RAPPORT DE PASSATION — Étape 5
Date : 17 novembre 2026
Objectif livré : notifications push Android, prêtes côté serveur et côté application, inactives sans identifiants Firebase
Décision appliquée : D-PUSH-1 (à valider)
Point ouvert : O-19 (identifiants Firebase, google-services.json, décision iOS)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Dépendances ajoutées : firebase-admin (backend), expo-notifications 58.1.7 (application)
Migrations : 0024_push_notifications (additive, sauvegarde avant déploiement)
Routes / permissions / événements : voir section 5
Tests exécutés : backend typecheck 0 erreur, npm test 389/389 ; mobile typecheck 0 erreur, npm test 30/30
Ce qui n'est pas fait : envoi réel à Firebase, réception sur téléphone, réenregistrement du jeton au démarrage, iOS
Risques : voir section 8
Proposition de l'étape suivante : étape 6 — réenregistrement du jeton au démarrage, puis finitions selon votre priorité
```
