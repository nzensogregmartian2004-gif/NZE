# Écrans d'administration : entreprises, stock, registres

## Écrans ajoutés (mobile, espace administrateur)
- **Entreprises** (`nze-mobile/app/(admin)/entreprises.tsx`) : liste, identité et responsable (`PATCH /admin/entreprises/:id`), changement de statut (`PATCH /admin/entreprises/:id/statut`, le serveur valide le passage), nouvel accord commercial (`POST /admin/commissions` : commission, date d'effet, durée, conditions, document).
- **Stock** (`nze-mobile/app/(admin)/stock.tsx`) : choix d'un article, passage à DISPONIBLE, COLLECTE, INDISPONIBLE ou À CONFIRMER (`PATCH /admin/produits/:id/etat-stock`), tracé dans l'historique.
- **Registres** (`nze-mobile/app/(admin)/registres.tsx`) : totaux par registre (CLIENT, COMMISSIONS, PARTENAIRE) et dernières écritures, filtrables.

## Backend ajouté
- `GET /admin/ecritures?registre=&limite=` : totaux par registre et écritures. Permission `ecritures.consulter` (matrice `nze-backend/src/core/permissions.ts`), consultation seule.
- Tests : `nze-backend/tests/registres-admin.test.ts` (4 tests).

## Aides de saisie (mobile)
- `nze-mobile/src/lib/admin-entreprises.ts` : conversion du pourcentage en points de base (refus hors 0–100), date AAAA-MM-JJ (refus des dates inexistantes), libellés.
- Tests : `nze-mobile/tests/admin-entreprises.test.ts` (4 tests).

## Limites connues
- Les écrans d'administration sont en français, sans passage par le système de traduction : l'internationalisation de l'espace administrateur relève de l'étape F.
- L'identité ne peut pas encore être relue depuis l'application : le serveur n'expose pas le détail d'une entreprise. Les champs se saisissent sans valeur pré-remplie.
- Les onglets sont désormais au nombre de onze ; le regroupement de la navigation administrateur est à concevoir avec le tableau de bord (reporté, décision D-P11).

## Résultats mesurés
- Backend : typage 0 erreur ; tests 251 sur 251.
- Mobile : typage 0 erreur ; tests 10 sur 10.
