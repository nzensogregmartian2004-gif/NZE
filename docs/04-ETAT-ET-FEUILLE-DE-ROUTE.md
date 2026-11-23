# 04 — État mesuré et feuille de route

Mesures prises le 13 novembre 2026 sur l'archive « NZE 10 — design unifié ».

## 1. État mesuré

| Indicateur | Valeur |
|---|---|
| Backend : typage | 0 erreur |
| Backend : tests | 223 : 208 réussis, 15 en échec (collectes 9, livraisons 2, notifications 1, suivi partenaire 2, migrations 1) |
| Backend : migrations | Chaîne active 0000 à 0014 ; chaîne B archivée |
| Backend : modules vides | entreprises, location, publicité, retours, support |
| Backend : temps réel | Absent (`realtime/` vide) |
| Mobile : typage | 13 erreurs (taxi 8 ; remboursements 5) |
| Mobile : tests | Aucun |
| Mobile : design | Un seul système (`src/theme`), converti (rapport NZE 10) |
| Secrets | Aucun `.env` dans le livrable |

Écrans mobiles encore présents des domaines exclus :

- restaurants : `restaurants/`, `dashboard/restaurant.tsx` ;
- hébergements : `lodgings.tsx`, `lodging/`, `my-lodging-bookings.tsx`, `dashboard/lodgings-owner.tsx`, `dashboard/lodging-bookings/` ;
- taxi : `ride-request.tsx`, `ride/`, `dashboard/driver.tsx`, `src/lib/driver-api.ts` ;
- réservations de véhicules et abonnements dans `dashboard/monetisation.tsx`, `admin/monetisation.tsx`, `dashboard/store.tsx`, `(tabs)/search.tsx`, `(tabs)/profile.tsx`, `help.tsx` ;
- services réservables (`services.tsx`, `service/`, `service-post/`, `service-request/`, `my-service-requests.tsx`) : à remplacer par la fiche prestataire publicitaire (D-P6).

## 2. Feuille de route

**Statut au 13 novembre 2026** : étapes A, 2, B, C, D (phase 1), F closes. Étape G préparée : liste de contrôle de mise en production (`docs/LANCEMENT.md`), scripts de sauvegarde et de restauration (`nze-backend/scripts/`), configuration de déploiement signalée (`APP_ENV` à passer à production au lancement). Historique par dossier de réclamation : endpoint et interface administrateur en place, testés. Backend 273/273 tests verts. Restent : étape E (intégrations, bloquées par les accès), location de véhicules et publicité (phase 2), décision O-12, validation juridique (O-5), relecture des traductions (O-6), tests sur téléphone et APK de preview.



Chaque étape se termine par : code, migrations si nécessaire, tests, LIRE-MOI et rapport de passation (`05-LIVRAISON.md`). **Aucune étape ne démarre sans validation du fondateur** (D-M1).

### Étape A — Stabiliser

Objectif : socle propre, sans écran exclu, typage et tests verts.

1. Backend : ramener les 15 tests en échec à zéro (collectes, livraisons, notifications, suivi partenaire, snapshot de migration).
2. Backend : désactiver le module échelonnement par configuration (D-P7). Le code reste en place, inaccessible.
3. Mobile : retirer le taxi (écrans et `driver-api.ts`).
4. Mobile : brancher les remboursements sur les réclamations et retours du backend. Supprimer les écrans sans route.
5. Mobile : retirer les écrans restaurants, hébergements, abonnements et réservations de véhicules sur les pages où ils restent. Garder la location journalière.
6. Mobile : remplacer les écrans services par la fiche prestataire publicitaire (D-P6).
7. Mobile : typage à zéro.
8. Ajouter les premiers tests mobiles sur le parcours client.
9. Confirmer par écrit le retrait de l'OTP de livraison (O-9).
10. Réécrire les README de `nze-backend/` et `nze-mobile/` à partir de ce dossier `docs/`.

**Critère de sortie** : `npm test` backend vert ; `tsc` mobile à zéro ; un seul zip complet et LIRE-MOI.

### Étape B — Socle entreprises, stock et écritures

Dépend de A.

1. Module `entreprises` (lot 1.2) : dossier, établissements, accord commercial versionné, cycle de vie prospect à clôturé (D-F1, §5 de `02-PRODUIT.md`).
2. Stock (lot 1.4) : mouvements historisés, états, source de l'information.
3. Trois registres séparés (cahier V3.0 §15.1) : écritures client, commissions et part partenaire, avances et règlements.
4. Retrait partenaire (D-A2) : demande du commerçant, réservation du montant, approbation par un administrateur autorisé (O-1), transfert, confirmation réelle.
5. Permissions par module et par action (O-2).

**Critère de sortie** : tests du cycle de vie, des écritures et du retrait verts.

### Étape C — Parcours client (priorité décidée)

Dépend de B.

1. Accueil : rangées de produits par catégorie.
2. Recherche textuelle et filtres essentiels ; catégories ; listes d'envies et « achetés à nouveau » (D-P16).
3. Panier : ajout progressif, choix livraison ou paiement sur place (D-P15).
4. Paiement Mobile Money : choix d'Airtel Money ou Moov Money, saisie du numéro, validation (D-F4). Carte Visa et Mastercard ensuite, dans l'étape E.
5. Commande, suivi, remise avec signature (D-O1, D-O2).
6. Messagerie liée à l'article, menu de suppression, paramètres (D-P13).
7. Onglet « Mon profil » (D-P14).
8. Réclamation et demande de remboursement annoncée sous 72 heures (D-F8).

**Critère de sortie** : parcours client complet testé sur téléphone (APK de preview).

### Étape D — Espace partenaire et administration

Dépend de C.

