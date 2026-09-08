# NZE — Mobile (Expo)

Frontend React Native / Expo. Design system + navigation complète + parcours d'authentification
de bout en bout, connectés au backend.

## Démarrage

```bash
npm install
npx expo start
```

Scanne le QR code avec l'app Expo Go, ou lance un simulateur (`npm run ios` / `npm run android`).
Renseigne l'URL de ton backend dans `app.json` → `expo.extra.apiUrl` (par défaut
`http://localhost:4000` — sur un vrai téléphone, remplace par l'IP de ta machine sur le réseau local).

## Ce qui est fait

### Assets & design system
Voir la session précédente : icônes/splash/favicon générés depuis le logo officiel, palette de
couleurs extraite du logo, typographie Sora + Plus Jakarta Sans, composants de base (`Text`,
`Button`, `Card`, `Badge`, `Screen`, `Logo`, `Input`).

### Navigation
- **`app/_layout.tsx`** — charge les polices ET hydrate la session (lit le token depuis
  `expo-secure-store`) avant d'afficher quoi que ce soit.
- **`app/index.tsx`** — redirige vers `(tabs)` si connecté, vers `(auth)/register` sinon.
- **`(auth)/`** — pile d'authentification : inscription → OTP → choix des activités.
- **`(tabs)/`** — 4 onglets (Accueil, Rechercher, Messages, Profil), protégés : redirige vers le
  login si pas de session. Produits/Services/Mobilité/Livraison restent des écrans poussés depuis
  l'accueil (voir le choix de navigation expliqué dans la session précédente), pas des onglets.

### Authentification (point 41 du prompt maître, de bout en bout)
- **Inscription** (`(auth)/register.tsx`) → appelle `POST /auth/register` → redirige vers l'OTP.
- **Vérification OTP** (`(auth)/otp-verify.tsx`) → `POST /auth/otp/verify`, stocke les tokens, bouton
  "Renvoyer le code" (`POST /auth/otp/request`).
- **Connexion** (`(auth)/login.tsx`) → `POST /auth/login` ; si le compte existe mais le téléphone
  n'est pas encore vérifié (403), redirige automatiquement vers l'OTP plutôt que d'afficher une
  erreur sèche.
- **Choix des activités** (`(auth)/choose-activities.tsx`) → sélection multiple (le prompt maître
  permet plusieurs activités par compte), crée chaque activité via `POST /users/me/activities`.
- **Session** (`src/store/auth.ts`, zustand) : tokens persistés dans `expo-secure-store`, hydratation
  automatique au démarrage, refresh silencieux du token d'accès sur un 401 (`src/lib/api.ts`).

### Écrans
- **Accueil** — déjà fait précédemment (univers + magasins proches).
- **Recherche** (`(tabs)/search.tsx`) — connectée à `GET /search`, résultats groupés par catégorie.
- **Messages** (`(tabs)/messages.tsx`) — connecté à `GET /conversations`, état vide géré.
- **Profil** (`(tabs)/profile.tsx`) — infos du compte, liste des activités avec badge de statut
  (active/en attente/refusée/suspendue), bouton pour en ajouter une nouvelle, déconnexion.
- **Produits/Services/Mobilité/Livraison** — écrans de transition (`PlaceholderScreen`) en attendant
  d'être construits en détail ; la navigation entre eux fonctionne déjà.

## Pas encore fait (volontairement)

- Suivi de commande/livraison en temps réel côté app (le backend est prêt : `GET /deliveries/:id/tracking`
  + WebSocket ; pas encore d'écran mobile pour ça)
- Panier multi-produits — la commande actuelle se fait produit par produit (1 clic = 1 commande d'un
  article), pas de panier persistant entre plusieurs magasins
- Écran de conversation (liste des messages + envoi) — la liste des conversations existe, pas le
  détail d'une conversation
- Connexion WebSocket (Socket.IO) pour les messages/notifications en temps réel — pour l'instant tout
  passe par l'API REST (polling au focus de l'écran)
- Dashboards professionnels (commerçant, prestataire, livreur, chauffeur, propriétaire de véhicule)
- Formulaires spécifiques par activité à la création (le prompt maître demande des champs différents
  selon l'activité choisie — pour l'instant `choose-activities` crée les activités sans ces champs
  spécifiques)
- Services et Mobilité restent des écrans de transition (`PlaceholderScreen`)

## Prochaine étape suggérée

