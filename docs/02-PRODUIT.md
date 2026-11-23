# 02 — Produit, périmètre et règles métier

Référence fonctionnelle : `reference/NZE_Cahier_des_charges_Complet_V3_Violet_Blanc.docx` (V3.0, 31 octobre 2026), complétée et corrigée par le registre `01-DECISIONS.md`. En cas de contradiction, le registre prime.

## 1. Vision

NZE est une plateforme de commerce en ligne pour le Gabon, première zone CEMAC visée. Le client achète des produits physiques ; NZE référence, encaisse, organise la collecte et la livraison, puis règle le partenaire. Le partenaire reste propriétaire de son produit jusqu'à la vente, selon l'accord commercial.

Le client ne voit ni les boutiques partenaires, ni le nom du vendeur : NZE est l'intermédiaire.

## 2. Univers visibles par le client

| Univers | Contenu | Phase |
|---|---|---|
| Produits | Catalogue par catégories configurables. Fiche article, prix, garantie, panier, commande, paiement, suivi. | Phase 1 |
| Location | Location journalière ou de courte durée de véhicules. Fiche créée par NZE. Livraison à domicile possible. Contrat signé en présentiel. | Phase 2 |
| Prestataires | Catalogue publicitaire géré par NZE. Demandes transmises à NZE. Aucune réservation dans l'application. | Phase 2 |

Publicité payante et promotions : phase 2.

## 3. Périmètre exclu

Voir `01-DECISIONS.md`, section D-P4 et D-P5. En résumé : restaurants et repas ; hébergements ; vente de véhicules ; immobilier ; taxi et transport ; location mensuelle ; inscription libre de vendeurs ; paiement en espèces aux livreurs ; paiement échelonné au lancement ; streaming. Aucun écran, table, champ, endpoint ou parcours de ces domaines ne doit être réintroduit.

## 4. Rôles

Les comptes internes sont créés par l'administrateur principal, qui définit le rôle et les permissions (cahier V3.0 §4.1). Les comptes multi-activités auto-déclarés de la v1.0 ne sont plus appliqués.

| Rôle | Périmètre |
|---|---|
| Client | Compte, profil, adresses, recherche, catalogue, favoris, listes, panier, commandes, paiements, reçus, avis (après commande terminée), support, demandes de réclamation et de retrait. |
| Administrateur principal | Contrôle complet. Crée les administrateurs secondaires, attribue les permissions. |
| Administrateur secondaire / opérationnel | Permissions par module et par action : consulter, créer, modifier, valider, annuler, rembourser, approuver un retrait, exporter. Les actions financières sensibles sont réservées aux rôles qui les reçoivent explicitement. |
| Partenaire | Compte rattaché à son entreprise et à ses établissements. Phase 1 : signalement de stock. Phase 2 : espace partenaire complet (produits, stock, bordereaux, règlements, retraits, messages). |
| Livreur / agent de collecte NZE | Missions, collecte, contrôle qualité, bordereaux, preuve de remise, statut, position GPS selon autorisation. Rémunération hors application. |
| Prestataire (publicitaire) | Pas de compte ni de dashboard. Fiche administrée par NZE. |

Le dashboard administrateur est reporté : il vient après le parcours client (D-P11).

## 5. Entreprises, établissements et catalogue

- Une entreprise (dossier : identité, contact, responsable, accord commercial, statut) possède un ou plusieurs établissements (adresse, horaires, contacts, stock).
- Cycle de vie : prospect, négociation, actif, suspendu, clôturé. Un partenaire ne devient actif qu'avec un accord commercial enregistré. Un partenaire clôturé garde son historique.
- Catégories configurables, champs spécifiques par catégorie, galerie photo, vidéo courte, prix, variantes, garantie, statut de disponibilité.
- Stock : mis à jour par NZE ; états disponible, réservé, collecté, indisponible, à confirmer ; historique des mouvements avec ancienne et nouvelle quantité, motif, acteur, date, source.

## 6. Commission, paiements et règlements

- Commission négociée par entreprise, possiblement par produit, versionnée. Base par défaut : prix hors livraison.
- Trois registres séparés : écritures client, commissions et part partenaire, avances et règlements. Les fonds reçus avant collecte ne sont pas retirables par le partenaire tant que la collecte n'est pas validée.
- Paiement client : Mobile Money (Airtel Money, Moov Money) et carte (Visa, Mastercard), via MyPVit. Frais PVit à la charge du client. Un paiement en attente ne marque jamais une commande comme payée.
- Retrait partenaire : demande du commerçant, approbation d'un administrateur autorisé, transfert, confirmation réelle. Le montant est réservé dès la demande.
- Corrections financières : ajustement historisé, aucune suppression silencieuse.

## 7. Panier, commandes et livraison

- Panier : ajout progressif, total calculé, choix de la livraison ou du paiement sur place.
- Commande principale avec sous-commandes par partenaire et par établissement. Un article indisponible dans une commande multiple suit la règle de substitution ou de report (cahier V3.0 §11.3). La deuxième livraison est à la charge de NZE.
- Frais de livraison calculés à partir du point fixe NZE (paramétrable dans l'administration) et d'un tarif kilométrique. Frais figés au moment de la commande.
- Collecte : le livreur récupère, le commerçant confirme la remise, l'administrateur valide. Bordereau numérique unique. Anomalie de contrôle : l'article est bloqué.
- Remise au client : signature papier confirmée par le livreur. Deux documents papier (bon de livraison, attestation de conformité) : références enregistrées.
- Remboursement : décision (remplacement ou remboursement) annoncée au client sous 72 heures.

## 8. Messagerie et notifications

- Conversations liées à l'article concerné. Types : texte, photo, vidéo, message vocal, emoji.
- Menu sur une conversation (suppression), écran de paramètres.
- Notifications push via Firebase. Textes traduits selon la langue du destinataire.

## 9. Langues

Quatre langues obligatoires dès la première version publique : français, anglais, arabe (affichage de droite à gauche), chinois simplifié. Détection de la langue du téléphone au premier lancement, choix manuel ensuite, préférence mémorisée. Aucun texte d'interface ne doit être écrit en dur dans un écran.

## 10. Identité et design

- Violet et blanc. Logo officiel : tête de panthère violette stylisée, wordmark, caddie.
- Un seul système de design mobile (`mobile-nze/src/theme`) : couleurs, espacements, rayons, tailles, typographies.
- Police non Inter, proche d'Amazon (choix à finaliser).
- Accueil : carrousel publicitaire à défilement automatique (5 à 10 annonces), rangées de produits par catégorie.
- Onglet « Mon profil ».

## 11. Garanties et réclamations

- Garantie par catégorie, configurable. La garantie affichée correspond aux conditions enregistrées sur la commande.
- Réclamation après livraison : NZE ouvre un dossier et enregistre la solution.
- Droit de rétractation : à confirmer par la validation juridique (O-5).

## 12. Données, sécurité et conformité

- Données personnelles et preuves : journalisées, accès par rôle.
- Hébergement et formalités : à confirmer (O-5).
- Textes légaux : à valider par un juriste avant publication. Les textes actuels sont des textes de travail.
