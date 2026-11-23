# Étape B — Entreprises, stock et écritures : état de livraison

## Livré
- **Cycle de vie des entreprises** (cahier V3.0 §8.4) : `prospect → négociation → actif → suspendu → clôturé`.
  - Migration `0015_cycle_entreprises` : colonne `entreprises.statut_partenariat`, contrainte de valeurs, reprise des données (une entreprise qui a une commission passe à `actif`, les autres à `prospect`).
  - Module `nze-backend/src/modules/entreprises/cycle.ts` : transitions autorisées, activation impossible sans commission définie, journalisation de chaque changement (`ENTREPRISE_STATUT`).
  - Route `PATCH /admin/entreprises/:id/statut` (administrateurs), liste `GET /admin/entreprises` avec le statut.
  - Tests : `nze-backend/tests/cycle-entreprise.test.ts` (8 tests).
- Snapshot de migration `0015_snapshot.json` régénéré depuis la base migrée.

## Déjà en place (vérifié, non modifié)
- Commissions versionnées par entreprise (`commissions_regles`, effet daté) ; une commande ne peut pas être créée sans commission.
- Écritures par vente : `VENTE_NET`, `COMMISSION`, `FRAIS_LIVRAISON`, avec contrôle que la somme égale le total payé.
- Retraits partenaires : demande, blocage du montant dès la demande (solde disponible), verrou contre les demandes simultanées, décision et vérification du versement.
- Mouvements de stock historisés (type, avant/après, motif, acteur).

## Reste à faire (étape B suite)
1. Entreprise : identité officielle, responsable, contacts.
2. Accord commercial documenté : date de fin, conditions, durée, document.
3. Stock : états collecté, indisponible et à confirmer.
4. Trois registres séparés (écritures client, commissions et part partenaire, avances et règlements) — aujourd'hui une seule table d'écritures avec des catégories.
5. Permissions par module et par action (point O-2 du registre).
6. Rôle habilité à approuver les retraits (point O-1) : aujourd'hui tout administrateur.

## Résultats mesurés
- `npm run typecheck` (backend) : 0 erreur.
- `npm test` (backend) : 237 tests, 237 réussis.