L'univers **Produits** est maintenant construit de bout en bout : liste des magasins proches
(vraie géolocalisation via `expo-location`, point 11 du prompt maître), recherche par nom, fiche
magasin avec ses produits, fiche produit avec commande directe (`POST /orders`, position de
livraison envoyée automatiquement si la géolocalisation est active).

Prochaine étape logique : soit le suivi de commande/livraison (statuts en temps réel, le backend
est déjà prêt côté Phase 3/6), soit un autre univers (Services ou Mobilité) en suivant exactement
le même schéma (API déjà prête côté backend, composants déjà prêts côté design system).

## Builder un APK (EAS Build)

```bash
npm install -g eas-cli
eas login                          # compte Expo (gratuit)
eas build:configure                # une seule fois, relie le projet à ton compte
eas build -p android --profile preview
```

Le profil `preview` (dans `eas.json`) génère un `.apk` installable directement sur ton téléphone
(lien de téléchargement fourni à la fin du build), sans passer par le Play Store — idéal pour tes
tests. Pense à mettre à jour `expo.extra.apiUrl` dans `app.json` avec l'URL de ton backend hébergé
avant de lancer le build, sinon l'app cherchera `localhost`.

## Nouveau dans cet incrément

- **Suivi de commande/livraison** : `app/orders.tsx` (liste, accessible depuis Profil → "Mes
  commandes") et `app/order/[id].tsx` (détail + statut de livraison, rafraîchi automatiquement
  toutes les 5s par polling — sera remplacé par l'écoute Socket.IO temps réel dans un prochain
  incrément). Nécessite le nouvel endpoint backend `GET /deliveries/by-order/:orderId/tracking`.
- **`eas.json`** ajouté pour les builds APK (voir ci-dessus).

## Nouveau : univers Services (+ messagerie fonctionnelle)

- **Liste des prestataires** (`app/services.tsx`) — recherche par métier, connectée à
  `GET /service-profiles`. Pas de tri par distance : les profils prestataires n'ont pas de
  coordonnées GPS en base (contrairement aux magasins), seulement une zone d'intervention en texte
  libre — cohérent avec le backend actuel.
- **Fiche prestataire** (`app/service/[id].tsx`) — compétences, tarif indicatif, réalisations
  publiées, bouton **Contacter** qui crée une conversation réelle avec le prestataire.
- **Détail d'une réalisation** (`app/service-post/[id].tsx`) — like/unlike, badge **✓ Travail
  vérifié** (point 6 du prompt maître) quand une prestation confirmée existe.
- **Écran de conversation** (`app/conversation/[id].tsx`) — jusqu'ici manquant, maintenant
  fonctionnel : liste des messages + envoi, rafraîchi par polling (Socket.IO prévu dans un prochain
  incrément). Accessible depuis Messages et depuis "Contacter" sur une fiche prestataire.
- Petit ajout backend : `GET /service-profiles/:id` renvoie maintenant `userId` (nécessaire pour
  démarrer une conversation avec le prestataire).

## Nouveau : univers Mobilité (taxi/moto + location de véhicules)

- **Hub Mobilité** (`app/mobility.tsx`) — deux entrées : Taxi/Moto et Location.
- **Demande de course** (`app/ride-request.tsx`) — position de départ automatique (géolocalisation),
  destination saisie en texte et convertie en coordonnées via `Location.geocodeAsync` (géocodage
  natif du téléphone, aucune dépendance/clé API supplémentaire). Le prix est calculé automatiquement
  par le backend (2000 FCFA/15km) et affiché juste après la demande.
- **Suivi de course** (`app/ride/[id].tsx`) — statut rafraîchi toutes les 5s par polling sur
  `GET /rides/me` (pas de `GET /rides/:id` côté backend, donc on filtre la liste), bouton Annuler
  tant que la course n'est pas prise en charge.
- **Liste des véhicules** (`app/vehicles.tsx`) et **fiche véhicule** (`app/vehicle/[id].tsx`) avec
  formulaire de réservation (dates + message) → `POST /vehicles/:id/book`.

Limite connue : le géocodage par adresse texte dépend de la qualité des données cartographiques
locales (peut être imprécis dans certaines zones peu cartographiées du Gabon) — une sélection sur
carte serait plus fiable mais demande d'ajouter `react-native-maps`, pas fait pour l'instant.

## Nouveau : les 5 dashboards professionnels

Accessibles depuis Profil en tapant sur l'activité concernée (magasin/services/livreur/chauffeur/
véhicules) — chacun affiche un formulaire de création si l'activité n'a pas encore de profil/magasin/
véhicule, sinon l'interface de gestion.

