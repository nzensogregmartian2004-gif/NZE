# Livraison — Étape 14 : payer une échéance depuis l'application

Date : 17 novembre 2026. Décision appliquée : **D-ECH-10** (à confirmer par écrit). Points ouverts : **O-29**, **O-30**.

## 1. Objectif

Permettre au client de régler une échéance (ou une pénalité) depuis son téléphone, puis de voir son échéancier se mettre à jour.

## 2. Ce qui change

**Parcours** (depuis « Voir mon échéancier » → « Payer une échéance ») :
1. Le client choisit l'article à régler, si son paiement échelonné en compte plusieurs. Seuls les articles non soldés sont proposés.
2. Il saisit le montant : un entier entre 1 et le reste à payer de l'article, mensualités et pénalités comprises. Tout autre montant est refusé avant envoi.
3. Il choisit Airtel Money, Moov Money ou carte, et saisit son numéro pour le mobile money.
4. Le paiement part vers `POST /echelonnements/:id/versements`, avec l'article choisi.
5. Pour le mobile money, l'application demande de valider sur le téléphone, puis vérifie le paiement toutes les quatre secondes, jusqu'à quinze tentatives. Elle recharge l'échéancier à chaque tentative et annonce le succès dès que le reste de l'article baisse.
6. Pour la carte, la page du prestataire s'ouvre ; la vérification suit le même chemin.
7. Si le paiement n'est pas confirmé après les tentatives, l'application le dit et propose de réessayer plus tard.

**Règle de numéro** : alignée sur le serveur (0 facultatif, puis 7 à 9 chiffres).

Le serveur ne change pas : la route de versement, les affectations et les pénalités sont celles de l'étape 11.

## 3. Fichiers

- **Modifiés** : `nze-mobile/app/echeancier/[id].tsx` (bouton « Payer une échéance »), `nze-mobile/src/i18n/dictionnaire.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-mobile/app/echeancier/payer/[id].tsx` (écran de paiement), `nze-mobile/src/lib/echeancier-paiement.ts` (logique pure), `nze-mobile/tests/echeancier-paiement.test.ts`, `LIVRAISON-ETAPE-14-PAIEMENT-ECHEANCE.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune route nouvelle. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **38 réussis sur 38** (34 avant, 4 nouveaux) |
| Backend | (non modifié) | 409 réussis sur 409 |

Les 4 nouveaux tests : montant accepté (espaces compris) ; montants vides, nuls, décimaux, négatifs, non numériques ou au-delà du reste refusés ; reste d'un article = mensualités + pénalités ; libellés présents dans les quatre langues.

Non fait ici : essai sur téléphone (y compris le retour de la page carte), essai sur base Supabase réelle.

## 5. Essais à faire

1. Article échelonné avec 26 000 FCFA restants (6 000 de mensualités, 20 000 de pénalités) : saisir 26 001 est refusé ; saisir 6 000 est accepté et l'échéancier se met à jour.
2. Mobile money : valider sur le téléphone, puis attendre : le message de succès apparaît et le reste de l'article baisse.
3. Carte : la page prestataire s'ouvre ; après paiement, revenir dans l'application et vérifier la mise à jour.
4. Numéro à 10 chiffres avec zéro initial (0741234567) : accepté ; numéro à 12 chiffres : refusé avant envoi.

## 6. Risques et points ouverts

- **O-29 (carte)** : le retour de la page carte vers l'application n'a pas encore été vérifié sur téléphone.
- **O-30 (numéros)** : l'écran de commande utilise encore 8 à 12 chiffres ; à aligner sur le serveur.
- **Vérification** : sans réponse dans les quinze tentatives, le client voit un message et peut réessayer. Le paiement n'est jamais compté avant confirmation par le prestataire.

## 7. Rapport de passation — Étape 14

```
RAPPORT DE PASSATION — Étape 14
Date : 17 novembre 2026
Objectif livré : paiement d'une échéance depuis l'application, avec choix de l'article, montant contrôlé et suivi jusqu'à confirmation
Décision appliquée : D-ECH-10 (à confirmer par écrit)
Points ouverts : O-29 (retour carte), O-30 (cohérence des numéros)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : aucun nouveau (route de versement de l'étape 11)
Tests exécutés : mobile typecheck 0 erreur, npm test 38/38 ; backend inchangé 409/409
Ce qui n'est pas fait : essai téléphone (dont retour carte), essai Supabase réel
Proposition de l'étape suivante : étape 15 — finitions de l'échéancier (présentation du reste d'un mois partiel, O-24) et harmonisation des vues commerçant (O-27), ou selon votre priorité
```
