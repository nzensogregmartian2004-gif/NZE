# Étape 7 — iOS : décision nécessaire avant le code

Date : 17 novembre 2026. Décision en attente : **D-PUSH-3**. Éléments à fournir : **O-20**.

## 1. Pourquoi aucun code iOS n'est livré

Pour Android, le jeton natif est un jeton Firebase (FCM) : il est envoyé tel quel. Pour iOS, le jeton natif est un jeton Apple (APNs). Firebase ne l'accepte pas comme destinataire d'un envoi. Il faut obtenir le jeton FCM via le SDK Firebase iOS, qui le relie au jeton APNs, et Firebase doit avoir une clé APNs.

Écrire le code tel quel enregistrerait des jetons qui seraient rejetés, et les notifications n'arriveraient jamais, sans erreur visible. C'est pourquoi l'application n'enregistre aucun jeton iOS.

Ce qui reste inchangé : `jetonCourant` renvoie `null` hors Android ; le serveur accepte la plateforme `ios` mais aucun client ne l'envoie.

## 2. Les trois voies

**A — Firebase iOS (cohérent avec D-T3)**
- Ajouter le SDK natif Firebase (`@react-native-firebase/app` et `messaging`) pour obtenir le jeton FCM sur iOS.
- Déposer la clé APNs (.p8) dans la console Firebase, et fournir `GoogleService-Info.plist`.
- Un build natif est nécessaire (EAS), car ce SDK n'est pas utilisable dans Expo Go.
- Le serveur ne change pas : FCM envoie vers iOS comme vers Android.
- Inconvénient : deux bibliothèques de notifications dans l'application (`expo-notifications` pour Android, SDK natif pour iOS), ou une migration complète vers le SDK natif.

**B — Service de notifications d'Expo**
- Plus simple côté iOS : Expo gère les identifiants Apple.
- Mais les envois iOS passeraient par Expo, et non par Firebase : cela modifie D-T3 et ajoute un second chemin d'envoi côté serveur.

**C — iOS reporté**
- Android d'abord, iOS plus tard. Aucun coût supplémentaire aujourd'hui.

## 3. Ce qu'il faut fournir pour la voie A

- Compte Apple Developer de l'entreprise.
- Clé APNs (.p8), identifiant de la clé (Key ID) et identifiant de l'équipe (Team ID).
- Identifiant du bundle iOS (par exemple `com.nze.app`, à confirmer).
- Fichier `GoogleService-Info.plist`, téléchargé depuis l'application iOS du projet Firebase.

## 4. Essais prévus pour la voie choisie

1. Installer un build natif sur un iPhone physique (le simulateur ne reçoit pas les notifications push).
2. Accepter la permission, vérifier qu'un jeton FCM apparaît dans `appareils_push` avec la plateforme `ios`.
3. Envoyer une notification de test depuis la console Firebase, en premier plan, en arrière-plan et application fermée.
4. Déclencher une notification réelle (par exemple une collecte validée).

## 5. Rapport de passation — Étape 7

```
RAPPORT DE PASSATION — Étape 7
Date : 17 novembre 2026
Objectif : notifications push iOS
Résultat : aucune modification de code. Décision nécessaire (D-PUSH-3) et éléments à fournir (O-20).
Raison : le jeton natif iOS n'est pas un jeton FCM ; un code direct enregistrerait des jetons inutilisables.
Tests exécutés : aucun nouveau (backend 389/389 et application 30/30 inchangés)
Ce qui n'est pas fait : tout le côté iOS
Proposition : choisir A, B ou C ; si A ou B, fournir les éléments de O-20
```

## Mise à jour : voie A retenue — code préparé, activation en attente

**Choix** : voie A (Firebase iOS, SDK natif), cohérente avec D-T3.

**Fait**
- `@react-native-firebase/app` et `@react-native-firebase/messaging` ajoutés (version 27.1.1), `package-lock.json` mis à jour.
- `nze-mobile/src/lib/push.ts` : chemin iOS écrit (jeton FCM, permission, enregistrement, réenregistrement au démarrage et au renouvellement, retrait à la déconnexion). Il reste inactif tant que `PUSH_IOS_ACTIF = false`.
- Aucun changement serveur, aucun plugin ajouté à `app.json` (le build échouerait sans les fichiers de configuration).

**Vérifications** : mobile typage 0 erreur, 30 tests réussis sur 30 ; backend inchangé (389/389).

**Non vérifié** : le build natif, la réception sur iPhone. Un avertissement `EBADENGINE` apparaît à l'installation de npm : à vérifier au premier build.

**Activation — dans cet ordre, une fois O-20 fourni**
1. Déposer `GoogleService-Info.plist` à la racine de `nze-mobile/`, et ajouter `"googleServicesFile": "./GoogleService-Info.plist"` dans le bloc `ios` de `app.json`.
2. Ajouter les plugins `@react-native-firebase/app` et `@react-native-firebase/messaging` dans `app.json`, en suivant la documentation de la version 27 pour Expo 58 (à vérifier au moment de l'ajout).
3. Dans la console Firebase, Paramètres du projet, Cloud Messaging : téléverser la clé APNs (.p8), avec son Key ID et le Team ID.
4. Passer `PUSH_IOS_ACTIF` à `true`, puis créer un build de développement EAS (Expo Go ne suffit pas pour le SDK natif).
5. Tester sur un iPhone physique : permission, jeton FCM dans `appareils_push` avec la plateforme `ios`, envoi depuis la console Firebase (premier plan, arrière-plan, application fermée), puis une notification réelle.

**Rappel** : Android reste bloqué par O-19 (projet Firebase, clé de service serveur, `google-services.json`).

**Rapport de passation — mise à jour**
```
Voie retenue : A (Firebase iOS, SDK natif)
Fichiers : nze-mobile/src/lib/push.ts (chemin iOS), nze-mobile/package.json et package-lock.json (deux paquets Firebase)
Activation : PUSH_IOS_ACTIF = false ; dépend de O-20
Tests : mobile typage 0 erreur, 30/30 ; backend 389/389 inchangé
Non fait : build natif, réception sur iPhone, plugins et fichiers de configuration
```