- **`app/dashboard/store.tsx`** — créer son magasin, ajouter des produits, faire progresser les
  commandes (confirmer → produit prêt → terminée).
- **`app/dashboard/service.tsx`** — créer son profil prestataire, basculer disponible/indisponible,
  publier des réalisations.
- **`app/dashboard/deliverer.tsx`** — inscription (type de véhicule), disponibilité, missions avec
  progression étape par étape (dans l'ordre imposé par le backend), **partage de position en direct**
  (toutes les 15s tant que l'écran est ouvert et le partage activé).
- **`app/dashboard/driver.tsx`** — inscription (taxi/moto), disponibilité, liste des courses
  disponibles, accepter → démarrer → terminer.
- **`app/dashboard/vehicles-owner.tsx`** + **`app/dashboard/vehicle-bookings/[vehicleId].tsx`** —
  ajouter des véhicules, gérer les demandes de réservation par véhicule (accepter/refuser).

Backend : 3 petits ajouts nécessaires — `GET /stores/mine`, `GET /service-profiles/mine`,
`GET /deliveries/mine` (aucune de ces routes "mes ressources" n'existait avant).

### Simplifications volontaires

- Dashboard magasin : gère un seul magasin (le premier trouvé) même si le backend autorise
  plusieurs magasins par activité commerçante — à étendre si tu en as vraiment besoin.
- Dashboard chauffeur : pas de persistance de "ma course active" côté backend (pas de
  `GET /rides/mine` pour chauffeur) — la course acceptée reste affichée tant que l'écran du
  dashboard n'est pas fermé, mais disparaît si tu quittes l'écran avant de la terminer. Un futur
  `GET /rides/mine-as-driver` réglerait ça proprement.

## Nouveau : temps réel (Socket.IO)

- **`src/lib/socket.ts`** — connexion ouverte automatiquement dès qu'une session existe (root
  layout), fermée à la déconnexion.
- **Messagerie** (`app/conversation/[id].tsx`) — les messages arrivent en direct (event
  `message:new`), plus un filet de sécurité par polling toutes les 15s si le socket tombe.
- **Suivi de commande/livraison** (`app/order/[id].tsx`) — la position du livreur se met à jour en
  direct (event `location:update`), et un changement de statut (livreur arrivé, livraison
  terminée...) déclenche un rafraîchissement immédiat via l'event `notification:new`. Poll de
  secours réduit à 20s (au lieu de 5s) puisque le direct fait l'essentiel du travail.
- Petit ajustement backend : `tracking:leave` acceptait uniquement un `delivererId`, incohérent avec
  `tracking:join` qui prend un `deliveryId` — les deux acceptent maintenant l'un ou l'autre.

Pas encore branché en temps réel : le suivi de course taxi/moto (`app/ride/[id].tsx`) reste en
polling — le backend n'a pas de salle de diffusion de position pour les chauffeurs (uniquement pour
les livreurs). À ajouter côté backend si tu veux ce même niveau de direct pour les courses.

## Nouveau : back-office admin (dans l'app mobile)

Choix : plutôt qu'une app web séparée (`apps/admin-web` du cadrage initial), j'ai mis
l'administration directement dans l'app mobile, réservée aux comptes `isAdmin`. Plus rapide à
livrer avec l'existant, et un admin peut valider un magasin depuis son téléphone. Une vraie interface
web reste une option si tu la préfères plus tard (tableaux, filtres avancés y sont plus confortables).

- **`app/admin/index.tsx`** — statistiques (utilisateurs par rôle, activité, validations en attente).
- **`app/admin/validations.tsx`** — écran générique pour valider/refuser magasins, livreurs,
  chauffeurs, prestataires, véhicules (`?type=stores|deliverers|drivers|service-profiles|vehicles`).
- **`app/admin/reports.tsx`** — traiter les signalements.
- **`app/admin/announcement.tsx`** — annonces de masse par groupe (point 15 du prompt maître).
- Accessible depuis Profil → "🛠️ Administration" (visible uniquement si `isAdmin`).

### Pour tester : rendre un compte admin

Il n'existe volontairement aucune route API pour se promouvoir admin (faille de sécurité sinon).
Pour tester, passe directement par la base de données :

```sql
UPDATE users SET is_admin = true WHERE telephone = 'TON_NUMERO';
```

Reconnecte-toi ensuite dans l'app (ou tire vers le bas sur Profil si un rafraîchissement est
disponible) pour que `isAdmin` soit repris dans la session.

Petit ajout backend nécessaire : `GET /users/me` n'exposait pas `isAdmin`, corrigé.
