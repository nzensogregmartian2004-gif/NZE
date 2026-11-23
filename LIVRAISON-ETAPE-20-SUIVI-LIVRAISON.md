# Livraison — Étape 20 : suivi de livraison et données de démonstration

Date : 19 novembre 2026. Décision appliquée : **D-SUIVI-1** (à confirmer). Points ouverts : **O-34**, **O-35**, **O-36**.

## 1. Ce qui a été fait

**Suivi côté client**
- Le détail de commande renvoie `livraison` : statut, dernière position du livreur, et distance restante en mètres quand elle est connue.
- L'application affiche une barre d'avancement (confirmée, en préparation, prête, en livraison, livrée), l'étape en cours, et la distance du livreur. Elle se met à jour toutes les 20 secondes.
- La distance n'est connue que si l'administration a activé le suivi GPS (désactivé par défaut) et si le livreur a transmis sa position.

**Données de démonstration**
- Au démarrage local, un script crée une seule fois : un administrateur, un commerçant, un livreur, un client, une entreprise avec sa commission, trois articles (dont un échelonnable), les réglages de livraison et d'échelonnement.
- Refusé en production.

**Vérifications**
- Les quatre comptes de démonstration se connectent sur le serveur réel (200).
- Le catalogue renvoie les articles de démonstration (200).

## 2. Vérifications

| Vérification | Résultat |
|---|---|
| Backend typecheck | 0 erreur |
| Backend `npm test` | 413 réussis sur 413 |
| Application typecheck | 0 erreur |
| Application `npm test` | 40 réussis sur 40 |
| Serveur réel | santé 200 ; quatre connexions 200 ; catalogue 200 |

Non fait ici : essai sur téléphone (le suivi dépend de la position réelle du livreur).

## 3. Tableaux de bord

Il n'existe pas de tableau de bord sur le web. Les tableaux de bord sont dans l'application mobile, et leur contenu dépend du rôle du compte connecté : administration, commerçant, livreur, client. Le guide `docs/GUIDE-TEST-LOCAL.md` (section 9) donne les comptes et les étapes.

## 4. Points à connaître avant la production

- **O-34** : la position du livreur est une donnée personnelle. Il faut l'informer, recueillir son accord et fixer la durée de conservation avant d'activer le suivi GPS.
- **O-35** : la distance est une distance à vol d'oiseau. Pour la production, prévoir une distance routière.
- **O-36** : l'interrogation toutes les 20 secondes suffit pour l'instant ; une mise à jour en temps réel reste possible plus tard.

## 5. Rapport de passation — Étape 20

```
RAPPORT DE PASSATION — Étape 20
Date : 19 novembre 2026
Objectif livré : barre de suivi de livraison côté client ; données de démonstration pour tester l'application en local
Décision appliquée : D-SUIVI-1 (à confirmer)
Points ouverts : O-34 (position du livreur : information et accord), O-35 (distance routière), O-36 (temps réel)
Migrations : aucune
Tests exécutés : backend typecheck 0 erreur, npm test 413/413 ; application typecheck 0 erreur, npm test 40/40 ; serveur réel : quatre connexions 200, catalogue 200
Ce qui n'est pas fait : essai sur téléphone, O-34, O-35, Firebase (O-19), rotation des identifiants, préproduction (O-32)
Proposition : essai manuel guidé sur téléphone (client, livreur, commerçant, administration), puis correction des anomalies
```
