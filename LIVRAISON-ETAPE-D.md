# Étape D — Espace partenaire, phase 1 : signalement de stock

## Périmètre (décision D-P10)
Phase 1 : le partenaire signale le stock de ses articles. L'espace partenaire complet relève de la phase 2.

## Ce qui est en place et testé
- Signalements : vente physique, rupture, retour, variation (`POST /partenaire/signalements`). Chaque signalement est tracé dans l'historique des mouvements (`GET /partenaire/mouvements-stock`), avec son auteur et sa date.
- Garde-fous : une vente au-delà du stock est refusée (409), le stock ne devient jamais négatif ; un partenaire ne signale pas le stock d'une autre entreprise (404) ; un client ne signale rien (403).
- État du stock visible par le partenaire (`GET /partenaire/produits`, champ `etat`) : Disponible, Collecté par NZE, Indisponible ou À confirmer, fixé par NZE.
- Écran partenaire « Stock » : affiche l'état de chaque article, traduit dans les quatre langues.
- Tests : `nze-backend/tests/partenaire-signalements.test.ts` (7 tests).

## Point ouvert (O-12)
Les onglets « Tableau de bord » et « Portefeuille » (retraits) sont encore affichés en phase 1. Décision à prendre : les masquer jusqu'à la phase 2, ou les garder.

## Résultats mesurés
- Backend : typage 0 erreur ; tests 271 sur 271.
- Mobile : typage 0 erreur ; tests 15 sur 15.
