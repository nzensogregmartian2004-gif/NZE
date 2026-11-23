# 05 — Règles de livraison et de passation

## 1. Un seul zip complet

Chaque livraison est **un zip complet du projet** (sans `node_modules`), à la racine `NZE/`. Les anciens zips sont obsolètes et ne sont plus utilisés pour reconstruire le projet (D-M2).

Le zip contient : `backend/`, `mobile-nze/`, `docs/`, et le LIRE-MOI de livraison à la racine.

## 2. Contenu du LIRE-MOI de livraison

Pour chaque livraison :

1. **Étape** : identifiant (A, B, C…), objectif, décisions appliquées (IDs de `01-DECISIONS.md`).
2. **Fichiers modifiés, ajoutés, supprimés** : chemin depuis `NZE/`.
3. **Migrations** : nom du fichier, effet, données touchées. Aucune migration sans indication de sauvegarde.
4. **Routes, types, événements, permissions** ajoutés ou modifiés.
5. **Commandes exécutées et résultats exacts** : typage, tests, build. Un résultat non exécuté est signalé comme tel.
6. **Essais à faire sur téléphone**.
7. **Risques et points ouverts** (IDs de la section I de `01-DECISIONS.md`).
8. **Rapport de passation** (section 3 ci-dessous).

## 3. Rapport de passation (modèle)

```
RAPPORT DE PASSATION — Étape [X]
Date :
Objectif livré :
Décisions appliquées : D-…
Fichiers modifiés / ajoutés / supprimés :
Migrations :
Routes / permissions / événements :
Tests exécutés (commande et résultat) :
Ce qui n'est pas fait :
Risques :
Proposition de l'étape suivante :
```

## 4. Vérifications avant toute annonce

- Lancer les vérifications, noter le résultat exact.
- Ne jamais écrire « build réussi » ou « tests verts » sans les avoir lancés.
- Tout écart entre le code et ce dossier `docs/` est signalé dans le LIRE-MOI et corrigé dans le même zip.

## 5. Mise à jour de la documentation

Quand une décision change :

1. Ajouter la nouvelle décision dans `01-DECISIONS.md` avec sa source et sa date.
2. Marquer l'ancienne comme « Remplacée par » dans la section H.
3. Mettre à jour le document concerné (produit, technique, état).
4. Ne jamais modifier l'historique d'une décision : on la remplace.

## 6. Ce qui n'est pas dans le zip

- `node_modules/`, fichiers de build, captures d'écran de test.
- `.env` et tout secret. Les valeurs réelles sont saisies dans Render et dans l'environnement Expo.
- Les anciens documents : ils sont dans `docs/archive/`, marqués obsolètes.

## 7. Rapport de passation — P0 financier (fonds réservés)

**Décision appliquée** : une vente n'est retirable qu'après collecte validée de sa ligne (bordereau `VALIDE`, ligne `CONFORME`), et seulement si la ligne n'a ni réclamation ouverte (`OUVERTE`, `ACCEPTEE`) ni litige ouvert. Cahier V3.0 §15.5 (fonds réservés).

**Changements**
- `backend/src/modules/finance/retraits.ts` : calcul du solde limité aux lignes retirables. `soldeEntreprise` renvoie en plus `enAttenteCollecte` (ventes comptées, non encore retirables).
- `backend/tests/helpers.ts` : `collecterEtValider` (livreur, confirmation du commerçant, validation de l'administrateur principal).
- `backend/tests/p0-retrait-collecte.test.ts` : 5 cas (non collectée, collectée, réclamation ouverte, retrait dans la limite, vente en retrait).
- Tests adaptés à la règle : `retraits`, `notifications-retrait`, `repartition` (solde à 0, part visible en attente), `suivi-partenaire` (vente comptée en attente).

**Résultats mesurés** : backend typage 0 erreur ; suite backend 278 réussis sur 278 (273 avant, + 5).

**À valider par le fondateur**
1. **Ventes en retrait en magasin** : aucune collecte ne les couvre, donc elles ne sont pas retirables. Un mécanisme de remise (confirmation par le commerçant, validée par NZE) reste à définir.
2. **Réclamation ou litige ouvert** : la part de la ligne est gelée jusqu'à clôture.

**Risques ouverts, non traités**
- Un bordereau validé puis annulé **après** un versement n'est pas récupéré : le solde peut devenir négatif. À traiter avec le litige.
- `admin/finance/resume` (« soldes dus ») additionne toutes les ventes : c'est la dette totale, pas le disponible. À libeller comme tel.
- Les callbacks MyPVit doivent être vérifiés pour l'idempotence (un même callback ne doit pas déclencher deux versements). Non vérifié dans cette passe.
- Annulation de commande : vérifiée, possible seulement au panier (avant paiement) : aucune écriture inverse n'est nécessaire.

## 8. Rapport de passation — intégration MyPVit

- Analyse et intégration : voir `docs/paiements/MYPVIT-INTEGRATION.md`.
- Ajouts : un compte par opérateur, une clé par compte, réception de clé par webhook, filtrage IP des callbacks, contrôle au démarrage, rattrapage des paiements (cron toutes les 10 min, coût à valider), vérification du montant des versements, résolution manuelle des versements incertains.
- Avant la production : renseigner les comptes par opérateur et la liste d'IP MyPVit, confirmer les quatre points de la section 4 de la documentation MyPVit, et vérifier l'envoi réel en sandbox.
- Résultats : suite backend 285 sur 285, tests MyPVit 18 sur 18, typage 0 erreur.
