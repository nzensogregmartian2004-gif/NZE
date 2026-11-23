# Guide de test local — NZE

Date : 19 novembre 2026. Ce guide sert à tester l'application sur votre ordinateur, avant la production. Les identifiants de production ne sont pas utilisés : le serveur local tourne avec des valeurs factices.

## 1. Ce qui fonctionne en local

- Serveur complet, base de données Postgres locale, migrations identiques à la production.
- Inscription, connexion, catalogue, panier, commandes, stock, collectes, retraits, paiement échelonné, échéancier, relances (en lançant la tâche à la main).
- Application mobile : tous les écrans, reliés au serveur local.

## 2. Ce qui ne fonctionne pas en local (c'est attendu)

| Élément | Pourquoi | Conséquence |
|---|---|---|
| Paiements MyPVit | Pas de réseau vers MyPVit depuis un poste local, valeurs factices | Un paiement reste en attente ; il ne peut pas être confirmé réellement |
| Distances de livraison | Mode `estimation` (interdit en production) | Tarifs calculés à partir d'une estimation |
| Notifications push | Pas de clé Firebase (O-19) | Les notifications restent dans l'application |
| SMS | Non branchés | Aucun SMS |

## 3. Démarrer le serveur local

Prérequis : Node 22.9 ou plus, dépendances installées (`npm ci` dans `nze-backend/` et `nze-mobile/`).

Dans `nze-backend/` :

```
npm run demarrage:local
```

Le script démarre une base Postgres locale, applique les migrations, crée un compte administrateur de test (**+24101000001**, rôle principal) et lance le serveur sur **http://localhost:3999**. Laissez ce terminal ouvert. `GET http://localhost:3999/sante` doit répondre 200.

Les données sont conservées dans le dossier temporaire `nze-local-pg`. Pour repartir de zéro : arrêter le serveur (Ctrl+C), supprimer ce dossier, puis relancer.

## 4. Connecter l'application mobile

L'application lit l'adresse de l'API dans `EXPO_PUBLIC_API_URL`. Sur un téléphone, `localhost` désigne le téléphone lui-même : il faut l'adresse IP de l'ordinateur sur le réseau local.

Dans `nze-mobile/` :

```
EXPO_PUBLIC_API_URL=http://<adresse-ip-de-votre-ordinateur>:3999 npx expo start
```

Utilisez un build de développement (`npx expo run:android`) plutôt que l'application Expo Go : certains modules (notifications, sécurité) ne sont pas disponibles dans Expo Go.

## 5. Comptes de test

- **Administrateur** : +24101000001, rôle principal. Le compte existe sans mot de passe : définissez-le depuis l'administration, ou via la récupération de mot de passe.
- **Clients** : créez-les par l'inscription de l'application (téléphone + mot de passe).
- **Commerçants et livreurs** : créés par l'administrateur (partenaires, rôle livreur).

## 6. Parcours à tester

1. **Client** : inscription, catalogue, recherche, panier, commande (retrait ou livraison), suivi de commande.
2. **Administration** : ajouter un commerçant et un article, régler la durée et l'avance de l'article, publier, saisir les étapes de préparation (en préparation, prête).
3. **Commerçant** : historique (collectes, ventes, stock, retraits, échéances).
4. **Paiement échelonné** : activer l'échelonnement (administration), commander un article échelonné, voir les conditions, confirmer, payer l'avance (en local, la confirmation de paiement ne se fera pas réellement), voir l'échéancier.
5. **Stock faible** : faire passer un article sous 3 unités, vérifier l'alerte.
6. **Relances** : lancer `npm run job:relances` dans `nze-backend/` pour voir les rappels et retards.

## 7. Vérifications automatiques

Dans `nze-backend/` : `npm test` (412 tests) et `npm run typecheck`.
Dans `nze-mobile/` : `npm test` (38 tests) et `npx tsc --noEmit`.
Contrôle de secrets : `npm run verifier:secrets`.

## 8. Ce qu'il faudra faire avant la production

Ce guide ne remplace pas la procédure de mise en production (`docs/PROCEDURE-MISE-EN-PRODUCTION.md`) : la rotation des identifiants, Firebase, la préproduction et les validations écrites restent à faire.

## 9. Comptes de démonstration et suivi de livraison (mise à jour du 19 novembre 2026)

Au démarrage local, des données de démonstration sont créées automatiquement (une seule fois). Mot de passe commun, **valable uniquement en local** : `demo-nze-2026`.

| Rôle | Téléphone | Ce qu'il voit dans l'application |
|---|---|---|
| Administration | +24101000001 | Onglets d'administration : tableau de bord, commandes, stock, produits, entreprises, collectes, retraits, réglages |
| Commerçant | +24176000001 | Espace commerçant : stock, historique (collectes, ventes, retraits, échéances), portefeuille |
| Livreur | +24177000001 | Espace livreur : livraisons à effectuer, collectes |
| Client | +24174000001 | Catalogue, panier, commandes, suivi, échéanciers |

Il n'existe pas de tableau de bord sur le web : les tableaux de bord sont dans l'application, selon le rôle du compte.

**Tester le suivi de livraison :**
1. Administration : Réglages, activer le suivi GPS.
2. Client : passer une commande en livraison (adresse renseignée), la payer en local (la confirmation MyPVit ne se fera pas réellement en local).
3. Administration : affecter la livraison au livreur.
4. Livreur : démarrer la livraison. Son téléphone envoie alors sa position toutes les quelques secondes (autorisation de localisation demandée).
5. Client : la barre avance, et la distance restante apparaît.

Limites en local : pas de paiement réel, pas de push (Firebase), distance à vol d'oiseau (O-35).

### Connexion de l'administrateur (correctif du 19 novembre 2026)

Si l'administrateur de démonstration ne peut pas se connecter (absence de mot de passe, base créée par une version antérieure), arrêtez le serveur (Ctrl+C) et relancez `npm run demarrage:local`. Le mot de passe de démonstration est rétabli automatiquement au démarrage.

Connexion administration : téléphone **+24101000001**, mot de passe **demo-nze-2026** (local uniquement).
