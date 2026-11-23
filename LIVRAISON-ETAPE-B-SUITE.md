# Étape B (suite) — Entreprises, états du stock et trois registres

## Livré
- **Identité et responsable** (cahier V3.0 §8.2) : `PATCH /admin/entreprises/:id` (nom officiel, responsable, rôle, téléphone, e-mail). Réservé aux administrateurs, e-mail vérifié, modification journalisée (`ENTREPRISE_MODIFIEE`).
- **Accord commercial versionné** (cahier V3.0 §8.4) : `POST /admin/commissions` accepte désormais `effetDebut`, `dureeMois`, `conditions`, `documentUrl`. Un nouvel accord ferme le précédent à sa date d'entrée en vigueur (`date_fin`).
- **États du stock** (cahier V3.0 §10.2) : `DISPONIBLE`, `COLLECTE`, `INDISPONIBLE`, `A_CONFIRMER`. `PATCH /admin/produits/:id/etat-stock` ; chaque changement est tracé dans les mouvements de stock. Un article non `DISPONIBLE` ne peut pas être payé.
- **Trois registres séparés** (cahier V3.0 §15.1) : colonne `ecritures.registre` (`CLIENT`, `COMMISSIONS`, `PARTENAIRE`). Chaque vente crée une écriture `ENCAISSEMENT` au registre `CLIENT`, et les registres `COMMISSIONS` et `PARTENAIRE` se répartissent exactement le total.
- **Migration 0016** `etape_b_suite` : colonnes d'identité, d'accord, d'état et de registre, avec contraintes de valeurs. Snapshot `0016_snapshot.json` régénéré depuis la base migrée.
- **Tests** : `nze-backend/tests/etape-b-suite.test.ts` (4 tests). `repartition.test.ts` adapté au registre `CLIENT`.

## Non livré (décisions en attente)
- **O-1** : rôle habilité à approuver les retraits. Aujourd'hui, tout administrateur peut approuver.
- **O-2** : permissions par module et par action. Aujourd'hui, deux rôles d'administration seulement.

## Résultats mesurés
- `npm run typecheck` (backend) : 0 erreur.
- `npm test` (backend) : 242 tests, 242 réussis, 0 échec.

## Pas encore dans l'interface mobile
- Saisie de l'identité et de l'accord, état du stock, vue des trois registres : à construire côté administration.