1. Espace partenaire, phase 1 : signalement de stock (D-P10).
2. Espace partenaire complet : produits, stock, bordereaux, règlements, retraits, messages (phase 2).
3. Administration : tableau de bord et navigation activité, catégorie, entreprise, établissement (D-P11 : après le parcours client).

### Étape E — Intégrations réelles

Peut démarrer en parallèle de C une fois les clés reçues (O-4).

1. Supabase Realtime : messagerie, suivi de commande, position livreur (D-A1). Supprimer le code Socket.IO côté mobile.
2. MyPVit : environnement de test, format et signature du callback, essais de paiement (Mobile Money et carte), statut, échec, versement. Confirmer la révocation de la clé de production (O-3).
3. Cloudflare R2 : photos, preuves, messagerie.
4. Firebase : notifications push.
5. eSMS : renouvellement de mot de passe, clé de test puis production.

**Règle** : aucun paiement, versement ou statut réel simulé en production.

### Étape F — Quatre langues

Peut démarrer en parallèle de C. Les écrans livrés doivent être traduits au fur et à mesure.

1. Traductions fr, en, ar (affichage de droite à gauche), zh-Hans.
2. Détection de la langue du téléphone au premier lancement, choix manuel, préférence mémorisée (D-L1).
3. Notifications serveur traduites selon la langue du destinataire.
4. Aide, tutoriel, préférences de notifications traduits ; validation par des traducteurs (O-6).

### Étape G — Mise en production

1. Validation juridique (O-5).
2. APK de preview puis production (`eas build`).
3. Tests sur appareil de tous les parcours.
4. Sauvegarde de la base avant mise en production, avec restauration testée.

### Étape H — Phase 2

Après la mise en production du parcours client.

- Location journalière (D-P3, D-P12).
- Prestataires : fiche publicitaire administrée par NZE (D-P6).
- Publicité payante et promotions : carrousel de l'accueil, prix de référence traçable.
- Avis, notes, partage, signalement.
- Support complet (O-7) et rapports de gestion.

### Phase 4 — Améliorations

Recherche par photo, recommandations avancées, optimisation des tournées, rapprochements automatisés.

## 3. Dépendances

```
A ──► B ──► C ──► D
            │      
E (clés) ───┘ (parallèle)
F ──────────── (parallèle, à tenir à jour avec C)
C ──► G ──► H
```

## 4. Points bloquants

Voir `01-DECISIONS.md`, section I : O-1 à O-9.

## Mise à jour — P0 financier

- Backend : 278 tests sur 278 réussis, typage 0 erreur.
- Étape B, point 4 (retrait partenaire) : demande du commerçant, réservation du montant à la demande, approbation par l'administrateur principal : **en place**. Solde retirable limité aux collectes validées : **en place**.
- Reste de l'étape B : registres séparés (cahier §15.1), mécanisme de remise pour les ventes en retrait, callbacks MyPVit à vérifier.

## Mise à jour — étape A (15 novembre 2026), état vérifié

Chaque ligne a été contrôlée dans le code, pas recopiée d'un ancien document.

| Point | État | Preuve |
|---|---|---|
| A.1 Tests backend verts | Fait | 289 sur 289 |
| A.2 Échelonnement désactivé | Fait, par réglage en base : défaut `INACTIF`, création de plan refusée, activation réservée à l'administrateur principal. Le code reste en place. | `echelonnementActif`, `PUT /admin/reglages/echelonnement` |
| A.3 Taxi retiré | Fait | Aucun fichier taxi, chauffeur ou course |
| A.4 Remboursements | Fait, par retrait et non par branchement : aucun écran, aucune route. La règle de remplacement (article défectueux) est appliquée. | Recherche de `rembours` sans résultat côté écrans et routes |
| A.5 Restaurants, hébergements, abonnements, réservations de véhicules | Fait : aucun fichier correspondant. La location journalière n'est pas réalisée (exclue par le cahier V3.0 §3.2). | Recherche de fichiers sans résultat |
| A.6 Fiche prestataire publicitaire (D-P6) | **À faire** : seul le type d'activité existait, il est désormais limité aux rôles client, commerçant et livreur. | — |
| A.7 Typage à zéro | Fait : backend et mobile | `tsc --noEmit` |
| A.8 Tests mobiles sur le parcours client | **Partiel** : 18 tests unitaires (libellés, traductions, rôles). Aucun test de parcours. | `npm test` mobile |
| A.9 Confirmation écrite du retrait de l'OTP (O-9) | **À faire par le fondateur**. Le code OTP de livraison est retiré. | — |
| A.10 Réécriture des README | Fait : `nze-backend/README.md` et `nze-mobile/README.md` reflètent le code. | — |

