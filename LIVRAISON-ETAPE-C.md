# Étape C — Parcours client : état de clôture

## Livré dans les dernières étapes
- Accueil en rangées par catégorie, avec « Voir tout ».
- Filtres « En stock » et tri par prix (backend `GET /produits` : `enStock`, `prixMin`, `prixMax`, `tri`), 4 tests.
- Clés de traduction de l'accueil dans les quatre langues.

## Vérifié (déjà en place)
- Suppression définitive d'une conversation (décision O-11) : bouton ⋯, confirmation, effacement de la conversation et de ses messages. Backend : `DELETE /conversations/:id`, réservé au propriétaire (403 pour un autre compte), 8 tests verts.
- Recherche, catégories, listes d'envies, achats à nouveau, panier (livraison ou paiement sur place), paiement Airtel, Moov et carte, suivi et signature de remise, profil, réclamations, messagerie liée à l'article.

## Correction
Le document précédent indiquait que le menu de suppression restait à faire. C'était inexact : le menu existe et est testé.

## Reste à trancher (O-11)
1. Archive pour les administrateurs : le cahier V3.0 §17.1 prévoit un historique consultable par les administrateurs habilités. La suppression définitive côté client l'efface aussi. Faut-il conserver une archive pour les conversations liées à un litige ?
2. Réglages de messagerie : proposition, la notification des nouveaux messages (activable ou non), seul réglage prévu par le cahier §17.1.

## Résultats mesurés
- Backend : typage 0 erreur ; tests 255 sur 255.
- Mobile : typage 0 erreur ; tests 15 sur 15.
