# Prérequis MyPVit et Firebase — ce qu'il faut fournir

Date : 19 novembre 2026. Aucune valeur secrète dans ce document. Les valeurs se saisissent dans Render (variables d'environnement) ou dans la console Firebase. Ne les collez dans aucune discussion ni aucun fichier du dépôt.

## 1. MyPVit (serveur)

**Code** : le client MyPVit, les adresses de retour, la vérification des statuts, le rattrapage des paiements en attente et le contrôle au démarrage sont déjà écrits.

**Ce que vous faites** : saisir dans Render les variables `MYPVIT_*` (liste dans `npm run verifier:prerequis`), dont `MYPVIT_BASE_URL` (adresse de l'API de test ou de production, selon votre compte MyPVit).

**Premier test** : au démarrage, les journaux du serveur affichent une ligne par opérateur :
- `contrôle au démarrage : <OPERATEUR> — clé obtenue, connexion OK` : l'opérateur répond.
- `contrôle au démarrage : <OPERATEUR> — ÉCHEC : …` : le message indique la cause (adresse, clé, réseau). Transmettez-moi ce message, sans aucune valeur de clé.

**Limite** : les échanges réels (paiement, retour, statut) ne seront vérifiés qu'avec la documentation MyPVit et un compte de test. Si vous la partagez (documentation, pas de clés), je vérifie le code point par point.

## 2. Firebase (application Android)

**Fichier à fournir** : `google-services.json`, téléchargé depuis la console Firebase pour l'application Android de paquet `com.nze.app`. Il ne contient pas de mot de passe ; il se place à la racine de `mobile-nze/`. Une fois placé, j'ajoute la référence dans `app.json` (`android.googleServicesFile`).

**Clé de service (serveur)** : dans la console Firebase, générer une clé de compte de service, puis la saisir **uniquement** dans Render, dans `FIREBASE_SERVICE_ACCOUNT_JSON`. Ce fichier est secret : il ne va ni dans le dépôt, ni dans une discussion.

**iOS** (plus tard) : `GoogleService-Info.plist` pour l'application de bundle `com.nze.app`, et la clé APNs (voir O-20).

## 3. Suivi du colis

- **Notifications de statut** (en route, arrivé, livré) : Firebase, une fois les éléments ci-dessus fournis.
- **Position du livreur en temps réel sur la carte** : ce n'est pas Firebase, c'est Supabase Realtime. Elle n'est pas encore branchée : elle demande les variables `SUPABASE_URL` et `SUPABASE_SIGNING_KEY`, à saisir dans Render.

## 4. Contrôle

Dans `backend/` : `npm run verifier:prerequis`. Il indique, pour chaque élément, s'il est présent ou manquant, sans jamais afficher de valeur.
