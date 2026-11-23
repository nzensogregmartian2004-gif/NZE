# Livraison — Étape 8 : alerte de stock faible

Date : 17 novembre 2026. Décision appliquée : **D-STOCK-2** (nouvelle, à valider). Point ouvert : **O-21**.

## 1. Objectif

Prévenir l'administration et le partenaire quand un produit n'a plus que quelques articles vendables. Le cahier (§9) prévoit cette alerte ; elle n'existait pas côté administration.

## 2. Ce qui change

- **Seuil** : 3 articles vendables (quantité disponible moins quantité réservée). Le même seuil sert déjà à l'affichage client « stock faible ». Il est désormais défini une seule fois, dans `stock/service.ts`, et réutilisé par le catalogue.
- **Franchissement** : l'alerte part quand le stock vendable passe de « au-dessus du seuil » à « au seuil ou en dessous ». Sous le seuil, aucune répétition. Une remontée puis une nouvelle baisse déclenchent une nouvelle alerte.
- **Déclencheurs** : réservation d'un paiement, vente sans réservation (ancien chemin), ajustement de stock, signalement du partenaire. Jamais une libération (un échec de paiement remonte le stock vendable).
- **Destinataires** : administrateurs principal et secondaire, et partenaires de l'entreprise du produit.
- **Canaux** : notification dans l'application, et push si le push est activé (étapes 5 à 7).
- **Traductions** : titre et message en français, anglais, arabe et chinois simplifié. Les traductions arabe et chinoise restent à relire (O-6).

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/stock/service.ts`, `nze-backend/src/modules/catalogue/service.ts`, `nze-backend/src/modules/notifications/textes.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `nze-backend/tests/stock-faible.test.ts`, `LIVRAISON-ETAPE-8-STOCK-FAIBLE.md`.
- **Supprimés** : aucun fichier.

Aucune migration. Aucune dépendance nouvelle. Aucune route nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests stock et collectes (non-régression) | `node --test` sur `reservation-stock` et `collectes-stock` | 9 réussis sur 9 |
| Tests backend | `npm test` (dans `nze-backend/`) | **392 réussis sur 392** (389 avant, 3 nouveaux dans `stock-faible.test.ts`) |

Les 3 nouveaux tests : franchissement unique et répété après remontée (ajustements) ; alerte par réservation et absence d'alerte par libération ; aucune alerte pour un partenaire d'une autre entreprise.

Mobile : aucun changement. Dernier résultat connu : 30 réussis sur 30.

Non fait ici : essai sur la base Supabase réelle, essai sur téléphone.

## 5. Essais à faire

1. Un produit à 4 articles vendables, puis une commande payée : l'administrateur et le partenaire reçoivent « Stock faible » dans les notifications.
2. Une seconde commande pour le même produit, sous le seuil : aucune nouvelle alerte.
3. Un paiement échoué : le stock vendable remonte, sans alerte.

## 6. Risques et points ouverts

- **O-21** : seuil fixe pour tous les produits, destinataires figés (administrateur secondaire inclus). À confirmer.
- **Rupture** : quand le stock vendable tombe à zéro, le message dit « il reste 0 article(s) vendable(s) ». Un message dédié à la rupture pourrait être ajouté plus tard.
- **Renvoi de l'alerte** : une alerte n'est pas renvoyée si le stock reste sous le seuil, même si personne ne l'a lue. C'est volontaire pour éviter le bruit ; la notification reste dans la liste de l'application.

## 7. Rapport de passation — Étape 8

```
RAPPORT DE PASSATION — Étape 8
Date : 17 novembre 2026
Objectif livré : alerte de stock faible au franchissement du seuil de 3
Décision appliquée : D-STOCK-2 (à valider)
Point ouvert : O-21 (seuil par produit, destinataires)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : aucun nouveau ; nouveau type de notification STOCK_FAIBLE
Tests exécutés : backend typecheck 0 erreur, npm test 392/392 ; non-régression stock 9/9
Ce qui n'est pas fait : essai Supabase réel, essai téléphone, réglage par produit
Proposition de l'étape suivante : étape 9 — statuts de commande côté client (confirmation, préparation, prête, livrée), ou selon votre priorité
```
