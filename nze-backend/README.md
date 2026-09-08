# NZE — Backend (Phases 1 à 7 — complet)

Backend Node.js/TypeScript/Express/Drizzle/PostgreSQL/Socket.IO. Couvre l'intégralité des 7 phases du
prompt de cadrage : auth/multi-activités → magasins/produits/recherche → commandes/livraison →
prestataires/publications/avis/travaux vérifiés → véhicules/taxi/moto/location →
messagerie/notifications/GPS temps réel → abonnements/publicité/statistiques/admin avancé.

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseigner DATABASE_URL et les secrets JWT
npm run db:generate    # déjà fait une fois, à relancer après modif du schéma
npm run db:migrate     # applique les migrations sur ta base PostgreSQL
npm run dev             # démarre le serveur avec rechargement automatique
```

Le serveur écoute par défaut sur `http://localhost:4000`. `GET /health` permet de vérifier qu'il tourne.

## Ce qui est fait (Phase 1)

- **Auth** : inscription (`POST /auth/register`), vérification par OTP SMS (`POST /auth/otp/verify`,
  `POST /auth/otp/request`), connexion (`POST /auth/login`), rafraîchissement de token
  (`POST /auth/refresh`). L'envoi de SMS est un **stub** qui log le code en développement —
  à brancher sur un vrai provider (agrégateur SMS Gabon/CEMAC) avant la prod, voir `src/lib/otp.ts`.
- **Users** : `GET /users/me`, `PATCH /users/me` (avec la liste des activités du compte).
- **Multi-activités** : `GET/POST /users/me/activities`, `PATCH /users/me/activities/:id`,
  `DELETE /users/me/activities/:id` (désactivation). L'activité `client` est validée automatiquement,
  les autres (commerçant, prestataire, livreur, chauffeur, propriétaire de véhicule) démarrent en
  `en_attente` en attendant une validation admin — la validation admin arrive en Phase 2/3.
- **Sécurité** : mots de passe hachés (bcrypt), JWT access + refresh avec rotation possible,
  rate limiting sur les routes sensibles, Helmet, vérification systématique des rôles côté serveur
  via `requireActivity()` (jamais de confiance dans le frontend).

- **Magasins** : `GET /stores` (filtrable par `q`, ou par `near=lat,lng&radiusKm=...` pour la
  proximité, ne renvoie que les magasins `valide`), `GET /stores/:id`, `POST /stores` et
  `PATCH /stores/:id` (réservés à l'activité `commercant`, propriétaire vérifié côté serveur).
  Un magasin créé démarre en `en_attente` — la validation admin arrive en Phase 7 (back-office).
- **Produits** : `GET /stores/:storeId/products` (filtrable par `q`, `categorieId`, `disponible`),
  `POST /stores/:storeId/products`, `GET /products/:id`, `PATCH /products/:id`,
  `DELETE /products/:id` — toute écriture vérifie que le produit appartient bien au magasin de
  l'activité `commercant` connectée.
- **Catégories** : `GET /categories` (public), `POST /categories` (admin uniquement pour l'instant).
- **Recherche globale** : `GET /search?q=...`, résultats séparés par catégorie
  (`produits`, `magasins`, `services`, `vehicules`, `transport` — ces trois derniers vides tant que
  les Phases 4 et 5 ne sont pas faites).

### Choix de simplification en Phase 2 (à valider)

Le cadrage initial prévoyait PostGIS pour la géolocalisation. Pour la Phase 2, j'ai utilisé des
colonnes `latitude`/`longitude` simples (double precision) avec un calcul de distance par la formule
de Haversine directement en SQL (`src/lib/geo.ts`) plutôt que le type `geography(Point,4326)` de
PostGIS. C'est largement suffisant pour un volume de quelques centaines/milliers de magasins et ça
évite de dépendre d'une extension PostgreSQL spécifique dès le début. Si le volume grandit
significativement (recherche de proximité sur des dizaines de milliers de magasins/livreurs en temps
réel), on pourra migrer vers PostGIS avec un index GIST — c'est un changement isolé à `stores.ts` et
`geo.ts`, pas une refonte.

## Ce qui n'est pas encore fait (volontairement)

- Provider SMS réel pour l'OTP (`src/lib/otp.ts`)
- Passerelle de paiement mobile money réelle — `src/lib/payment.ts` est un **stub** qui marque les
  paiements "réussi" automatiquement en développement pour ne pas bloquer abonnements/publicité ;
  à remplacer par une vraie intégration (MyPVit/Airtel Money/Moov Money) avant la prod
- Upload d'images réel (URLs fournies au body pour l'instant)
- `delivery_assignments` (plusieurs intervenants sur une mission) — non implémenté, voir note Phase 3
- Note moyenne (`service_profiles.noteMoyenne`) non recalculée automatiquement
- Back-office **web** (l'admin utilise l'API REST directement pour l'instant — `apps/admin-web` dans
  l'arborescence cible du cadrage n'est pas commencé ; tout ce dont il aurait besoin niveau API existe)

## Phase 7 — Abonnements, publicité, statistiques, admin avancé

- **Formules d'abonnement** : `GET /subscription-plans` (public, formules actives),
  `POST/PATCH /subscription-plans` + `/deactivate` (admin uniquement). Prix, durée et fonctionnalités
  entièrement configurables depuis l'admin, jamais en dur (point 28 du prompt maître).
- **Abonnement d'une activité** : `POST /subscriptions` (le propriétaire de l'activité s'abonne à une
  formule — vérifie l'appartenance de l'activité), `GET /subscriptions/mine/:userActivityId`. Passe par
  `initiatePayment()` (stub, voir plus haut).
