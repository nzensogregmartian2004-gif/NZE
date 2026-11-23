# Livraison — Étape 15 : finitions de l'échéancier et vue commerçant unique

Date : 17 novembre 2026. Décision appliquée : **D-ECH-11** (à confirmer par écrit). Points : **O-24** (appliqué, à confirmer), **O-27** (clos), **O-31** (ouvert).

## 1. Objectif

Deux finitions annoncées (présentation du reste d'un mois partiel ; une seule vue commerçant), et la correction d'un défaut trouvé pendant la revue : la vue commerçant de l'étape 13 comptait le brut payé par le client, et non la part qui revient au commerçant.

## 2. Ce qui change

**Vue commerçant (serveur)**
- `GET /partenaire/echelonnements` est la seule vue du commerçant. Pour chaque plan : `commercantEncaisseFcfa` et `commercantAVerserFcfa` (part réelle, après commission) et `echeancesArticles` (détail par article).
- Le détail par article donne le reste en principal, le nombre de mois validés, partiels et en retard. Aucune pénalité, aucune identité de client.
- `GET /partenaire/echeanciers` est retirée.

**Client (application)**
- Chaque mois affiche « Reste à payer : X FCFA (sur Y FCFA) » : le reste à payer et le total du mois.

**Commerçant (application)**
- La section « Échéances » de l'historique affiche la part encaissée et à verser de chaque plan, puis le détail de chaque article.

## 3. Fichiers

- **Modifiés** : `nze-backend/src/modules/echelonnement/echeances.ts` (détail par article, remplace la vue retirée), `nze-backend/src/modules/echelonnement/service.ts` (vue par plan enrichie), `nze-backend/src/modules/echelonnement/routes.ts` (route retirée), `nze-backend/tests/vue-commercant.test.ts`, `nze-mobile/app/echeancier/[id].tsx`, `nze-mobile/app/(partenaire)/historique.tsx`, `nze-mobile/src/i18n/dictionnaire.ts`, `nze-mobile/tests/echeancier.test.ts`, `docs/01-DECISIONS.md`, `docs/03-TECHNIQUE.md`, `docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md`.
- **Ajoutés** : `LIVRAISON-ETAPE-15-FINITIONS.md`.
- **Supprimés** : la route `GET /partenaire/echeanciers`.

Aucune migration. Aucune dépendance nouvelle.

## 4. Commandes exécutées et résultats

| Vérification | Commande | Résultat |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `nze-backend/`) | 0 erreur |
| Tests vue commerçant et échelonnement | `node --test` sur `vue-commercant` et `echelonnement` | 18 réussis sur 18 |
| Tests backend | `npm test` (dans `nze-backend/`) | **409 réussis sur 409** |
| Typage mobile | `npx tsc --noEmit` (dans `nze-mobile/`) | 0 erreur |
| Tests mobile | `npm test` (dans `nze-mobile/`) | **38 réussis sur 38** |

Le test de la vue commerçant vérifie désormais la part réelle : 5 100 FCFA encaissés et 3 400 FCFA à verser sur un plan de 10 000 FCFA après commission, avec 4 000 FCFA de principal restant et un mois validé.

Non fait ici : essai sur base Supabase réelle et sur téléphone.

## 5. Essais à faire

1. Commerçant : l'historique, section « Échéances », affiche la part encaissée et à verser de chaque plan, et le détail par article.
2. Client : un mois partiel affiche le reste à payer et le total du mois.
3. Vérifier qu'aucun nom ni numéro de client n'apparaît dans la vue commerçant.

## 6. Risques et points ouverts

- **O-24** : libellé appliqué, à valider.
- **O-31** : « à échéance » et « en retard » dans la vue par plan reposent encore sur l'ancienne situation, approximative pour un panier aux durées différentes.
- **Chiffre de l'étape 13** : la vue du commerçant affichait le brut. Si des commerçants ont déjà consulté cette vue, ils doivent être prévenus de la correction.

## 7. Rapport de passation — Étape 15

```
RAPPORT DE PASSATION — Étape 15
Date : 17 novembre 2026
Objectif livré : vue commerçant unique et part réelle ; reste à payer du mois côté client
Décision appliquée : D-ECH-11 (à confirmer par écrit)
Points : O-24 (appliqué, à valider), O-27 (clos), O-31 (ouvert)
Fichiers modifiés / ajoutés / supprimés : voir section 3
Migrations : aucune
Routes / permissions / événements : GET /partenaire/echelonnements enrichie ; GET /partenaire/echeanciers retirée
Tests exécutés : backend typecheck 0 erreur, npm test 409/409 ; mobile typecheck 0 erreur, npm test 38/38
Ce qui n'est pas fait : essai Supabase réel, essai téléphone, calcul par article des alertes par plan (O-31)
Proposition de l'étape suivante : étape 16 — recalcul des alertes par plan à partir du calcul par article (O-31), puis tests de bout en bout sur la base réelle
```
