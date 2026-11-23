# 01 — Registre des décisions (version consolidée)

Date de mise à jour : 13 novembre 2026. Ce registre remplace les décisions éparpillées dans les anciens documents.

## Règle de priorité

1. Les décisions explicites les plus récentes du fondateur priment sur tout le reste.
2. Le cahier des charges V3.0 (31 octobre 2026, `reference/`) est la référence fonctionnelle et technique.
3. Le prompt maître v1.1 (31 octobre 2026) fixe la méthode : phases, lots, rapport de passation.
4. Le code de l'archive est l'état réel. Il n'a pas valeur de décision.
5. Les documents archivés (`archive/`) et l'ancienne base v1.0 ne font plus autorité.

Une règle absente de ce registre n'est pas une décision. Un point non tranché ne doit pas être activé en production : on prépare une configuration désactivée et on signale le blocage.

## Statut

- **Active** : en vigueur.
- **Remplacée par** : n'est plus appliquée ; voir la décision indiquée.
- **À confirmer** : décision ouverte, bloquante pour le lot concerné.

## A. Décisions du fondateur (13 novembre 2026)

| ID | Décision | Statut |
|---|---|---|
| D-A1 | Temps réel : **Supabase Realtime**. Socket.IO n'est pas retenu. | Active |
| D-A2 | Retrait partenaire : **déclenché par le commerçant**, soumis à approbation d'un administrateur autorisé, payé seulement après confirmation réelle du transfert (cahier V3.0 §15.7). | Active. Remplace le versement manuel article par article de la liste de novembre. |
| D-A3 | Paiement échelonné : **exclu du lancement**. La documentation générale fait foi. Les anciennes versions ne sont plus utilisées. | Active (voir D-P7) |
| D-A4 | Documentation : ce dossier `docs/` est la seule référence. Les anciens documents sont dans `archive/`. | Active |