- **Publicité / mise en avant** : `POST /advertisements` (vérifie que la cible — produit, magasin,
  prestataire, véhicule — appartient bien à une activité de l'utilisateur), `en_attente` jusqu'à
  validation admin (`PATCH /admin/advertisements/:id/validate`... en fait exposé sous
  `PATCH /advertisements/:id/validate` avec contrôle admin), `GET /advertisements/active?emplacement=`
  (lecture publique, pour que le frontend affiche les éléments sponsorisés).
- **Signalements** : `POST /reports` (n'importe quel utilisateur connecté peut signaler une ressource),
  `GET /admin/reports?statut=`, `PATCH /admin/reports/:id` (admin, `traite`/`rejete`).
- **Journalisation des actions admin** (point 34, sécurité) : chaque validation/modération/annonce
  admin est maintenant enregistrée dans `admin_actions` via `logAdminAction()` — déjà branché sur
  toutes les validations existantes (magasins, livreurs, prestataires, véhicules, chauffeurs,
  publications, publicités, formules, signalements, annonces).
- **Statistiques** : `GET /admin/stats` — comptes par type d'activité, validations en attente,
  commandes/livraisons/courses totales, signalements en attente. Base simple pour un dashboard ;
  à enrichir selon ce dont tu as vraiment besoin à l'usage.

## Vue d'ensemble de ce qui existe maintenant

37 tables, toutes les phases du prompt maître NZE sont couvertes côté backend :
authentification, multi-activités, magasins/produits, recherche globale, commandes, livraisons avec
suivi GPS temps réel, prestataires avec travaux vérifiés, avis, véhicules/location, taxi/moto avec
tarification automatique, messagerie temps réel, notifications, abonnements, publicité, signalements
et journalisation admin. Les items listés comme "pas encore fait" ci-dessus sont des intégrations
externes (SMS, paiement, stockage d'images) volontairement laissées en stub pour ne pas bloquer
l'architecture — c'est la prochaine étape logique une fois que tu as choisi tes providers.

Prochaines étapes naturelles, à mon avis, mais à toi de voir : (1) brancher une vraie passerelle de
paiement et un provider SMS, (2) commencer le frontend React Native/Expo en suivant l'arborescence du
document de cadrage, en consommant cette API telle quelle.

## Phase 6 — Messagerie temps réel, notifications, GPS live

Le serveur écoute maintenant en **HTTP + WebSocket** (Socket.IO, monté dans `server.ts`).

- **Connexion socket** : le client se connecte avec `{ auth: { token: accessToken } }` (même JWT que
  l'API REST). Chaque socket rejoint automatiquement la salle `user:<userId>`.
- **Messagerie** : `POST /conversations` (réutilise une conversation directe existante entre les mêmes
  2 personnes si elle existe), `GET /conversations`, `GET/POST /conversations/:id/messages`. Chaque
  nouveau message est à la fois persisté en base ET diffusé en direct aux participants connectés
  (`socket.emit('conversation:join', conversationId)` puis écoute de l'event `message:new`) — et crée
  une notification pour les participants non connectés.
- **Notifications** : `GET /notifications`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`. Poussées en temps réel via l'event `notification:new` sur la salle
  `user:<userId>`. Déjà branchées sur : nouvelle commande (commerçant), changement de statut de
  commande (client), mission de livraison reçue (livreur), livreur arrivé/livraison terminée (client),
  course acceptée (client). Le point 33 du prompt maître liste d'autres déclencheurs
  (réservation, abonnement bientôt expiré...) — pas encore câblés, mais le pattern
  (`createNotification(userId, type, contenu, donnees?)`) est en place et se réutilise à l'identique
  partout où c'est nécessaire.
- **Annonces admin de masse** (point 15) : `POST /admin/announcements` avec une cible
  (`tous_livreurs`, `tous_magasins`, etc.) → crée une notification pour chaque utilisateur concerné.
- **GPS temps réel** : `POST /deliverers/me/location` (déjà existant en Phase 3) diffuse maintenant
  aussi la position en direct sur la salle `deliverer:<id>` — le client rejoint cette salle via
  `socket.emit('tracking:join', deliveryId)` (même vérification d'accès que
  `GET /deliveries/:id/tracking`) et écoute l'event `location:update`. Le endpoint REST de tracking
  reste disponible en solution de repli (polling).

## Phase 5 — Véhicules, taxi, moto, location

- **Véhicules** : `POST /vehicles` (activité `proprietaire_vehicule`), `GET /vehicles` (filtrable
  `type`/`disponible`), `GET /vehicles/:id`, `PATCH /vehicles/:id`, `GET /vehicles/me/mine`.
  Démarre `en_attente` jusqu'à validation admin (`PATCH /admin/vehicles/:id/validate`).
- **Location** : `POST /vehicles/:vehicleId/book` (client, dates + message),
  `GET /vehicles/:vehicleId/bookings` (propriétaire), `PATCH /vehicle-bookings/:id/accept`
  ou `/reject` (propriétaire). Pas de vérification de chevauchement de dates pour l'instant — à
  ajouter si les doubles réservations deviennent un problème réel.
- **Chauffeurs (taxi/moto)** : même schéma que les livreurs — ajouter l'activité `chauffeur`
  (Phase 1), puis `POST /drivers/register` (`typeService: taxi|moto`, véhicule optionnel) → validation
  admin (`PATCH /admin/drivers/:id/validate`) → `PATCH /drivers/me/availability`.
- **Courses** : `POST /rides` (client demande une course avec position de départ/arrivée — le prix est
  calculé **automatiquement** à la création : 2000 FCFA les 15 km, formule dans `src/config/pricing.ts`,
  distance via Haversine ; la réponse inclut `prixEstime` et `distanceKm`),
  `GET /rides/available` (chauffeur validé, filtré automatiquement sur son `typeService`),
  `PATCH /rides/:id/accept` (attribution atomique — impossible que deux chauffeurs prennent la même
  course), `PATCH /rides/:id/start`, `/complete`, `/cancel` (client, avant acceptation).

## Phase 4 — Prestataires, publications, avis, travaux vérifiés

- **Profils prestataires** : `POST /service-profiles` (activité `prestataire`), `GET /service-profiles`
  (filtrable par `metier`/`disponible`, ne renvoie que les profils `valide`), `GET /service-profiles/:id`,
  `PATCH /service-profiles/:id` (propriétaire). Les compétences sont ajoutées à la création
  (`competences: string[]`).
- **Publications de réalisations** : `POST /service-profiles/:id/posts` (propriétaire), publication
  en `en_attente` jusqu'à modération admin (`PATCH /admin/service-posts/:id/moderate`),
  `GET /service-posts/:id` (avec compteur de likes et badge `travailVerifie`),
  `POST/DELETE /service-posts/:id/like`, `POST/GET /service-posts/:id/comments`.
- **Travaux vérifiés** (point 6 du prompt maître) : `POST /verified-jobs` (le prestataire déclare
  une prestation réalisée pour un `clientActivityId` donné) → `PATCH /verified-jobs/:id/confirm`
  (seul ce client peut confirmer) ou `/reject`. Une fois confirmé, le badge **✓ Travail vérifié**
  apparaît sur `GET /service-posts/:id`.
- **Avis** : `POST /reviews` (`cibleType` + `cibleId` + note 1-5), `GET /reviews?cibleType=&cibleId=`.
  Le champ `verifie` est calculé automatiquement côté serveur : un avis magasin est vérifié s'il existe
  une commande `terminee` de ce client sur ce magasin ; un avis prestataire est vérifié s'il existe un
  `verified_job` confirmé entre ce client et ce prestataire. Les avis sur livreur/chauffeur/véhicule
  suivront la même logique une fois les Phases 3 (missions) et 5 (mobilité) plus avancées.

## Flux Phase 3 (commande → livraison) tel qu'implémenté

1. `POST /orders` (activité `client`) — commande avec items + coordonnées de livraison optionnelles.
2. Le commerçant fait progresser la commande via `PATCH /orders/:id/status` :
   `nouvelle → confirmee → produit_pret`. Dès `produit_pret`, si des coordonnées de livraison ont été
   fournies, une `delivery` est créée automatiquement (`statut: nouvelle`).
3. L'admin attribue un livreur validé et disponible : `PATCH /deliveries/:id/assign`
   (→ `livreur_attribue`). Liste des missions en attente : `GET /deliveries/pending`.
4. Le livreur fait progresser sa mission dans l'ordre imposé via `PATCH /deliveries/:id/status`
   (`acceptee → en_route_vers_magasin → arrive_au_magasin → produit_recupere →
   en_route_vers_client → arrive_chez_client → livraison_terminee`) — chaque étape est vérifiée
   côté serveur, impossible de sauter une étape. `livraison_terminee` marque aussi la commande
   liée comme `terminee`.
5. Le livreur pousse sa position via `POST /deliverers/me/location` ; le client (ou l'admin, ou le
   livreur lui-même) suit la mission via `GET /deliveries/:id/tracking`.

Inscription livreur : ajouter d'abord l'activité `livreur` (Phase 1, `POST /users/me/activities`),
puis `POST /deliverers/register` avec les infos véhicule/documents → `en_attente` jusqu'à validation
admin (`PATCH /admin/deliverers/:id/validate`).

## Structure

Voir `docs/NZE_cadrage_v1.md` (fourni précédemment) pour l'arborescence cible complète et le schéma
de base de données prévu pour les phases suivantes. Ce backend suit déjà cette structure modulaire
(`src/modules/<domaine>`), donc ajouter la Phase 2 consistera à ajouter `src/modules/stores` et
`src/modules/products` sur le même modèle que `auth`/`users`/`activities`.

## Points à valider avec toi avant la Phase 2

- Le champ `metadonnees` (jsonb) sur `user_activities` est une solution temporaire pour stocker les
  infos spécifiques à chaque activité (nom du magasin, métier, type de véhicule...) le temps que les
  tables dédiées (`stores`, `service_profiles`, `vehicles`...) soient créées en Phase 2/3. Il ne sera
  plus utilisé une fois ces tables en place.
- `token_hash` dans `refresh_tokens` stocke le refresh token en clair pour la V1 (simplicité de
  révocation) — à hacher (SHA-256) avant la mise en production si tu veux limiter l'impact d'une fuite
  de base de données.
