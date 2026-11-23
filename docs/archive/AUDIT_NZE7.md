> **OBSOLÈTE — archive.** Ce document n'est plus une référence. Utiliser `docs/LIRE-EN-PREMIER.md` et les documents 01 à 05. Conservé uniquement pour l'historique.

# Audit de l'état actuel — NZE (dossier « NZE__7_ » + documents « docs.zip »)

Date : 3 novembre 2026. Base examinée : `1793664575200_NZE__7_.zip` (backend + mobile-nze), documents `1793664679757_docs.zip`.

Méthode : installation réelle des dépendances (`npm ci`), typecheck, suite de tests, compilation Android (`expo export`), contrôle des tables réellement créées par les migrations, comparaison avec le cahier des charges V3.1 et les décisions de novembre 2026. Les chiffres ci-dessous sont mesurés, pas déclarés.

---

## 1. Verdict

Le dossier contient une base utile (authentification, panier et commandes, stock, collectes, livraisons, écritures, réclamations, journal d'audit, relances quotidiennes, traductions) **mais il n'est pas stable et il dépasse le périmètre du cahier**. Il ne peut pas servir de base telle quel :

- le backend ne compile pas (140 erreurs de typage) et 15 tests sur 217 échouent ;
- l'application mobile ne compile pas proprement (294 erreurs de typage) ;
- il contient plusieurs domaines que le cahier interdit explicitement (§3.2), avec leurs tables et écrans ;
- il existe deux générations parallèles de code et de données (commandes/orders, livraisons/deliveries, produits/products, entreprises/stores, écrans en double).

Ce dossier peut servir de base **à condition de faire d'abord un nettoyage et une stabilisation** (étapes 1 à 3 ci-dessous). Continuer à ajouter des fonctions avant cela augmenterait la dette.

---

## 2. Chiffres mesurés

| Élément | Résultat |
|---|---|
| Backend : fichiers TypeScript | 351 (hors node_modules) |
| Backend : dépendances déclarées | 4 (drizzle-orm, express, pg, zod) |
| Backend : architecture | 22 `*.controller.ts`, 52 `routes.ts`, 16 `service.ts` : **deux styles coexistent** |
| Backend : migrations | 26 fichiers, de 0000 à 0025 |
| Backend : tables créées (après DROP éventuels) | 83 |
| Backend : typecheck | **140 erreurs** (77 surcharges Express TS2769, 37 TS2345, 9 modules introuvables) |
| Backend : tests | 217 au total, **202 réussis, 15 échoués** |
| Mobile : écrans (`app/`) | **116** |
| Mobile : typecheck | **294 erreurs** (176 exports manquants depuis `@/theme`, 102 paramètres sans type) |
| Mobile : compilation Android (`expo export`) | Réussie (Metro ne vérifie pas les types : les erreurs seront des plantages à l'exécution) |
| Mobile : tests | Script `npm test` = placeholder, aucun test mobile |
| Traductions (dictionnaire principal) | 392 clés identiques en fr, en, ar, zh-Hans : **aucune manquante** |
| Traductions (aide / tutoriel / préférences notifications, `step15.ts`) | **fr et en seulement** |

---

## 3. Blocages à traiter avant toute nouvelle fonctionnalité

### B1. Périmètre exclu par le cahier (§3.2) présent dans le code

Le cahier dit : « Aucun écran, catégorie, table métier, champ, formulaire, endpoint ou parcours relatif aux restaurants, hébergements, immobilier, vente de véhicules, location mensuelle, taxi et transport de personnes, ou prestations de services autonomes ne doit être réintroduit. »

Présents dans le dossier :

- **Hébergement** : tables `lodgings`, `lodging_bookings`, `lodging_photos` ; écrans `lodging/[id]`, `lodgings`, `my-lodging-bookings`, `dashboard/lodgings-owner`, `dashboard/lodging-bookings/[lodgingId]`.
- **Restauration** : tables `restaurant_profiles`, `restaurant_menu_sections`, `restaurant_dish_details` ; écrans `restaurants/index`, `restaurants/[storeId]`, `dashboard/restaurant`.
- **Prestations de services et petits boulots** : tables `service_profiles`, `service_posts`, `service_post_comments`, `service_post_likes`, `service_post_photos`, `service_skills`, `service_requests`, `verified_jobs` ; écrans `services`, `service/[id]`, `service-post/[id]`, `service-request/[serviceProfileId]`, `my-service-requests`, `dashboard/service`.
- **Taxi** : écrans `ride/[id]`, `ride-request`, `mobility`, `dashboard/driver` (pas de table `rides` dans les migrations, mais le module et les écrans existent).
- **Abonnements et monétisation** (hors cahier) : tables `subscription_plans`, `subscriptions` ; écrans `dashboard/monetisation`, `admin/monetisation`.
- **Support** : la catégorie `reservation` et la catégorie `prestation` de `support_requests` sont des catégories exclues.

Total mesuré : **16 tables** clairement exclues, **25 écrans** mobiles, **29 fichiers** qui importent des modules exclus (il faudra refactorer les composants communs, par exemple les cartes de boutique).

Le cahier interdit aussi de supprimer l'historique (§19.3). Il faut donc **désactiver et archiver** ces domaines (routes retirées, écrans retirés, tables conservées en lecture seule via une migration), et ne pas les effacer.

Les **locations journalières de véhicules** (annexe A) sont autorisées : les tables `vehicles`, `vehicle_photos`, `vehicle_bookings` et les écrans correspondants sont à conserver, **après vérification** qu'aucune location mensuelle ni vente de véhicule n'y est gérée.

### B2. Erreurs de typage et dépendances manquantes

- Backend : 140 erreurs. Les plus nombreuses (77) viennent des contrôleurs non typés (`restaurants`, `rides`, `service-posts`, `products`, `lodgings`, `deliverers`). Ces modules sont en grande partie ceux du périmètre exclu : leur suppression réduit le problème.
- Modules importés mais **non déclarés** dans `package.json` : `jsonwebtoken`, `bcryptjs`, `esms-sms`, `express-rate-limit`. Le code qui les utilise (`src/lib/jwt.ts`, `src/lib/otp.ts`, `src/lib/password.ts`, `src/middleware/rateLimit.ts`) ne démarrera pas tel quel. Décision : utiliser les implémentations déjà éprouvées dans `core/` (scrypt, sessions, limitation par base) et supprimer ces fichiers en doublon.
- Mobile : 176 imports depuis `@/theme` de `spacing`, `radius`, `colors`, `typography`, `TypographyToken` qui ne sont pas réexportés par `src/theme/index.ts`. Ce fichier exporte `couleurs`, `espaces`, `rayons`, `tailles` : **deux systèmes de design coexistent**. Il faut n'en garder qu'un.

### B3. Deux générations de données et de code

| Domaine | Version « service » (cahier, tests verts) | Version « doublon » | Décision recommandée |
|---|---|---|---|
| Commandes | `commandes`, `lignes_commande` | `orders`, `order_items`, `order_status_history` | Garder `commandes` |
| Livraisons | `livraisons`, `lignes_livraison` | `deliveries`, `deliverers`, `delivery_proofs` (preuves à garder, rattachées à `livraisons`) | Garder `livraisons` |
| Catalogue | `produits`, `categories` | `products`, `product_photos` | Garder `produits` |
| Partenaires | `entreprises`, `etablissements` | `stores`, `store_photos` | Garder `entreprises` |
| Paiements | `transactions`, `ecritures` | `payments` | Garder `transactions` |
| Messagerie | `conversations`, `messages` | `conversation_participants`, module `messaging` en double | Garder la version service |
| Support | `support_requests` (incomplet, voir §5) | module `help` | Une seule table support |

Côté code : 22 contrôleurs (style « controller ») et 52 routes (style « service ») coexistent. Les contrôleurs doivent disparaître ou être réécrits dans le style service.

Côté mobile : **écrans en double** (vérifiés dans le dossier) :

- profil : `(tabs)/profile.tsx` et `(tabs)/profil.tsx` ;
- connexion : `(auth)/login`, `(auth)/connexion`, `(auth)/register`, `(auth)/inscription`, `(auth)/otp-verify` (plus `forgot-password` et `mot-de-passe-oublie`) ;
- commandes : `orders.tsx`, `mes-commandes.tsx`, `order/[id]`, `commande/[id]` ;
- produits : `products.tsx`, `product/[id]`, `produit/[id]`, `store/[id]` ;
- livraison : `delivery.tsx`, `livraison/[id]`, `delivery-proof/[id]` ;
- panier : `cart.tsx` et `(tabs)/panier.tsx` ;
- administration : `admin/*` et `(admin)/*`, deux arbres distincts.

### B4. Schéma et migrations en dérive

Le test `schema-migrations` échoue : la base construite par les migrations ne correspond pas au schéma Drizzle du code. Exemples : `users.nom`, `users.prenom`, `users.email`, `users.is_admin` absents des migrations ; `telephone` en `text` dans un cas et `varchar(20)` dans l'autre ; `mot_de_passe_hash` en `text` ou `varchar(255)`. Conséquence : en production, des requêtes du code échoueront sur la base réelle. Ce point est **bloquant** : il faut un schéma unique, une chaîne de migrations unique, et un test de cohérence vert.

### B5. Tests en échec (15 sur 217)

- **9 échecs sur les collectes** (`tests/collectes.test.ts`) : la route exige désormais `produitId` et `ligneCommandeId` (la collecte est liée à une ligne de commande, comme le demande le nouveau parcours), mais les tests envoient toujours l'ancien format. Le code suit la nouvelle décision ; **ce sont les tests qu'il faut mettre à jour**, en créant une commande payée dans la mise en place.
- **Anomalies de qualité** (`tests/livraisons.test.ts`, tests 129 et 148) : une anomalie doit bloquer l'article et prévenir les partenaires concernés.
- **Tableaux de bord** (tests 131, 214, 215) : attendent des compteurs et une visibilité qui ne correspondent pas encore à la base actuelle.
- **Cohérence schéma/migrations** (test 209) : voir B4.

### B6. Hygiène du livrable

- Un fichier `backend/.env` est présent dans le zip. Aucun secret connu n'y figure (seule une URL publique apparaît), mais **il ne doit jamais être livré**. Le `.gitignore` le protège ; le zip, non.
- Le script `npm test` de l'application mobile est un placeholder.

---

## 4. Décisions de novembre 2026 : ce qui est implémenté et ce qui ne l'est pas

| Décision | État dans le dossier |
|---|---|
| `PAYMENT` pour encaisser, `GIVE_CHANGE` réservé aux versements commerçants | Partiel : le client MyPVit distingue les opérations (`initiatePartnerWithdrawal`) |
| Pas de versement automatique au commerçant après paiement client | **Non respecté** : les écritures de part commerçant sont créées au paiement (`ecritures.ts`) |
| Le commerçant ne déclenche pas de versement (lecture seule) | **Non respecté** : la table `demandes_retrait` (0000) et le parcours de demande de retrait existent toujours |
| Versement manuel par l'administrateur principal, article par article | **Absent** |
| Frais MyPVit déduits du montant demandé par le commerçant, affichés brut / frais / net | **Non vérifié** (à rechercher dans le service de versement) |
| Collecte : le livreur signale la récupération, le commerçant confirme la remise, l'administrateur valide | **Présent** côté backend (`ATTENTE_PARTENAIRE`, `ATTENTE_VALIDATION_NZE`, `repondreCollectePartenaire`) |
| Contestation de la collecte par le commerçant avec motif | **Présent** (route de réponse avec `confirmer: false` et motif) |
| Livraison validée définitivement par l'administrateur principal | **Présent** (statut de validation NZE), à confirmer par les tests |
| Deux documents papier (bon de livraison, attestation de conformité) : métadonnées et références | **Partiel** : table `delivery_proofs` (0025) ; stockage des scans non connecté |
| Destinataire délégué : nom, téléphone, pièce vérifiée sans photo, autorisation orale | **Absent** côté structure de données (à vérifier) |
| Client OTP à la livraison | **À retirer ou à réexaminer** : toujours présent alors que la décision impose les documents papier |
| Registre séparé : dette commerçant, éligibilité, blocage réclamation, versement réel | **Absent** |
| Fonds réservés : paiement reçu avant collecte ≠ part retirable (§15.5) | **Non respecté** (même cause que la ligne « écritures au paiement ») |
| Refus / retour / deuxième livraison à la charge de NZE | **Partiel** (`refund_requests`, `reclamations`), flux complet à vérifier |

---

## 5. Exigences du cahier V3.1 : état par section

Légende : ✅ présent et testé · 🟡 partiel · ❌ absent · ⛔ contraire au cahier

| § | Exigence | État | Remarque |
|---|---|---|---|
| 3.1 | Inclus : catalogue, panier, paiement, stock, collectes, livraisons, finance, support, messagerie, notifications | 🟡 | Présent en grande partie, mais dupliqué |
| 3.2 | Exclusions absolues | ⛔ | Voir B1 |
| 5.2 | Permissions par rôle | 🟡 | Test de matrice des droits présent (`droits-routes.test.ts`) ; à re-valider après nettoyage |
| 7 | Application client (accueil, catégories, fiche, panier, commandes, suivi, profil, avis, support) | 🟡 | Écrans en double, parcours à reconstruire sur une seule version |
| 8.1 | Catégories et sous-catégories configurables | 🟡 | Module `categories` présent ; sous-catégories à vérifier |
| 8.2 | Données de fiche : photos, description, caractéristiques, prix, stock, garantie, **SKU** | 🟡 | Photos et SKU absents ; photos dépendent de R2 |
| 8.4 | **Promotions** : offre limitée, prix promo, dates, quantité, activation, prix de référence conservé | ❌ | Aucune table ni écran de promotion |
| 9.2 | Plusieurs établissements par entreprise | ✅ | Table `etablissements` |
| 10 | Stocks, états, historique des mouvements | ✅ | `mouvements_stock`, `signalements_stock`, `stock_niveaux` |
| 11.3 | Indisponibilité partielle, seconde livraison, remboursement de la ligne | 🟡 | Statuts de ligne présents ; remplacement inter-partenaires et ajustement non visibles |
| 12 | Collecte, contrôle qualité, bordereau, visibilité | 🟡 | Backend conforme au nouveau parcours ; tests à aligner (B5) |
| 13.1–13.4 | Point fixe, calcul kilométrique, transparence, suivi | ✅ | Cartographie (estimation ou Google), suivi GPS |
| 13.5 | Livreurs non rémunérés par mission dans l'application | ✅ | Aucune part de commission livreur dans le modèle |
| 14 | Paiements Mobile Money, états, prestataire | 🟡 | Code MyPVit présent, **non validé en réel** |
| 15.1 | Registres séparés | 🟡 | Écritures présentes ; registre dette / éligibilité / versement absent |
| 15.2–15.3 | Commission, décision de règlement | 🟡 | Commission par commerçant présente ; décision manuelle à construire |
| 15.4 | Récupération des avances NZE | ❌ | Non trouvé |
| 15.5 | Fonds réservés avant collecte | ⛔ | Écritures au paiement |
| 15.6 | Corrections comptables | 🟡 | À vérifier |
| 15.7 | Retraits partenaires | ⛔ | Demande initiée par le commerçant : contraire aux décisions de novembre |
| 16.1 | Garantie commerciale | 🟡 | Champ de garantie à vérifier sur le produit |
| 16.2 | Réclamation (dépôt, suivi, pièces jointes) | 🟡 | Backend présent ; mobile client absent ou dupliqué |
| 16.3 | Rétractation, garanties légales | ❌ | Validation juridique à obtenir (hors code) |
| 17.1 | Messagerie partenaire | ✅ | Texte ; photos et vocaux dépendent des médias |
| 17.2 | Service client : identifiant, responsable, statut, priorité, notes internes, historique | 🟡 | `support_requests` n'a ni priorité, ni responsable, ni notes internes, ni historique |
| 17.3 | Notifications | 🟡 | In-app ✅ ; push Firebase ❌ ; SMS eSMS ❌ ; textes serveur en français |
| 18.1 | **Recherche administrative globale** (nom, téléphone, entreprise, SKU, commande, paiement, bordereau, livreur, période) | ❌ | Le module `search` existant concerne le catalogue client |
| 19.1 | Indicateurs | 🟡 | Tableau de bord administrateur partiel |
| 19.3 | Historique non destructif | ✅ | Journal d'audit |
| 20 | Quatre langues dès la première version | 🟡 | Dictionnaire principal complet ; **aide, tutoriel et préférences notifications seulement en fr/en** ; RTL à vérifier sur appareil |
| 21.1 | Authentification et autorisation | ✅ | Mot de passe scrypt, sessions, jetons de rafraîchissement hachés, verrouillage des connexions, acceptation légale |
| 21.2 | Preuves et données | 🟡 | Journal ✅ ; stockage privé des preuves dépend de R2 |
| 21.3 | Conformité | ❌ | Validation juridique hors code (CGV, données personnelles, rétractation) |
| 22.3 | Intégrations : MyPVit, eSMS, Firebase, R2, Google Maps, Realtime | 🟡 | MyPVit codé, cartographie ✅, eSMS / Firebase / R2 / Realtime ❌ |
| 22.4 | Fiabilité des paiements | 🟡 | Vérification de statut et anti-doublon présents ; essais réels à faire |
| 25.1 | Paiement échelonné : **inactif par défaut** | ✅ | La fonction renvoie `false` sans réglage, **mais le commentaire de `regles.ts` dit « Actif par défaut » : à corriger** |
| Annexe A | Location journalière de véhicules | 🟡 | Tables et écrans présents ; vérifier l'absence de location mensuelle et de vente |
| Annexe B | Publicité, espaces, dashboard admin | 🟡 | Tables `advertisements`, `advertisement_pricing`, écrans admin présents |

---

## 6. Ce qui fonctionne (à conserver)

- Authentification téléphone + mot de passe, réinitialisation, verrouillage des connexions, jetons de rafraîchissement hachés.
- Panier et commandes côté serveur (les prix sont recalculés par le serveur).
- Écritures comptables et commissions par commerçant.
- Collectes avec confirmation du commerçant et validation par l'administrateur principal (logique présente).
- Livraisons avec points fixes, distance, suivi GPS.
- Réclamations et remboursements (backend).
- Journal d'audit.
- Relances quotidiennes : job `relances-quotidiennes.ts` et cron Render à 08:00 UTC ; alertes de retard toutes les heures.
- Paiement échelonné (règles de l'avance à 40 %, mensualités sur 3 mois, versements libres) : **implémenté et inactif par défaut**.
- Dictionnaire d'interface en quatre langues, complet pour les 392 clés principales.

---

## 7. Plan de finition recommandé

**Phase 0 — Hygiène (immédiat)**
1. Retirer `backend/.env` du livrable.
2. Corriger le commentaire trompeur de `echelonnement/regles.ts`.
3. Vérifier que la clé MyPVit `sk_live` mentionnée dans le suivi a bien été révoquée (le Postman n'est pas dans le zip, mais la décision doit être confirmée).

**Phase 1 — Stabiliser (objectif : typecheck et tests verts)**
4. Choisir un modèle de référence (recommandation : le style « service » et les tables `commandes`, `livraisons`, `produits`, `entreprises`) et le documenter.
5. Résoudre la dérive schéma/migrations (B4) : une seule chaîne de migrations, un test vert.
6. Supprimer les dépendances fantômes (`jsonwebtoken`, `bcryptjs`, `esms-sms`, `express-rate-limit`) et les fichiers qui les utilisent, ou les déclarer proprement si on les garde.
7. Mettre à jour les tests de collectes (`ligneCommandeId`) et les tests de tableaux de bord.

**Phase 2 — Retirer le périmètre exclu**
8. Retirer les routes, modules et écrans des domaines exclus (B1), en archivant les données sans les effacer.
9. Nettoyer les catégories de support (`reservation`, `prestation`) et les catégories de produits liées.
10. Vérifier la location journalière de véhicules (annexe A) et retirer tout ce qui relève de la location mensuelle ou de la vente.

**Phase 3 — Une seule application**
11. Un seul design system mobile (`couleurs`, `espaces`, `rayons`, `tailles`) ; supprimer `colors`, `spacing`, `radius`, `typography` ou les réexporter depuis le même fichier.
12. Supprimer les écrans en double (liste en B3) et ne garder qu'un parcours par fonction.
13. Ramener le typecheck mobile à 0 erreur, puis créer de vrais tests mobiles sur les écrans du parcours client.

**Phase 4 — Corriger les règles métier de novembre**
14. Remplacer la demande de retrait initiée par le commerçant par des versements manuels article par article décidés par l'administrateur principal.
15. Séparer dans les écritures : dette, éligibilité après livraison validée, blocage pour réclamation, versement réel (§15.5).
16. Retirer le code OTP à la livraison et ajouter les champs du destinataire délégué (nom, téléphone, autorisation orale, références des deux documents papier).

**Phase 5 — Compléter le cahier**
17. Promotions (§8.4) : table, règles de prix, affichage client, historique du prix de référence.
18. SKU et photos produits (§8.2).
19. Recherche administrative globale (§18.1).
20. Support complet (§17.2) : priorité, responsable, notes internes, historique.
21. Aide, tutoriel et préférences de notifications en arabe et chinois.
22. Notifications : textes serveur traduits selon la langue du destinataire.

**Phase 6 — Intégrations réelles**
23. Cloudflare R2 (photos, preuves, messagerie) — fournisseur et identifiants.
24. Firebase (notifications push) — compte et clés.
25. eSMS (codes de renouvellement) — clé de test puis production.
26. MyPVit : environnement de test, format et signature du callback, essais de paiement, statut, échec, versement.
27. Supabase Realtime, si la messagerie en temps réel est retenue.

**Phase 7 — Livraison**
28. Construire l'APK de test (`eas build -p android --profile preview`), tester sur appareil, puis la production.
29. Validation juridique (CGV, rétractation, garanties, données personnelles) avant mise en production.

---

## 8. Décisions à obtenir du fondateur

1. **Périmètre** : confirmer le retrait de restaurants, hébergement, services, taxi et petits boulots (B1). Décider du sort des abonnements, de la monétisation et des tutoriels.
2. **Modèle de référence** : confirmer le style « service » et les tables `commandes`, `livraisons`, `produits`, `entreprises`.
3. **Versements** : confirmer la suppression de la demande de retrait initiée par le commerçant au profit du versement manuel par l'administrateur principal.
4. **Client OTP à la livraison** : le supprimer, ou le conserver en complément des documents papier ?
5. **Fournisseurs** : Cloudflare R2 pour les médias, Firebase pour les notifications push, Supabase Realtime ou non pour la messagerie.
6. **Traductions** : valider les traductions arabe et chinoise de l'aide, du tutoriel et des préférences de notifications (aujourd'hui en français).
7. **Support** : confirmer les priorités, les responsables et les champs de suivi attendus (§17.2).

---

## 9. Remarques sur les documents fournis

Le zip `docs.zip` contient les documents de suivi les plus récents (décisions de novembre, audit V4, périmètre de collecte, changelogs techniques). **Il n'est pas inclus dans le dossier NZE__7_** : les documents doivent être réintégrés dans le projet (dossier `docs/`) avant la prochaine livraison, sinon le dépôt perd sa référence contractuelle.

Le document `audit-v4-avant-apk.md` annonce « 313 clés » et « 26 tests » : ces chiffres ne correspondent plus au dossier actuel (392 clés, 217 tests). Il faut les mettre à jour à partir des mesures de ce rapport.