## B. Périmètre et produit

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-P1 | Application conçue depuis zéro : les anciens écrans, codes et choix graphiques ne sont pas repris automatiquement. | Cahier V3.0, « Orientation » | Active |
| D-P2 | Commerce de produits physiques ; trois univers client : Produits, Location, Prestataires. | Cahier V3.0 §1.1 et décisions | Active |
| D-P3 | Location **journalière** de véhicules, prestataires en **catalogue publicitaire** géré par NZE, et publicité payante sont **dans le périmètre**, malgré le cahier V3.0 §3.2. Mise en œuvre en phase 2. | Décision du fondateur (prime sur V3.0 §3.2) | Active |
| D-P4 | Exclus absolus : restaurants et toute préparation de repas ; hébergements ; vente de véhicules ; immobilier ; taxi et transport ; location mensuelle ; inscription libre de vendeurs ; paiement en espèces aux livreurs ; plateforme de streaming. Ces modules ne doivent pas réapparaître par héritage du code précédent. | Cahier V3.0 §3.2 ; décisions refonte | Active |
| D-P5 | Restaurants retirés complètement (cahier, plan de travail et code). | Décision du fondateur | Active |
| D-P6 | Prestataires : **pas de réservation de service, pas de compte ni de dashboard prestataire, pas de publication ni de travaux vérifiés**. La fiche est administrée par NZE ; les demandes sont transmises à NZE. | Décisions refonte | Active. Les fonctions de la v1.0 à retirer sont listées dans `04-ETAT-ET-FEUILLE-DE-ROUTE.md`. |
| D-P7 | Paiement échelonné et crédit : exclus du lancement (cahier V3.0 §25.1). Toute phase ultérieure exige analyse juridique, contrats, trésorerie, plafonds et accord du prestataire. Le module existant reste désactivé par configuration. | Cahier V3.0 §25.1 ; décision D-A3 | Active |
| D-P8 | Vendeur affiché au client : **NZE uniquement**. Aucun nom de partenaire n'est visible au client. | Décision refonte | Active |
| D-P9 | Le client ne navigue pas dans des boutiques partenaires publiques. | Décision refonte (modèle NZE) | Active |
| D-P10 | Phase 1 : espace partenaire limité au **signalement de stock**. Espace partenaire complet en phase 2. | Décision du fondateur (prime sur V3.0, qui place l'espace complet en phase 2) | Active |
| O-12 | Espace partenaire phase 1 : faut-il masquer les onglets tableau de bord et portefeuille (retraits) tant que la phase 2 n’est pas livrée, ou les garder ? | Décision D-P10 (13 nov. 2026) | Ouvert |
| D-P11 | Dashboard administrateur reporté : on finalise d'abord le parcours client. | Décision du fondateur | Active |
| D-P12 | Location : fiche véhicule créée par défaut par NZE ; les autres conditions sont fixées par contrat signé en présentiel ; livraison à domicile possible. | Décision refonte | Active |
| D-P13 | Messagerie client liée à l'article concerné (article et date enregistrés). Types : texte, photo, vidéo, message vocal, emoji. Menu sur une conversation (suppression) et écran de paramètres de messagerie. | Décision refonte | Active |
| D-P14 | Onglet de navigation « Mon profil » (et non « Mon NZE »). | Décision refonte | Active |
| D-P15 | Panier : ajout progressif, total calculé. Le client choisit la livraison ou le paiement sur place. | Décision refonte | Active |
| D-P16 | Souhaits client à prévoir : recherche par photo, espace de toutes les catégories, liste d'envies, « achetés à nouveau », espace « Découvrir » (produits, véhicules, prestataires). | Décision refonte | Active (phase 4 pour la recherche par photo) |

## C. Langues, identité et design

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-L1 | Quatre langues obligatoires dès la première version publique : français, anglais, arabe (affichage de droite à gauche), chinois simplifié. Détection de la langue du téléphone au premier lancement, choix manuel ensuite, préférence mémorisée. | Décision du fondateur ; cahier V3.0 | Active. Remplace le cahier Refonte 2026 §32 (français seul). |
| D-L2 | Identité violet et blanc, logo officiel NZE (tête de panthère violette). Un seul système de design mobile (`src/theme`). | Cahier V3.0 ; décisions | Active |
| D-L3 | Police non Inter, proche d'Amazon. Carrousel publicitaire à défilement automatique (5 à 10 annonces). Rangées de produits par catégorie sur l'accueil. | Décision refonte (maquettes) | Active. Police exacte à choisir. |

## D. Commercial, financier et paiement

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-F1 | Modèle principal : **vente en commission**. Commission négociée au cas par cas avec chaque entreprise ; possibilité de différencier par produit ; base de calcul par défaut : prix hors frais de livraison. Chaque accord est versionné ; une nouvelle commission ne modifie pas les ventes passées. | Cahier V3.0 §2.2, §15.2 ; décision refonte | Active |
| D-F2 | Aucun abonnement partenaire mensuel obligatoire. | Cahier V3.0 §2.2 | Active |
| D-F3 | Frais de livraison : ligne séparée du prix et de la commission. Deuxième livraison (commande partielle liée à une rupture partenaire) : frais à la charge de NZE. | Cahier V3.0 §13 ; décision du fondateur | Active |
| D-F4 | Paiement client uniquement par Mobile Money (Airtel Money ou Moov Money, le client saisit son numéro puis valide), via MyPVit. Carte Visa et Mastercard à ajouter au parcours client, via MyPVit. | Décision du fondateur | Active. La carte n'est pas encore dans le cahier V3.0 : à intégrer. |
| D-F5 | Frais de paiement PVit à la charge du client. | Décision du fondateur | Active |
| D-F6 | Aucun paiement en espèces remis aux livreurs. | Cahier V3.0 §3.2 | Active |
| D-F7 | Retrait partenaire : voir D-A2. | Cahier V3.0 §15.7 | Active |
| D-F8 | Remboursement : montant payé pour les articles ; décision (remplacement ou remboursement) annoncée au client sous 72 heures. | Décision du fondateur | Active. Le délai de 72 heures n'apparaît pas dans le cahier V3.0 : à inscrire au cahier. |
| D-F9 | Garanties : configurables par catégorie. La garantie affichée correspond aux conditions enregistrées sur la commande. | Cahier V3.0 §16, §18 ; décision refonte | Active |
| D-F10 | Rémunération des livreurs : hors application, mensuelle possible. | Décision refonte | Active |
| D-F11 | Point fixe NZE paramétrable dans l'administration, modifiable à tout moment. | Cahier V3.0 §13.1 ; décision refonte | Active |
| D-F12 | Stock mis à jour en temps réel par l'équipe NZE, à temps plein, pour tous les partenaires. Les partenaires signalent les variations (vente physique, rupture, retour) dans l'espace partenaire. | Cahier V3.0 §10.1 ; décision refonte | Active |
| D-F13 | Approbation et versement des retraits : **administrateur principal uniquement** (décision du fondateur, point O-1). | Décision du fondateur (13 nov. 2026) | Active |
| D-M5 | Permissions par module et par action (cahier V3.0 §4.2, point O-2) : matrice dans `nze-backend/src/core/permissions.ts`. Principe retenu par le fondateur. La matrice du rôle secondaire (tout sauf les retraits) est une valeur par défaut à valider. | Décision du fondateur (13 nov. 2026) | Active. Matrice à valider. |

## E. Processus de collecte, livraison et preuves

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-O1 | Livraison : le livreur fait signer le client pour confirmer la réception et le bon état du colis. | Décision refonte | Active |
| D-O2 | Le code OTP de livraison est retiré. La preuve de remise est la signature papier confirmée par le livreur. | Décision refonte (signature) ; retrait appliqué dans NZE 9 | Active, à confirmer par écrit (O-9) |
| D-O3 | Deux documents papier (bon de livraison, attestation de conformité) : métadonnées et références enregistrées. Destinataire délégué : nom, téléphone, pièce vérifiée sans photo, autorisation orale. | Décisions de novembre | Active. Structure de données à compléter. |
| D-O4 | Collecte : le livreur signale la récupération, le commerçant confirme la remise, l'administrateur valide. Le commerçant peut contester avec un motif. | Décisions de novembre | Active |
| D-O5 | Bordereau numérique unique par collecte ; visibilité selon le rôle. Les administrateurs voient tous les bordereaux. | Cahier V3.0 §12.3 ; décisions | Active |
| D-O6 | Rémunération des livreurs : voir D-F10. | — | Active |

## F. Technique et exploitation

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-T1 | Stack : application mobile React Native / Expo (Android et iOS) ; API Node.js, Express et TypeScript sur Render ; PostgreSQL chez Supabase ; ORM Drizzle (Prisma écarté). | Décisions de stack | Active |
| D-T2 | Authentification par le module propre à l'application (téléphone et mot de passe), pas Supabase Auth. | Décisions de stack | Active |
| D-T3 | Médias et fichiers : Cloudflare R2. Notifications push : Firebase. | Décisions de stack | Active. Comptes et clés à fournir. |
| D-T4 | Inscription sans code SMS. L'eSMS ne sert qu'à renouveler un mot de passe oublié. | Décisions de stack | Active. Documentation eSMS et clé de test à obtenir. |
| D-T5 | Une seule chaîne de migrations active (`nze-backend/src/db/migrations`). La chaîne B est archivée dans `archive-migrations-chaine-B/`. | Décision de méthode | Active |
| D-T6 | Aucun fichier `.env` ni secret dans les livrables. Les secrets sont saisis dans l'environnement d'hébergement. | Hygiène | Active |
| D-T7 | Les intégrations externes sont derrière une configuration, avec mode console par défaut tant que les clés ne sont pas fournies. | Décision de méthode | Active |
| D-T8 | Temps réel de la messagerie et du suivi : Supabase Realtime (voir D-A1). | D-A1 | Active. Le code temps réel n'est pas encore branché. |

## G. Méthode de travail

| ID | Décision | Source | Statut |
|---|---|---|---|
| D-M1 | Une étape à la fois. Validation du fondateur avant chaque étape. | Décision du fondateur | Active |
| D-M2 | Livrable : **un seul zip complet** du projet, avec un LIRE-MOI. Les anciens zips sont obsolètes. | Décision du fondateur | Active |
| D-M3 | Aucun test ou build n'est annoncé comme réussi sans avoir été lancé. Le résultat exact est indiqué. | Prompt maître §5 | Active |
| D-M4 | Chaque lot se termine par un rapport de passation (modèle dans `05-LIVRAISON.md`). | Prompt maître §J | Active |

## H. Décisions remplacées (ne plus appliquer)

| Ancienne règle | Remplacée par |
|---|---|
| Modèle v1.0 : abonnements mensuels et publicité comme revenu principal | D-F1, D-F2 |
| Cahier v1.0 (18 étapes) ; cahier Refonte 2026 v2.0 | Cahier V3.0 (`reference/`) |
| Français seul au lancement (cahier Refonte 2026 §32) | D-L1 |
| Temps réel par Socket.IO | D-A1 |
| Versement manuel par l'administrateur principal, article par article (liste de novembre) | D-A2 |
| Commerçant en lecture seule pour les retraits | D-A2 |
| Code OTP à la livraison | D-O2 |
| Comptes multi-activités auto-déclarés (un compte cumule client, commerçant, prestataire, livreur, chauffeur) | Rôles attribués par l'administrateur (cahier V3.0 §4.1) |
| Taxi, moto et chauffeurs | D-P4 |
| Prisma comme ORM | D-T1 |
| Onglet « Mon NZE » | D-P14 |
| Paiement échelonné dans la phase 3 du plan (activé à terme) | D-P7 : exclu du lancement |

## I. Points encore ouverts

| ID | Point | Bloque |
|---|---|---|
| O-1 | ~~Rôle exact habilité à approuver les retraits (cahier V3.0 §15.7 : « un administrateur autorisé »).~~ Résolu : seul l’administrateur principal approuve et verse les retraits (D-F13). | Lot de retrait (étape B) |
| O-2 | ~~Permissions par module et par action (cahier V3.0 §4.2) : liste détaillée des rôles.~~ Résolu sur le principe : permissions par module et par action (D-M5). Matrice du secondaire à valider. | Étape B |
| O-3 | Clé MyPVit : confirmer la révocation de la clé de production mentionnée dans le suivi. | Étape E (avant tout essai réel) |
| O-4 | Comptes et clés : Supabase (URL, clé), Cloudflare R2 (compte, bucket, clés, domaine), Firebase (projet, compte de service), eSMS (documentation et clé de test). | Étape E |
| O-5 | Validation juridique : CGV, rétractation, garanties, données personnelles, textes légaux. | Étape G |
| O-6 | Traductions arabe et chinois de l'aide, du tutoriel et des notifications, validées par des traducteurs. Les notifications serveur sont traduites (22 types) ; les textes arabes et chinois sont à relire. | Étape F |
| O-10 | ~~Langue des interfaces internes~~ Résolu : quatre langues pour toutes les interfaces, y compris administration, partenaire et livreur. | Décision du fondateur | Traduit |
| O-11 | ~~Messagerie : suppression d’une conversation~~ Résolu : suppression définitive par le client, sauf conversation liée à une réclamation ou à un litige, archivée pour les administrateurs. Réglage validé : alerte de nouveaux messages, activable ou non. | Décision du fondateur ; cahier V3.0 §17.1 | Résolu |
| O-7 | Priorités, responsables et champs de suivi du support (cahier V3.0 §17.2). | Phase 2 |
| O-8 | Intégrer au cahier V3.0 : paiement par carte (D-F4), délai de 72 heures (D-F8), frais PVit à la charge du client (D-F5). | Documentation |
| O-9 | Confirmer par écrit le retrait de l'OTP de livraison (D-O2). | Étape A |

## Décisions ajoutées — P0 financier

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-F-P0 | Fonds réservés : une vente est retirable seulement après collecte validée de sa ligne, sans réclamation ni litige ouvert (cahier V3.0 §15.5). | Demande du fondateur (« P0 financier »), appliquée le 15 novembre 2026 | Active. À valider : ventes en retrait (voir rapport de passation, point 1). |

## Décisions ajoutées — intégration MyPVit

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PAY-1 | Un compte d'opération MyPVit par opérateur, une clé par compte ; une clé n'est jamais envoyée avec le compte d'un autre. | Référence en production (bug du 27/08) | Active. À confirmer : comptes attribués par MyPVit. |
| D-PAY-2 | Filtrage IP des callbacks et de la réception de clé ; réception refusée si la liste est vide. | Référence | Active. À renseigner : IP MyPVit. |
| D-PAY-3 | Rattrapage des paiements en attente toutes les 10 minutes ; versement incertain tranché à la main par l'administrateur principal. | Référence | Active. Coût Render à valider. |

## Décisions ajoutées — mise en œuvre de D-P6 et parcours d'achat (15 novembre 2026)

Le fondateur a demandé de retenir la meilleure option pour les points ouverts et de poursuivre la finalisation. Les choix ci-dessous sont proposés par l'assistant ; ils sont actifs mais restent à valider.

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-P6-M1 | La fiche ne montre que le nom public, l'activité, la zone et la description. Aucun numéro du prestataire n'est enregistré ni exposé au client. | Application de D-P6 et D-P8 (aucun partenaire visible au client) | Active, à valider |
| D-P6-M2 | Une demande comporte un motif (information, devis, autre) et un message de 10 à 2000 caractères. Elle n'engage aucune réservation : NZE rappelle le client sur le numéro de son compte. | Application de D-P6 | Active, à valider |
| D-P6-M3 | Une seule demande en cours par client et par fiche. Une nouvelle demande est possible une fois la précédente traitée. | Anti-doublon | Active, à valider |
| D-P6-M4 | Le traitement par NZE passe par deux étapes : traitée (rappel fait), puis clôturée. Une note interne peut être ajoutée. Toute action est journalisée. | Registre de passation | Active, à valider |
| D-P6-M5 | Les photos des fiches ne sont pas encore prises en charge : elles seront branchées sur Cloudflare R2 (étape E). | Étape E | Ouvert |

## Décisions ajoutées — audit du 16 novembre 2026

Ces points sont appliqués dans le code. Ils restent à valider par le fondateur.

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-LIST-1 | Toutes les listes sont paginées : `limite` (200 au maximum) et `decalage`. Aucune liste ne tronque en silence. Les tableaux de bord et les totaux lisent l'ensemble des données, jamais une seule page. | Audit du 16 nov. 2026 | Active, à valider |
| D-T5 | Récupération assistée du mot de passe, sans SMS : l'administrateur principal génère un code à usage unique (valable 5 minutes), après avoir vérifié l'identité du client par téléphone. Désactivée par défaut (`RECUPERATION_ASSISTEE`). | Audit (point 2) ; règle : un point non tranché reste désactivé en production | Prête, désactivée. **À décider par le fondateur** |
| D-M-REC | Génération du code de récupération : administrateur principal seulement (permission `recuperation.assistee`). Le code n'est jamais journalisé. | Choix de sécurité | Active, à valider |

## Décision ajoutée — stockage des photos (16 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-R2-1 | Les photos sont stockées dans un seau R2 privé (`nze`). Les liens vers les photos sont signés et valables une heure. Pas de domaine public tant que le fondateur ne le décide pas. Le stockage n'est actif que si toutes les variables `R2_` sont renseignées. | Décision D-T3 ; règle : un point non tranché ne s'active pas en production | Active, à valider |

## Décision ajoutée — temps réel Supabase (16 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-RT-1 | Jetons Realtime signés en ES256 avec une clé propre au projet, importée dans les clés de signature Supabase. Le secret HS256 hérité n'est pas utilisé : il est en « précédent » dans le projet. La clé privée n'existe que dans Render ; l'application ne reçoit que l'URL et la clé publique. Les jetons durent 10 minutes et sont renouvelés par l'application. Supabase Auth n'est pas utilisé (D-T2). | D-A1, D-T8 ; documentation Supabase (clés de signature importables) | Serveur prêt, inactif sans clé. **Import de la clé à faire par le fondateur.** |

## Décisions du fondateur — audit P0 (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-AUD-1 | Retrait partenaire : déclenché par le commerçant (D-A2), approuvé et versé par l'administrateur principal uniquement (D-F13). La règle « versement manuel article par article » reste abandonnée. | Décision du fondateur, 17 nov. 2026 | Active |
| D-AUD-2 | Frais MyPVit à la charge du client : le mécanisme (frais en plus ou déduits) ne peut pas être tranché sans la documentation officielle de MyPVit ni un essai en sandbox. Sources à lire : l’application de référence en production et l’essai sandbox (ligne « relation »). | **Bloqué** : questions 1 et 2 de `docs/SANDBOX-MYPVIT.md` |
| D-AUD-3 | Liste des IP des callbacks MyPVit (`MYPVIT_WEBHOOK_ALLOWED_IPS`) : 176.31.65.18, 176.31.65.20, 176.31.65.21, 13.59.249.167. À saisir dans Render. | Fournie par le fondateur (D-PAY-2) | Active. À confirmer auprès de MyPVit |
| D-AUD-4 | Cron d'échelonnement : en attente, aucune modification pour l'instant (D-P7). | Décision du fondateur, 17 nov. 2026 | En attente |

## Décision ajoutée — liste des IP MyPVit en production (lot 3, 17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PAY-2-B | En production, la liste `MYPVIT_WEBHOOK_ALLOWED_IPS` est obligatoire : sans elle, le démarrage est refusé. Chaque adresse doit être une IPv4 valide, dans tous les environnements. | Audit P0 (point 4.1), décision D-AUD-3 | Active |

## Suivi — lot 4 : banc d'essai MyPVit (17 novembre 2026)

| Réf | Point | Statut |
|---|---|---|
| D-AUD-2 | Frais MyPVit à la charge du client : le mécanisme (frais en plus ou déduits) ne peut pas être tranché sans la documentation officielle de MyPVit ni un essai en sandbox. | **Bloqué** : questions 1 et 2 de `docs/SANDBOX-MYPVIT.md` à poser à MyPVit |
| D-AUD-5 | Le banc d'essai MyPVit (`scripts/sandbox-mypvit.ts`) refuse la production, exige une adresse de test explicite en https, et une confirmation. | Active |

## Décisions du fondateur — frais et commission (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-AUD-6 | Frais MyPVit : NZE ne les affiche pas au client. Le client les voit sur l'invite de paiement de l'opérateur. Le fondateur estime ces frais faibles. Cela révise l'exigence d'affichage de D-F5. La question de savoir si les frais s'ajoutent au montant ou sont déduits reste ouverte (D-AUD-2) : elle conditionne l'écriture comptable. | Décision du fondateur, 17 nov. 2026 | Active. D-AUD-2 reste bloqué sur le mécanisme |
| D-AUD-7 | Rémunération de NZE par transaction : la commission négociée avec chaque partenaire, définie par entreprise dans l'administration (versionnée, sans valeur par défaut). Le client voit le total articles et livraison, jamais la commission. Aucun frais de service payé par le client n'est prévu par le cahier des charges ni par le code. | Cahier des charges, section 15.2 et tableau « Commission NZE » ; code `commissions.ts` | Active. Un frais de service client reste à décider |

## Décision du fondateur — frais de service NZE (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-AUD-8 | Frais de service NZE, distincts de la commission : une somme ajoutée à chaque transaction MyPVit, payée par le client en plus du total, modifiable par l'administration. Montant et nature (somme fixe en FCFA ou pourcentage) à fixer par le fondateur. Non prévu par le cahier des charges : décision postérieure. Proposition : figé par commande (une seule fois, pas par tentative de paiement) ; enregistré comme recette de NZE dans le registre COMMISSIONS ; affiché au client avant paiement ; la commission reste la part négociée avec le partenaire (D-AUD-7). | Décision du fondateur, 17 nov. 2026 | En attente du montant et de la nature. Non implémenté |

## Décision ajoutée — réservation du stock au paiement (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-STOCK-1 | Une réservation est créée dans la même transaction que chaque paiement (paiement en ligne, avance échelonnée). Elle est vendue à la confirmation, une seule fois, et libérée en cas d'échec ou d'annulation. La quantité vendable est le disponible moins le réservé ; la fiche et le filtre « en stock » n'annoncent que cette quantité. Un paiement non tranché garde sa réservation. | Demande du fondateur (étape 1, 17 nov. 2026) ; exigence de gestion des stocks (réservation, libération, pas de vente en double) | Active, à valider |

## Points ouverts ajoutés (17 novembre 2026)

| ID | Point | Bloque |
|---|---|---|
| O-13 | Délai d'expiration d'une réservation dont le paiement reste en attente sans réponse du fournisseur. Aujourd'hui, la réservation reste jusqu'à résolution. Un délai libérerait l'article, mais un paiement tardif devrait alors être traité comme un écart. | Décision du fondateur |
| O-14 | Avance en cours au moment de l'annulation d'un plan : la réservation est libérée, mais un succès tardif de cette avance n'est pas bloqué. | Étape échelonnement |

## Décisions ajoutées — étape 2 : espace partenaire et collectes (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-COL-1 | Les articles d'une collecte validée entrent en stock, une seule fois, traçables au bordereau. Une ligne bloquée (anomalie) n'entre qu'à la levée de son blocage : à la validation si le blocage est déjà levé, sinon au moment de la levée. | Demande du fondateur (étape 2) ; cahier §12 (collectes) | Active, à valider |
| D-COL-2 | Une collecte validée ne s'annule pas : ses articles sont déjà entrés en stock. Toute correction passe par un ajustement de stock motivé. | Cohérence entre stock et collectes | Active, à valider |
| D-PART-1 | L'espace partenaire affiche dès maintenant ses historiques : collectes, ventes, stock (en stock ou en rupture) et retraits. Remplace partiellement D-P10 (phase 1 limitée au signalement de stock). Les mouvements internes de réservation ne sont pas affichés. | Réponse du fondateur (17 nov. 2026) | Active, à valider |

## Points ouverts ajoutés (étape 2)

| ID | Point | Bloque |
|---|---|---|
| O-15 | Les onglets « Portefeuille » et « Historique » se recouvrent (ventes et retraits). Les fusionner, ou garder les deux ? | Décision du fondateur |
| O-16 | Stock initial : un article collecté entre en stock à la validation, donc une saisie manuelle du même stock le compterait deux fois. Règle proposée : stock initial à zéro, puis collecte ; les ajustements servent aux corrections. | Procédure de saisie, décision du fondateur |

## Décisions ajoutées — étape 3 : réglages de l'échelonnement (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-1 | L'acompte (40 % à l'origine) et la durée maximale (3 mois à l'origine) sont réglables par l'administrateur principal, dans les bornes 10–90 % et 1–12 mois. Le réglage ne s'applique qu'aux plans créés après le changement ; les plans existants gardent leurs montants. Le nombre maximal d'articles reste 5. | Demande du fondateur (étape 3) ; exigence « aucune valeur codée en dur » | Active, à valider |
| D-ECH-2 | Un article neuf n'est pas échelonnable par défaut : l'administrateur doit l'activer article par article. Les articles existants gardent leur valeur actuelle. | Demande du fondateur (étape 3) | Active, à valider |

## Points ouverts ajoutés (étape 3)

| ID | Point | Bloque |
|---|---|---|
| O-17 | Les articles créés avant ce changement sont restés échelonnables par défaut. Il faut revoir leur liste avant d'activer l'échelonnement. | Activation de l'échelonnement |

## Décision ajoutée — étape 4 : retrait partenaire par carte (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-CARTE-1 | Le retrait par carte (Visa, Mastercard) est prévu dans le modèle et la validation, mais désactivé en code (`RETRAIT_CARTE_DISPONIBLE = false`) tant que MyPVit n'a pas confirmé par écrit ses versements vers carte. NZE ne demande ni ne stocke aucune donnée de carte : le numéro n'est demandé que pour Airtel Money et Moov Money. | Demande du fondateur (étape 4) ; règle « NZE ne traite jamais les données de carte » | Active, à valider |

## Point ouvert ajouté (étape 4)

| ID | Point | Bloque |
|---|---|---|
| O-18 | Confirmation écrite de MyPVit que ses versements vers carte sont possibles, et de la manière dont les données de carte du bénéficiaire sont saisies (page sécurisée MyPVit ou autre). Sans cette réponse, le verrou reste fermé. | Activation du retrait par carte |

## Décision ajoutée — étape 5 : notifications push Android (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PUSH-1 | Les notifications push sont envoyées via Firebase Cloud Messaging, en Android pour l'instant. Un appareil est enregistré à la connexion et retiré à la déconnexion. Seules les notifications de moins de 24 heures sont poussées. Un jeton périmé est retiré. Sans clé de service Firebase, rien n'est envoyé, et les notifications restent consultables dans l'application. | D-T3 (Firebase) ; demande du fondateur (étape 5) | Active, à valider |

## Point ouvert ajouté (étape 5)

| ID | Point | Bloque |
|---|---|---|
| O-19 | Projet Firebase, compte de service (clé fournie à Render), fichier `google-services.json` pour l'application Android, et décision sur iOS (Firebase iOS, APNs). | Envoi réel des notifications push |

## Décision ajoutée — étape 6 : renouvellement du jeton push (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PUSH-2 | Le jeton push est réenregistré à chaque démarrage d'une session ouverte, et à chaque renouvellement de jeton pendant que l'application est ouverte. Au démarrage, aucune demande de permission n'est faite : seule la connexion la demande. | Demande du fondateur (étape 6) ; complète D-PUSH-1 | Active, à valider |

## Décision en attente — étape 7 : notifications push iOS (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PUSH-3 | Voie retenue pour iOS, à choisir parmi : (A) Firebase iOS avec le SDK natif, cohérent avec D-T3 ; (B) service de notifications d'Expo, plus simple côté iOS mais qui modifie D-T3 ; (C) iOS reporté après Android. Tant que la décision n'est pas prise, l'application n'enregistre aucun jeton iOS. | Vérification technique de l'étape 7 | En attente de décision |

## Point ouvert ajouté (étape 7)

| ID | Point | Bloque |
|---|---|---|
| O-20 | Pour la voie A : compte Apple Developer, clé APNs (.p8) avec son identifiant et celui de l'équipe, identifiant du bundle iOS, fichier `GoogleService-Info.plist` de l'application iOS Firebase, et un build natif (EAS). Pour la voie B : compte Expo et identifiants Apple gérés par Expo. | Push iOS |

## Mise à jour — D-PUSH-3 : voie A retenue pour iOS (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PUSH-3 (mise à jour) | Voie A retenue : Firebase iOS avec le SDK natif (`@react-native-firebase/messaging` 27.1.1). Le code iOS est écrit mais désactivé (`PUSH_IOS_ACTIF = false`) tant que O-20 n'est pas complet. | Choix du fondateur (17 nov. 2026) | Active, à valider ; activation en attente de O-20 |

## Décision ajoutée — étape 8 : alerte de stock faible (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-STOCK-2 | Une alerte « stock faible » est envoyée quand la quantité vendable passe sous le seuil de 3 (le même seuil que l'affichage client). Elle part une seule fois à chaque franchissement, et va aux administrateurs principal et secondaire ainsi qu'aux partenaires du produit. Elle est déclenchée par une réservation, un ajustement, un signalement ou une vente sans réservation ; jamais par une libération. Elle passe par les notifications de l'application et par le push. | Cahier PDF §9 (« stock faible ») ; demande de l'audit | Active, à valider |

## Point ouvert ajouté (étape 8)

| ID | Point | Bloque |
|---|---|---|
| O-21 | Seuil fixe de 3 pour tous les produits. Confirmer s'il doit être réglable par produit, et si l'administrateur secondaire doit recevoir l'alerte. | Réglage fin des alertes |

## Décision ajoutée — étape 9 : suivi de commande côté client (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-CMD-1 | Le client voit une progression : confirmée (paiement vérifié), en préparation, prête, en livraison (livreur en route ou arrivé), livrée. Les étapes « en préparation » et « prête » sont saisies par l'administration, dans cet ordre, une seule fois, et jamais une fois la commande partie en livraison. Chaque étape notifie le client. | Demande du fondateur (étape 9) ; cahier §4.4 (statuts de commande) | Active, à valider |

## Point ouvert ajouté (étape 9)

| ID | Point | Bloque |
|---|---|---|
| O-22 | Qui saisit « en préparation » et « prête » : l'administration seule (choix actuel) ou aussi le commerçant ? Les notifications de livraison (`LIVRAISON_AFFECTEE`, `LIVREUR_ARRIVE`, `LIVRAISON_ECHEC`) restent en français : elles restent à traduire (O-6). | Saisie par le commerçant ; traduction des notifications de livraison |

## Décisions ajoutées — étape 10 : échéancier par article (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-3 | Chaque article échelonnable a sa durée (1 à 12 mois, obligatoire), son avance (10 à 90 %, 40 % par défaut si absente) et son échéancier. Échéance de base = reste ÷ durée, arrondie au franc supérieur ; le dernier mois absorbe l'arrondi. Le client ne choisit plus son montant mensuel : il peut seulement verser davantage (étape 11). L'avance de tout le panier est réglée en une seule transaction. | Validation du fondateur (17 nov. 2026) | Active, à valider |
| D-ECH-4 | Pénalité de 10 000 FCFA par mois supplémentaire nécessaire pour solder l'achat, au-delà de la durée initiale, tant qu'un solde reste dû. Montant réglable par l'administration principal (0 à 100 000 FCFA). Toutes les pénalités reviennent à NZE. Le client voit ces conditions avant de confirmer. L'application de la pénalité relève de l'étape 11. | Validation du fondateur (17 nov. 2026) | Active, à valider |

## Point ouvert ajouté (étape 10)

| ID | Point | Bloque |
|---|---|---|
| O-23 | Les articles déjà échelonnables avant ce changement n'ont pas de durée : ils ne peuvent plus être commandés en échelonné tant que l'administration n'a pas réglé leur durée. Confirmer cette conséquence ; elle sera à régler article par article. | Mise en service de l'échelonnement |

## Décisions ajoutées — étape 11 : versements, validation mensuelle, pénalités, surplus (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-5 | Un versement vise un article. Il est affecté aux mois les plus anciens non soldés, puis aux pénalités dues. Un trop-perçu après soldes est porté sur le dernier mois et tracé. | Validation du fondateur (17 nov. 2026) | Active, à valider |
| D-ECH-6 | Surplus : option (a). Après chaque versement, le reste de l'achat est réparti équitablement sur les mois non soldés, la durée est conservée, et le dernier mois absorbe l'arrondi. | Validation du fondateur, option (a) | Active, à valider |
| D-ECH-7 | Un mois est validé si entièrement versé, partiel si un versement est inférieur, en retard si la date limite est dépassée sans solde. Une pénalité de 10 000 FCFA par mois complet écoulé après la dernière date limite, tant qu'un solde reste dû. Les pénalités reviennent à NZE. Le plan n'est soldé qu'une fois les pénalités payées. | Validation du fondateur (17 nov. 2026) | Active, à valider |

## Point ouvert ajouté (étape 11)

| ID | Point | Bloque |
|---|---|---|
| O-24 | Après un versement partiel, le montant « dû » d'un mois partiel inclut ce qui est déjà payé. Exemple : mois 2 de 2 000 FCFA, 1 000 payés, reste recalculé de 1 500 : le montant dû du mois devient 2 500, avec 1 500 à régler. À valider : afficher le reste à payer du mois (1 500) plutôt que le montant total (2 500). | Présentation du recalcul dans l'application |

## Décision ajoutée — étape 12 : rappels et alertes par mois (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-8 | Pour chaque mois non soldé d'un plan actif : rappel dans les trois jours qui précèdent la date limite, alerte le jour même, retard le lendemain si le mois n'est toujours pas soldé. Chaque type n'est envoyé qu'une fois par mois. Notification dans l'application et push, jamais par SMS. Chaque pénalité ajoutée est notifiée. Les plans antérieurs à l'étape 10 gardent l'ancien suivi par plan. | Validation du fondateur (17 nov. 2026) | Active, à valider |

## Points ouverts ajoutés (étape 12)

| ID | Point | Bloque |
|---|---|---|
| O-25 | Les jours sont comptés en jour calendaire UTC. Libreville est en UTC+1 toute l'année : un rappel peut tomber un jour décalé selon l'heure de passage de la relance. À confirmer, ou à calculer en heure locale. | Précision des rappels |
| O-26 | La relance quotidienne doit tourner tôt le matin, heure de Libreville, pour qu'un rappel « trois jours avant » parte bien le bon jour. Heure du cron à vérifier dans `render.yaml`. | Heure d'envoi des rappels |

## Décision ajoutée — étape 13 : vue commerçant et échéancier client (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-9 | Le commerçant voit, pour chaque article de son magasin, le montant encaissé (avance et mois payés), le montant attendu, et le nombre de mois validés, partiels et en retard. Lecture seule. Aucune identité de client : seulement la référence de commande. Les pénalités, reversées à NZE, n'apparaissent pas dans sa vue. Le client voit son échéancier mois par mois, en lecture seule, depuis le détail de sa commande. | Demande du fondateur (étape 13, vue commerçant) ; règle des pénalités (D-ECH-7) | Active, à valider |

## Points ouverts ajoutés (étape 13)

| ID | Point | Bloque |
|---|---|---|
| O-27 | Le commerçant voit deux vues de paiement échelonné : l'ancienne (par plan, étape 3) reste sur `/partenaire/echelonnements`, la nouvelle (par article) est sur `/partenaire/echeanciers`. À fusionner ou à garder séparées ? | Simplification de l'espace commerçant |
| O-28 | Le client peut consulter son échéancier, mais il ne peut pas encore régler une mensualité ou une pénalité depuis l'application : aucun écran de versement par article n'existe. | Autonomie de paiement du client |

## Décision ajoutée — étape 14 : paiement d'une échéance depuis l'application (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-10 | Le client paie depuis l'application une échéance d'un article : il choisit l'article, saisit un montant entier entre 1 et le reste à payer de cet article (mensualités restantes et pénalités), puis choisit Airtel Money, Moov Money ou carte. L'application suit le paiement jusqu'à confirmation, puis actualise l'échéancier. Aucun montant minimal n'est imposé. | Demande du fondateur (étape 14) ; règles des versements (D-ECH-5) et des pénalités (D-ECH-7) | Active, à valider |

## Points ouverts ajoutés (étape 14)

| ID | Point | Bloque |
|---|---|---|
| O-29 | Le paiement par carte renvoie vers la page du prestataire : l'encaissement n'est confirmé qu'à la vérification. Le retour du client dans l'application n'a pas encore été vérifié sur téléphone. | Essai sur téléphone |
| O-30 | Les règles de numéro mobile diffèrent encore entre les écrans de commande (8 à 12 chiffres) et les versements du serveur (0 facultatif puis 7 à 9 chiffres). L'écran d'échéance a été aligné sur le serveur ; l'écran de commande reste à vérifier. | Cohérence des saisies |

## Décision ajoutée — étape 15 : finitions de l'échéancier et vue commerçant unique (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-11 | Le commerçant n'a qu'une vue : `GET /partenaire/echelonnements`. Elle donne sa part réelle encaissée et à verser (après commission), puis le détail de chaque article : reste en principal, mois validés, partiels et en retard. Aucune pénalité, aucune identité de client. Le client voit, pour chaque mois, le reste à payer et le total du mois. | Validation des points O-24 et O-27 (étape 15) ; correction de la vue de l'étape 13 | Active, à valider |

## Points ouverts (étape 15)

| ID | Point | Bloque |
|---|---|---|
| O-24 | Présentation du reste d'un mois partiel : appliquée au client (« Reste à payer : X FCFA (sur Y FCFA) »). À confirmer. | Validation du libellé |
| O-27 | Vue commerçant : fusionnée. Clos. | — |
| O-31 | Les champs « à échéance » et « en retard » de la vue par plan restent calculés par l'ancienne situation (étape 3), approximative pour un panier aux durées différentes. À remplacer par le calcul par article. | Exactitude des alertes côté commerçant |

## Décision ajoutée — étape 16 : alertes calculées par article (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-ECH-12 | Les alertes d'un plan (échéance en cours et présence d'un retard) sont calculées article par article, pour le commerçant comme pour le client. Échéance en cours : pour chaque article, le premier mois non soldé ; le total de ces restes est affiché. Retard : au moins un mois en retard sur un article. | Clôture de O-31 ; cohérence entre les vues | Active, à valider |

## Points ouverts (étape 16)

| ID | Point | Bloque |
|---|---|---|
| O-32 | Le parcours de bout en bout a été joué sur la base de test embarquée (mêmes migrations). Il n'a pas été joué sur la base Supabase réelle : je n'y ai pas accès, et je ne demande ni ne répète ses identifiants. À faire sur une base de préproduction, avec la procédure ci-dessous. | Mise en production |
| O-33 | Le filtre « en retard » de la liste d'administration (`/admin/echelonnements?enRetard=true`) utilise encore l'ancienne situation par plan. À aligner sur le calcul par article. | Exactitude de la liste d'administration |

## Décision ajoutée — étape 17 : mise en production (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PROD-1 | Aucun déploiement en production sans passage préalable sur une base de préproduction (O-32) et sans fermeture des points bloquants de `docs/PROCEDURE-MISE-EN-PRODUCTION.md`, section 2. Les secrets sont saisis uniquement dans Render et Supabase. | Préparation de la mise en production | Active, à valider |

## Décision ajoutée — étape 18 : rotation des identifiants (17 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-PROD-2 | Les identifiants écrits dans une discussion (jeton Cloudflare R2, clé MyPVit de production) sont révoqués et remplacés avant toute mise en production, selon `docs/ROTATION-IDENTIFIANTS.md`. Les actions sont menées par le fondateur, depuis ses comptes. Un contrôle `npm run verifier:secrets` est ajouté au dépôt. | Procédure de mise en production (étape 17) | Active, à valider |

## Décision ajoutée — étape 20 : suivi de livraison côté client (19 novembre 2026)

| Réf | Décision | Source | Statut |
|---|---|---|---|
| D-SUIVI-1 | Le client voit une barre d'avancement de sa livraison (confirmée, en préparation, prête, en livraison, livrée) et, pendant la livraison, la distance restante du livreur. La distance n'est connue que si l'administration a activé le suivi GPS et si le livreur a transmis sa position. Le client interroge le serveur toutes les 20 secondes. Aucune position n'est visible hors de sa propre commande. | Demande du fondateur (suivi du colis) ; réglage GPS existant (désactivé par défaut) | Active, à valider |

## Points ouverts (étape 20)

| ID | Point | Bloque |
|---|---|---|
| O-34 | Position du livreur : il faut l'informer et recueillir son accord, et fixer la durée de conservation des positions. C'est une donnée personnelle. | Activation du suivi GPS |
| O-35 | La distance est une distance à vol d'oiseau, pas une distance routière. Pour la production, prévoir une distance routière (Google) pour un calcul fiable. | Précision de la barre |
| O-36 | Le suivi interroge le serveur toutes les 20 secondes. Une mise à jour en temps réel (Supabase Realtime) reste possible plus tard. | Aucun pour l'instant |