Points de conformité corrigés dans ce lot : conditions juridiques (plus de restaurants, d'hébergeurs, de loueurs ni de rôle prestataire), type d'activité mobile limité aux trois rôles du cahier.

Étape B, déjà en place : registres séparés (colonne `registre`), retrait partenaire avec réservation, callbacks MyPVit vérifiés. **Reste à décider** : le mécanisme de remise pour les ventes en retrait.

Étape G, déjà en place : `OTP_PROVIDER=console` refusé en production, proxy de confiance obligatoire en production (`TRUST_PROXY`), variables légales contrôlées au démarrage. **Reste** : passer `APP_ENV` à `production` et saisir les clés dans Render (actions du fondateur).

**Reste à faire, dans l'ordre :** les points restants de l'audit du 16 novembre 2026 (voir la section ci-dessous), les tests sur téléphone réel, puis les intégrations qui dépendent d'accès externes (Supabase Realtime, Cloudflare R2, Firebase, eSMS). La fiche prestataire, la pagination du catalogue et les tests du parcours d'achat côté backend sont faits (voir la mise à jour du 15 novembre).

## Mise à jour — pagination du catalogue et recherche (15 novembre 2026)

- **Pagination** : l'API `GET /produits` accepte `limite` (1 à 100, 24 par défaut) et `decalage`. Plus de limite globale à 100 : les articles au-delà sont atteignables par pages. Tri stable (identifiant en dernier critère).
- **Accueil mobile** : liste paginée à défilement infini (24 par page), rangées par catégorie limitées à 10 articles, section « Tous les produits » qui rend visibles les articles sans catégorie (ils n'apparaissaient dans aucune rangée).
- **Recherche** : elle existe comme champ de saisie sur l'accueil (paramètre `q`, correspondance sur le nom, insensible à la casse). Il n'y a pas d'écran de recherche dédié. Limites connues : pas de recherche sans accents, taper `%` renvoie tout le catalogue.
- **Tests** : backend, 297 sur 297 (5 pagination, 3 recherche, 289 existants) ; mobile, 21 sur 21 (3 pagination, 18 existants) ; typage backend et mobile à zéro erreur.
- **Reste dans le chantier** : fiche prestataire (A.6), tests de parcours client de bout en bout (A.8), actions du fondateur (O-9, `APP_ENV`, clés MyPVit de production).

## Mise à jour — fiche prestataire, parcours d'achat (15 novembre 2026)

- **A.6 Fiche prestataire (D-P6) : faite.** Table `fiches_prestataires` et `demandes_prestataire` (migration 0018, snapshot 0018). API publique `GET /prestataires` et `GET /prestataires/:id` (fiches publiées seulement, sans donnée interne). Demande du client `POST /prestataires/:id/demandes` : une seule demande en cours par client et par fiche. Administration (permission `publicite.gerer`) : création et publication des fiches, liste et traitement des demandes avec note interne, journalisé. Écrans mobiles : liste, fiche avec demande, administration (onglet « Prestataires »). Aucune réservation, aucun compte prestataire, aucun contact direct du prestataire.
- **A.8 Parcours client : parcours d'achat testé de bout en bout côté backend** (recherche, panier, paiement Mobile Money simulé, affectation, remise avec signature, cas d'un autre client). Le test sur téléphone réel reste à faire.
- **Recherche** : présente (champ de l'accueil, paramètre `q`, correspondance sur le nom), testée. Limites connues : pas de recherche insensible aux accents, un `%` renvoie tout le catalogue.
- **Mesures** : backend 313 sur 313 ; mobile 24 sur 24 ; typage backend et mobile à zéro erreur.
- **Dette relevée** : `drizzle-kit generate` ne fonctionne plus, car les snapshots 0015 à 0017 n'ont pas de chaîne d'identifiants. La migration 0018 et son snapshot ont été écrits à la main, et le test de schéma les vérifie. À corriger avant la prochaine migration générée automatiquement.
- **Reste** : actions du fondateur (O-9, `APP_ENV`, clés MyPVit de production, O-3), intégrations en attente d'accès (Supabase Realtime, Cloudflare R2, Firebase, eSMS), photos des fiches (à brancher sur R2), tests sur téléphone réel et APK de preview.

## Mise à jour — corrections issues de l'audit (16 novembre 2026)

- **Pagination de toutes les listes** : chaque liste accepte `limite` (200 au maximum) et `decalage`. Plus aucune liste ne tronque en silence. Les listes concernées : commandes et produits de l'administration, bordereaux, retraits (administration et partenaire), livraisons (administration, livreur, partenaire, paginée par livraison et non par ligne), litiges, réclamations, commandes du client, historique de stock, plans d'échelonnement, écritures des registres, ventes du partenaire (nouvelle route `GET /partenaire/ventes`), journal d'audit, notifications.
- **Défauts de fond corrigés** : les messages d'une conversation étaient triés du plus ancien ; les 200 premiers seulement étaient visibles. La première page contient désormais les messages les plus récents, les plus anciens se chargent à la demande. Le filtre « en retard » des échelonnements était appliqué après la limite ; il l'est désormais avant. La synthèse de l'échelonnement portait sur 300 plans au plus ; elle lit maintenant l'ensemble.
- **Écrans mobiles branchés** : mes commandes, mes réclamations, retraits et portefeuille partenaire (retraits et ventes), mouvements de stock, collectes livreur, livraisons livreur, collectes, réclamations, commandes, retraits, produits, stock et registres administrateur, notifications, fil de messages. Un bouton « Charger plus » apparaît tant qu'une page suivante existe.
- **Récupération du mot de passe (point 2 de l'audit)** : le code SMS reste le chemin normal. Un mode assisté, sans SMS, est prêt mais **désactivé par défaut** (`RECUPERATION_ASSISTEE=false`). Quand il est activé, le client est orienté vers NZE ; l'administrateur principal génère un code à usage unique, valable 5 minutes, après vérification de l'identité. Décision à prendre par le fondateur (voir D-T5).
- **Mesures** : backend 325 réussis sur 325 ; mobile 26 réussis sur 26 ; typage backend et mobile à zéro erreur.

### Restant de l'audit, non traité dans cette livraison
- Onglets : traduits dans les quatre langues (administration et livreur). Les écrans eux-mêmes restent à relire (O-6).
- Supabase Realtime, Cloudflare R2 et Firebase : aucun code ; en attente d'accès.
- Tests d'écran sur téléphone : aucun test automatisé d'écran ; à faire sur APK de preview.
- Tableaux de bord : ils chargent toute la table en mémoire (exact, mais coûteux à grande échelle) ; à remplacer par des agrégats en base.
- Relecture des traductions des nouveaux écrans (O-6).
- `drizzle-kit generate` : chaîne de snapshots 0015 à 0017 à réparer.

## Mise à jour — suite de l'audit (16 novembre 2026)

- **Tableaux de bord en agrégats** : les tableaux livreur, administrateur et partenaire comptent en base (`count … filter`, `group by`). Plus aucune table n'est chargée en mémoire pour les compter. Un test (`livraisons.test.ts`) recalcule chaque chiffre à partir des listes brutes et compare : il passe.
- **Chaîne de snapshots drizzle réparée** : les identifiants des snapshots 0015 à 0018 forment une chaîne ; le snapshot 0018 est celui du schéma actuel. `drizzle-kit generate` répond « No schema changes » sur le dépôt. Les snapshots 0015 à 0017 restent les anciens fichiers, seulement chaînés.
- **Export Android vérifié** : `expo export --platform android` produit un paquet complet, sans import non résolu.
- **Mesures** : backend 326 réussis sur 326 ; mobile 26 réussis sur 26 ; typage backend et mobile à zéro erreur.

### Restant
- Intégrations sans accès : Supabase Realtime, Cloudflare R2, Firebase, eSMS (O-4).
- Tests d'écran sur téléphone : aucun test automatisé d'écran.
- Relecture humaine des traductions (O-6).
- Décision du fondateur sur la récupération assistée (D-T5).
- Synthèse des échelonnements : elle parcourt tous les plans en mémoire, lot par lot, car le retard se calcule en code. Correct, à remplacer si le volume grandit.

## Mise à jour — stockage des photos sur Cloudflare R2 (16 novembre 2026)

- **Fait côté serveur** : envoi d'une photo de fiche prestataire par l'administration (`POST /admin/prestataires/:id/photo`, JPEG, PNG ou WebP, 3 Mo maximum). Le contenu est vérifié sur ses octets réels, pas sur le type annoncé. La clé de stockage est générée par le serveur. La photo précédente est supprimée. Le client ne voit qu'un lien signé d'une heure, jamais la clé.
- **Migration** : `0019_fiche_photo` ajoute la colonne `photo_cle` à `fiches_prestataires`. Snapshot à jour.
- **Configuration** : variables `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, et facultative `R2_ENDPOINT`. Toutes les obligatoires, ou aucune. Si elles sont absentes, l'envoi répond 503 `STOCKAGE_NON_CONFIGURE`.
- **À faire dans Render** : saisir ces quatre variables avec les valeurs du seau `nze` et du jeton R2 de lecture et écriture limité à ce seau. Révoquer le premier jeton, dont les identifiants ont été écrits dans la discussion.
- **Pas encore fait** : l'envoi depuis l'application mobile (il faut un module de sélection de photos, donc une nouvelle version native). Pour l'instant l'envoi passe par l'API.
- **Mesures** : backend 339 réussis sur 339 (13 nouveaux : configuration R2, sécurité des images, clés, liens signés, parcours de la photo).
- **Lien signé** : il contient le chemin de l'objet ; c'est inhérent aux liens signés. Le client ne reçoit aucun champ `photoCle`.

## Mise à jour — temps réel Supabase, partie serveur (16 novembre 2026)

- **Fait** : module de jetons Realtime (`src/modules/realtime/`), route `GET /realtime/jeton` pour l'utilisateur connecté (503 tant que la clé n'est pas configurée). Signature ES256 vérifiée par des tests, claims contrôlés, clé mal formée refusée au démarrage.
- **Configuration Render** : `SUPABASE_URL` (non secrète) et `SUPABASE_SIGNING_KEY` (secrète, JSON de la clé). Les deux ensemble, ou aucune.
- **Pas encore fait** : autorisations `realtime.messages` (à appliquer à la main dans l'éditeur SQL de Supabase), publication des nouveaux messages via `realtime.send` (canaux privés), branchement mobile avec `@supabase/supabase-js`, suivi de commande et position du livreur. L'actualisation périodique reste en place comme secours.
- **Mesures** : backend 347 réussis sur 347.

## Mise à jour — lot 1 de l'audit P0 : finance (17 novembre 2026)

Défauts confirmés par des tests qui échouaient avant correction, puis corrigés :

- **Litige ouvert sans réclamation liée** : il ne bloquait aucun montant, donc un partenaire pouvait retirer pendant un litige. Désormais, un tel litige bloque tout le solde retirable du partenaire jusqu'à sa clôture.
- **Écriture comptable incohérente pendant un paiement réussi** : la transaction était annulée, avec le statut « réussi », donc le client était débité sans trace et la commande restait en attente. Désormais, la répartition est vérifiée avant toute écriture ; si elle est incohérente, le paiement reçu reste enregistré, la commande n'est pas marquée payée, et une alerte `PAIEMENT_ECRITURE_ECHEC` est journalisée.

Tests ajoutés : double callback (une seule répartition), versement incertain (montant réservé, pas de second versement), litige sans réclamation, écriture incohérente. Mesures : backend 351 réussis sur 351 ; typage backend et mobile à zéro erreur.

Non traité dans ce lot : affichage du frais MyPVit avant paiement et son enregistrement (D-AUD-2, à valider en sandbox, lot 4) ; Cron d'échelonnement (D-AUD-4).

Configuration à faire dans Render : `MYPVIT_WEBHOOK_ALLOWED_IPS` = `176.31.65.18,176.31.65.20,176.31.65.21,13.59.249.167`. Après saisie, les callbacks venant d'une autre adresse sont refusés (403) : surveiller les journaux `callback_ip_refusee` au premier déploiement.

## Mise à jour — lot 1 (suite) et lot 2 de l'audit P0 (17 novembre 2026)

- **Lot 1** : test de répartition d'une commande payée avec livraison (`repartition-vente.test.ts`) : le registre client reproduit le total payé, partenaire + commissions + frais de livraison égalent le total, les frais de livraison sont séparés.
- **Lot 2, migrations** : journal et fichiers SQL concordent (20 migrations, idx consécutifs, tags uniques). `drizzle-kit generate` répond « No schema changes ». Toutes les migrations sont rejouées sur une base vide à chaque exécution de la suite. Aucune migration ne supprime de table, ne vide de table, ni ne supprime de lignes. Les suppressions de contraintes sont recréées aussitôt.
- **Point à valider avant déploiement** : la migration `0013_suppression_otp_livraison` supprime les colonnes `code_livraison` et `tentatives_code` de la table `livraisons`. C'est la suppression de l'OTP de livraison, à confirmer par écrit par le fondateur (action O-9). Les migrations s'exécutant au démarrage de Render, une sauvegarde de la base Supabase doit être faite avant le premier déploiement qui les applique.
- **Mesures** : backend 352 réussis sur 352 ; typage backend 0 erreur.
- **Pas encore fait** : le lot 2 demande aussi de retirer `db:migrate` du démarrage automatique au profit d'une étape explicite. C'est une décision de déploiement, à prendre avec le fondateur.

## Mise à jour — lot 3 de l'audit P0 : configuration de production (17 novembre 2026)

- **Liste d'IP des callbacks MyPVit obligatoire en production** : sans elle, le démarrage est refusé. Chaque adresse doit être une IPv4 valide, dans tous les environnements. Tests ajoutés (`config-production-lot3.test.ts`).
- **Doublon `TRUST_PROXY`** supprimé du Blueprint (lot 1).
- **Vérifié dans le code** : refus de démarrage en production si la configuration est incomplète (base, secret de session, proxy, mentions légales, MyPVit, clé Google si cartographie Google) ; OTP console refusé ; healthcheck `/sante` présent ; aucun CORS requis (application mobile).
- **Détails de la liste de lancement** : `docs/LANCEMENT.md` est mis à jour point par point. Chaque case est soit cochée (vérifiée), soit annotée avec la raison et l'action restante.
- **Restent au fondateur** : bascule `APP_ENV` au lancement, saisie des variables dans Render (dont `MYPVIT_WEBHOOK_ALLOWED_IPS`), eSMS (bloquant), validation juridique, restauration de sauvegarde testée sur une base vide (`pg_dump` absent de l'environnement de contrôle).
- **Mesures** : backend 366 réussis sur 366 ; typage backend 0 erreur.

## Mise à jour — lot 4 de l'audit P0 : banc d'essai MyPVit (17 novembre 2026)

- **Non exécuté dans l'environnement de contrôle** : aucune joignabilité de MyPVit (erreur réseau vérifiée), et aucune documentation officielle de MyPVit disponible en ligne. Aucun appel au fournisseur n'a été fait.
- **Fait** : banc d'essai `scripts/sandbox-mypvit.ts` (commande `npm run sandbox:mypvit`) avec garde-fous testés (production refusée, adresse explicite en https, confirmation obligatoire). Il écrit un rapport sans aucun identifiant. Procédure et dossier de preuves : `docs/SANDBOX-MYPVIT.md`.
- **Frais MyPVit (D-AUD-2)** : toujours bloqué. Le client ne voit pas encore le frais avant paiement, et le montant envoyé n'est pas modifié. Les questions à poser à MyPVit sont dans `docs/SANDBOX-MYPVIT.md`.
- **Couverture de tests vérifiée** : mauvais montant (statut incertain), versement incertain, double callback. **Sans test** : rattrapage et timeout.
- **Mesures** : backend 366 réussis sur 366 ; typage backend 0 erreur.
- **Reste bloquant avant encaissement réel** : réponses de MyPVit, dossier de preuves Airtel et Moov, autorisation écrite du fondateur.

## Mise à jour — frais MyPVit : question posée, sources identifiées (17 novembre 2026)

- **Question** : les frais s'ajoutent-ils au montant (le client paie plus) ? Toujours ouverte : aucune documentation officielle de MyPVit n'est accessible en ligne, et aucun essai sandbox n'a été fait.
- **Indice dans le code** : `getFees` renvoie `fees` et `totalAmount`, ce qui suggère que `totalAmount` est le montant débité au client. Non confirmé.
- **Sources pour trancher** : l'application de référence déjà en production (questions consignées dans `docs/paiements/MYPVIT-INTEGRATION.md`, section 7) et l'essai sandbox, dont le rapport classe la relation (FRAIS_EN_PLUS, FRAIS_INCLUS ou INDETERMINE).
- **Ajouté** : classement de la relation dans le banc d'essai, testé (7 tests de garde et de classement).
- **Mesures** : backend 366 réussis sur 366 ; typage backend 0 erreur.

## Mise à jour — frais de service et frais MyPVit (17 novembre 2026)

- **Rémunération de NZE** : la commission négociée avec chaque partenaire, définie par entreprise dans l'administration (`POST /admin/commissions`), versionnée et sans valeur par défaut. Une commande est refusée si la commission de son partenaire n'est pas définie. Le client voit le total articles et livraison (panier et paiement), jamais la commission.
- **Frais de service payés par le client** : ni le cahier des charges ni le code ne les prévoient. À décider par le fondateur (montant, à qui ils s'appliquent, écriture comptable). Non implémentés.
- **Frais MyPVit** : NZE ne les affiche pas ; le client les voit sur l'invite de l'opérateur (décision D-AUD-6). Le mécanisme (ajoutés au montant ou déduits) reste à confirmer avant tout encaissement réel (D-AUD-2).

## Mise à jour — frais de service NZE (17 novembre 2026)

- **Distinction retenue** : la commission est la part de NZE négociée avec le partenaire ; les frais de service sont une somme que le client paie en plus, pour chaque transaction MyPVit.
- **État** : non implémenté. Il faut d'abord le montant et sa nature (fixe ou pourcentage).
- **Travail prévu, une fois le montant connu** : migration (colonne sur les commandes, nouvelle catégorie comptable), réglage modifiable par l'administration (valeur 0 tant qu'elle n'est pas fixée), affichage au panier et au paiement, répartition avec une ligne dédiée, et tests (commandes existantes non modifiées par un changement de réglage).

## Mise à jour — étape 1 : réservation du stock au paiement (17 novembre 2026)

- **Fait** : réservation dans la transaction de chaque paiement (en ligne et avance échelonnée), vente à la confirmation, libération à l'échec et à l'annulation d'un plan. Quantité vendable = disponible − réservé, dans la fiche et le filtre « en stock ». Ni les ajustements ni les signalements du partenaire ne peuvent faire passer le disponible sous le réservé. Migration 0020.
- **Corrige** : deux clients pouvaient payer le même dernier article ; l'écart n'était que tracé.
- **Mesures** : backend typage 0 erreur ; backend 372 réussis sur 372 ; mobile inchangé (dernier résultat : 26 sur 26).
- **Restent** : O-13 (expiration des réservations), O-14 (avance pendant l'annulation d'un plan), alerte de stock faible pour l'administration, décision sur les paiements lancés avant déploiement. Détail dans `LIVRAISON-ETAPE-1-RESERVATION-STOCK.md`.

## Mise à jour — étape 2 : espace partenaire et lien collecte → stock (17 novembre 2026)

- **Fait** : une collecte validée fait entrer ses articles en stock, une seule fois, avec un mouvement tracé au bordereau. Un article en anomalie entre en stock à la levée de son blocage (ou à la validation si le blocage était déjà levé). Une collecte validée ne peut plus être annulée. Les historiques partenaire (collectes, ventes, stock en stock/rupture, retraits) sont réunis dans un onglet « Historique ». Migration 0021.
- **Corrige** : la validation d'une collecte ne mettait pas le stock à jour.
- **Mesures** : backend typage 0 erreur, 376 réussis sur 376 ; mobile typage 0 erreur, 30 réussis sur 30 (dont la parité des quatre langues).
- **Restent** : O-15 (doublon Portefeuille / Historique), O-16 (stock initial et collecte), collectes validées avant déploiement à réconcilier (voir `LIVRAISON-ETAPE-2-HISTORIQUE-PARTENAIRE.md`), notifications push (étape 5).

## Mise à jour — étape 3 : réglages de l'échelonnement (17 novembre 2026)

- **Fait** : acompte et durée maximale réglables par l'administrateur principal (bornes 10–90 % et 1–12 mois), stockés dans la table des réglages. Les plans créés après le changement suivent le réglage ; les plans existants ne changent pas. Un article neuf n'est pas échelonnable par défaut. Migration 0022 (défaut de colonne uniquement).
- **Corrige** : l'acompte de 40 % et la durée de 3 mois étaient codés en dur dans le code.
- **Mesures** : backend typage 0 erreur, 380 réussis sur 380 ; mobile inchangé (dernier résultat : 30 sur 30).
- **Restent** : O-17 (revue des articles existants avant activation), activation de l'échelonnement toujours désactivée par défaut (drapeau `echelonnement_actif`), et les points juridiques et de trésorerie hors périmètre de l'assistant.

## Mise à jour — étape 4 : retrait partenaire par carte (17 novembre 2026)

- **Fait** : le retrait par carte est dans le modèle de données (opérateur `CARTE`, numéro facultatif pour la carte seulement) et dans la validation de la demande. Il est désactivé en code tant que MyPVit n'a pas confirmé ses versements vers carte. NZE ne stocke aucune donnée de carte. Migration 0023.
- **Mesures** : backend typage 0 erreur, 383 réussis sur 383 ; mobile inchangé (dernier résultat : 30 sur 30).
- **Restent** : O-18 (confirmation MyPVit et mode de saisie des données carte), branchement du versement carte une fois confirmé, affichage de l'option carte dans l'application mobile (volontairement absent tant que le retrait est désactivé).

## Mise à jour — étape 5 : notifications push Android (17 novembre 2026)

- **Fait** : table des appareils, enregistrement et retrait à la connexion et à la déconnexion, marquage des notifications poussées, envoi Firebase qui ne s'active que si la clé de service est fournie, tâche planifiée toutes les deux minutes (cron Render), et tests avec un envoyeur factice. Migration 0024.
- **Mesures** : backend typage 0 erreur, 389 réussis sur 389 ; mobile typage 0 erreur, 30 réussis sur 30 ; `expo-notifications` 58.1.7 installé.
- **Non vérifié** : l'envoi réel à Firebase (aucun identifiant fourni) et la réception sur un téléphone.
- **Restent** : O-19 (identifiants Firebase et google-services.json), réenregistrement du jeton au démarrage de l'application (un jeton peut changer), iOS, coût du cron Render à valider.

## Mise à jour — étape 6 : renouvellement du jeton push (17 novembre 2026)

- **Fait** : réenregistrement au démarrage d'une session ouverte (sans demande de permission), et réenregistrement immédiat quand Android renouvelle le jeton pendant que l'application est ouverte. La surveillance est coupée à la déconnexion. Aucun changement serveur.
- **Mesures** : mobile typage 0 erreur, 30 réussis sur 30 ; backend inchangé (389 réussis sur 389, étape 5).
- **Non vérifié** : le renouvellement réel d'un jeton sur un téléphone (il faut une installation Android et O-19).
- **Restent** : O-19 (identifiants Firebase, google-services.json), iOS, coût du cron Render à valider.

## Mise à jour — étape 7 : iOS (17 novembre 2026)

- **Constat** : sur iOS, le jeton natif fourni par `expo-notifications` est un jeton Apple (APNs). FCM ne l'accepte pas comme jeton d'envoi : il faut le jeton FCM obtenu par le SDK Firebase iOS, avec une clé APNs enregistrée dans Firebase.
- **Décision** : aucun code iOS écrit. L'application n'enregistre aucun jeton iOS (`jetonCourant` renvoie `null` hors Android), ce qui évite de stocker des jetons qui échouent. Le serveur accepte encore la plateforme `ios` ; aucun client ne l'envoie.
- **En attente** : décision D-PUSH-3 (voie A, B ou C) et éléments de O-20.
- **Mesures** : aucun changement de code ; backend 389/389 et application 30/30 (étapes 5 et 6).

## Mise à jour — étape 7 : iOS, voie A (17 novembre 2026)

- **Fait** : SDK natif Firebase messaging installé (27.1.1) ; chemin iOS écrit dans `nze-mobile/src/lib/push.ts` (jeton FCM, permission, réenregistrement, retrait à la déconnexion, surveillance du renouvellement), désactivé par `PUSH_IOS_ACTIF = false`. Aucun changement serveur (FCM envoie déjà vers iOS).
- **Mesures** : mobile typage 0 erreur, 30 réussis sur 30 ; backend inchangé (389/389).
- **Non vérifié** : le build natif, la réception sur iPhone. Un avertissement npm `EBADENGINE` apparaît à l'installation ; à vérifier au premier build.
- **En attente** : O-20 (GoogleService-Info.plist, clé APNs, Key ID, Team ID, confirmation du bundle `com.nze.app`) et les étapes d'activation de `LIVRAISON-ETAPE-7-IOS.md`.

## Mise à jour — étape 8 : alerte de stock faible (17 novembre 2026)

- **Fait** : alerte « stock faible » au franchissement du seuil de 3 (quantité vendable), envoyée aux administrateurs et aux partenaires du produit, une seule fois par franchissement. Déclenchée par réservation, ajustement, signalement ou vente sans réservation ; jamais par libération. Textes traduits dans les quatre langues. Aucune migration.
- **Corrige** : l'alerte demandée par le cahier (§9) n'existait pas côté administration.
- **Mesures** : backend typage 0 erreur, 392 réussis sur 392 ; mobile inchangé (30/30).
- **Restent** : O-21 (seuil par produit, destinataires), relecture des traductions arabe et chinois (O-6), essai sur téléphone après O-19.

## Mise à jour — étape 9 : suivi de commande côté client (17 novembre 2026)

- **Fait** : étapes « en préparation » et « prête » saisies par l'administration (`POST /admin/commandes/:id/etape`), avec notifications au client ; suivi calculé (confirmée, en préparation, prête, en livraison, livrée) renvoyé dans le détail de commande ; affichage dans l'application. Migration 0025.
- **Mesures** : backend typage 0 erreur, 395 réussis sur 395 ; mobile typage 0 erreur, 32 réussis sur 32.
- **Restent** : O-22 (saisie par le commerçant ; traduction des notifications de livraison), essai sur téléphone après O-19, durée d'échelonnement par article (à confirmer avec le fondateur).

## Mise à jour — étape 10 : échéancier par article (17 novembre 2026)

- **Fait** : durée et avance par article (administration), échéancier calculé et stocké par article, conditions renvoyées avant confirmation (`GET /commandes/:id/echelonnement/conditions`), pénalité mensuelle réglable (10 000 FCFA par défaut). Migration 0026.
- **Mesures** : backend typage 0 erreur, 398 réussis sur 398 ; mobile inchangé.
- **Restent** : écran de conditions dans l'application (aucun écran d'échelonnement n'existe encore côté client), versements partiels et affectation au mois (étape 11), application des pénalités et surplus (étape 11), rappels (étape 12), vue commerçant (étape 13).

## Mise à jour — étape 11 : versements, validation mensuelle, pénalités (17 novembre 2026)

- **Fait** : versement visant un article, affecté aux mois puis aux pénalités ; mois validé, partiel ou en retard ; recalcul du reste (option a) ; pénalité mensuelle après le dernier mois tant qu'un solde reste dû, appliquée par la relance quotidienne ; pénalités hors part commerçant ; plan soldé seulement une fois les pénalités payées. Route `GET /echelonnements/:id/echeanciers`. Migration 0027.
- **Mesures** : backend typage 0 erreur, 402 réussis sur 402 ; mobile inchangé.
- **Restent** : O-24 (présentation du reste d'un mois partiel), écran d'échéancier et de conditions dans l'application, rappels et alertes par échéance (étape 12), vue commerçant (étape 13), et l'ancien calcul de situation du plan, approximatif pour un panier aux durées différentes.

## Mise à jour — étape 12 : rappels et alertes par mois (17 novembre 2026)

- **Fait** : rappels par mois (trois jours avant, jour J, retard le lendemain si non soldé), une fois par mois et par type ; notification de chaque pénalité ajoutée ; textes traduits dans les quatre langues ; push et application, jamais SMS. Les plans antérieurs à l'étape 10 gardent l'ancien suivi.
- **Mesures** : backend typage 0 erreur, 406 réussis sur 406 ; mobile inchangé.
- **Restent** : O-25 (fuseau horaire des rappels), O-26 (heure du cron), écran d'échéancier dans l'application, vue commerçant (étape 13).

## Mise à jour — étape 13 : vue commerçant et échéancier client (17 novembre 2026)

- **Fait** : vue commerçant par article en lecture seule (`GET /partenaire/echeanciers`), sans identité de client ni pénalité ; identifiant du plan dans le détail de commande ; écran d'échéancier client en lecture seule (mois par mois, pénalités) ; section « Échéances » dans l'historique du commerçant.
- **Mesures** : backend typage 0 erreur, 409 réussis sur 409 ; mobile typage 0 erreur, 34 réussis sur 34.
- **Restent** : O-27 (deux vues commerçant), O-28 (paiement d'une échéance depuis l'application, non construit), essai sur base Supabase réelle, essai sur téléphone.

## Mise à jour — étape 14 : paiement d'une échéance depuis l'application (17 novembre 2026)

- **Fait** : écran de paiement d'une échéance (choix de l'article, montant entier entre 1 et le reste à payer, Airtel Money, Moov Money ou carte), suivi jusqu'à confirmation puis actualisation de l'échéancier ; lien « Payer une échéance » depuis l'écran d'échéancier. Logique de montant et de reste testée.
- **Mesures** : mobile typage 0 erreur, 38 réussis sur 38 ; backend inchangé (409 sur 409, versements déjà couverts par l'étape 11).
- **Restent** : O-29 (retour de la page carte, à vérifier sur téléphone), O-30 (cohérence des numéros avec l'écran de commande), essai sur base Supabase réelle et sur téléphone.

## Mise à jour — étape 15 : finitions (17 novembre 2026)

- **Corrigé** : la vue commerçant de l'étape 13 affichait le montant brut payé par le client ; elle affiche désormais la part réelle du commerçant (après commission), via une vue unique.
- **Fait** : O-27 (une seule vue commerçant, `/partenaire/echelonnements`, `/partenaire/echeanciers` retirée) ; O-24 (client : reste à payer du mois, avec le total du mois).
- **Mesures** : backend typage 0 erreur, 409 réussis sur 409 ; mobile typage 0 erreur, 38 réussis sur 38.
- **Restent** : O-31 (alertes par plan à remplacer par le calcul par article), essai sur base Supabase réelle et sur téléphone, validation écrite de D-ECH-11.

## Mise à jour — étape 16 : alertes par article et parcours de bout en bout (17 novembre 2026)

- **Fait** : alertes du commerçant et du client calculées article par article (échéance en cours, retard) ; test de parcours complet (avance, versement, retard détecté par la relance, rattrapage, clôture), sur la base de test embarquée.
- **Mesures** : backend typage 0 erreur, 411 réussis sur 411 ; mobile inchangé (38 sur 38).
- **Restent** : O-32 (parcours sur la base Supabase de préproduction, à faire par l'équipe), O-33 (filtre « en retard » de l'administration), validation écrite de D-ECH-11 et D-ECH-12.

## Mise à jour — étape 17 : liste d'administration et procédure de mise en production (17 novembre 2026)

- **Fait** : filtre « en retard » de la liste d'administration calculé par article (O-33 clos) ; procédure de mise en production (`docs/PROCEDURE-MISE-EN-PRODUCTION.md`) : points bloquants, variables (noms seulement), sauvegarde, migrations, déploiement, tâches planifiées, état par défaut, vérifications, retour arrière.
- **Mesures** : backend typage 0 erreur, 412 réussis sur 412 ; mobile inchangé (38 sur 38).
- **Restent** : O-32 (préproduction), révocation des identifiants compromis, O-19 (Firebase), validations écrites des décisions, O-18 (carte), O-29 (retour carte sur téléphone).
- **Statut** : **non prêt pour la production** tant que les points bloquants de la procédure ne sont pas fermés.

## Mise à jour — étape 18 : rotation des identifiants (17 novembre 2026)

- **Fait** : procédure de rotation dans l'ordre (`docs/ROTATION-IDENTIFIANTS.md`) ; contrôle de secrets dans le dépôt (`npm run verifier:secrets`), vérifié sur un motif factice puis retiré ; aucun secret trouvé dans le dépôt.
- **Mesures** : backend typage 0 erreur, 412 réussis sur 412 (inchangé) ; contrôle de secrets : 0 emplacement.
- **Restent à faire par le fondateur** : les actions 1 à 6 de `docs/ROTATION-IDENTIFIANTS.md` (révocation R2, clé MyPVit, éventuelles autres expositions) ; O-19 (Firebase) ; préproduction (O-32).
- **Statut** : toujours non prêt pour la production, jusqu'à confirmation des actions de rotation.

## Mise à jour — étape 19 : test local de l'application (19 novembre 2026)

- **Fait** : démarrage local complet (`npm run demarrage:local` : Postgres local persistant, migrations, compte administrateur de test, serveur réel) ; vérification du serveur en marche (santé 200, inscription 201, connexion 200, catalogue 200) ; bundle Android de l'application compilé sans erreur ; guide de test (`docs/GUIDE-TEST-LOCAL.md`).
- **Mesures** : backend 412 sur 412 ; application 38 sur 38 ; bundle Android compilé.
- **Restent** : le test manuel sur téléphone (vous), la rotation des identifiants (vous, à votre rythme), Firebase (O-19), préproduction (O-32).

## Mise à jour — étape 20 : suivi de livraison et données de démonstration (19 novembre 2026)

- **Fait** : barre d'avancement de livraison côté client (interrogation toutes les 20 secondes), distance restante quand le suivi GPS est activé et que le livreur transmet sa position ; données de démonstration au démarrage local (quatre comptes, un commerçant, des articles, réglages de livraison) ; test du suivi côté serveur.
- **Mesures** : backend typage 0 erreur, 413 réussis sur 413 ; application typage 0 erreur, 40 réussis sur 40 ; serveur réel : quatre comptes de démonstration connectés (200), catalogue (200).
- **Restent** : essai sur téléphone (suivi, positions du livreur), O-34 (information et accord du livreur), O-35 (distance routière en production), Firebase (O-19), rotation des identifiants (à votre rythme), préproduction (O-32).

## Correctif — connexion de l'administrateur de démonstration (19 novembre 2026)

- **Constat** : le compte administrateur de démonstration pouvait exister sans mot de passe (base créée par une version antérieure du démarrage local).
- **Correction** : le démarrage vérifie et complète le mot de passe de l'administrateur de démonstration (uniquement lorsqu'il est absent). Reproduit et vérifié : mot de passe retiré, redémarrage, connexion 200.
- **Mesures** : typage backend 0 erreur ; le jeu de démonstration n'est pas dans la suite de tests.
