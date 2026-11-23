# Permissions par module et par action — O-1 et O-2 tranchés

## Décisions appliquées
- **O-1** : seul l'administrateur principal approuve, rejette et verse les retraits. Les actions `POST /admin/retraits/:id/decision` et `POST /admin/retraits/:id/verifier-versement` sont réservées au rôle `admin_principal`. La consultation (`GET /admin/retraits`) reste ouverte à l'administrateur secondaire.
- **O-2** : permissions par module et par action. La matrice est dans `nze-backend/src/core/permissions.ts`. Chaque action sensible porte un identifiant `module.action`, et une action absente de la matrice est refusée.

## Matrice actuelle
| Permission | admin_principal | admin_secondaire |
|---|---|---|
| retraits.approuver | oui | non |
| retraits.consulter | oui | oui |
| entreprises.gerer | oui | oui |
| commissions.gerer | oui | oui |
| stock.corriger | oui | oui |

**À valider** : la liste exacte des actions du rôle secondaire. La matrice par défaut lui laisse tout sauf les retraits, comme avant cette livraison.

## Routes protégées par permission
- `GET /admin/retraits` → retraits.consulter
- `POST /admin/retraits/:id/decision`, `POST /admin/retraits/:id/verifier-versement` → retraits.approuver
- `POST /admin/commissions` → commissions.gerer
- `PATCH /admin/entreprises/:id`, `PATCH /admin/entreprises/:id/statut` → entreprises.gerer
- `PATCH /admin/produits/:id/etat-stock`, `POST /admin/produits/:id/ajustements` → stock.corriger

Les autres routes d'administration gardent le contrôle par rôle (`ADMIN_ROLES`) : elles seront migrées vers la matrice au fil des modules.

## Résultats mesurés
- `npm run typecheck` (backend) : 0 erreur.
- `npm test` (backend) : 247 tests, 247 réussis, 0 échec. Nouveau fichier : `tests/permissions.test.ts` (5 tests).
