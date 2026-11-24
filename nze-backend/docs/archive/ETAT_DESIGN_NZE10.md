> **OBSOLÈTE — archive.** Ce document n'est plus une référence. Utiliser `docs/LIRE-EN-PREMIER.md` et les documents 01 à 05. Conservé uniquement pour l'historique.

# Design system unifié (NZE 10)

## Ce qui a changé

**Un seul système de design.** Le point d'entrée est `src/theme/index.ts`, qui réexporte :

- `src/theme/couleurs.ts` : la palette (`couleurs`, `ColorToken`)
- `src/theme/espaces.ts` : espacements (`espaces`), rayons (`rayons`), tailles de composants (`tailles`), ombre (`shadow`)
- `src/theme/typography.ts` : polices et styles de texte (`typography`, `TypographyToken`), inchangé

Supprimés : `src/theme/colors.ts` et `src/theme/spacing.ts`, dont le contenu a été repris dans les fichiers ci-dessus.

Le choix de la palette : le nouveau système (`couleurs`) est celui des écrans conservés (administration, partenaire, livreur, onglets, authentification, réclamations). Les usages de l'ancien système (`colors`, `spacing`, `radius`) ont été convertis vers lui.

## Correspondance appliquée

| Ancien | Nouveau |
|---|---|
| `colors.primary` | `couleurs.violet` |
| `colors.primaryTint`, `primarySoft` | `couleurs.violetClair` |
| `colors.primaryMuted`, `primaryDark`, `primaryDeep` | `couleurs.violetFonce` |
| `colors.ink` | `couleurs.texte` |
| `colors.inkSoft`, `inkFaint` | `couleurs.texteSecondaire` |
| `colors.line` | `couleurs.bordure` |
| `colors.bg` | `couleurs.fond` |
| `colors.white` | `couleurs.blanc` |
| `colors.success`, `successTint` | `couleurs.succes`, `succesClair` |
| `colors.warning`, `warningTint` | `couleurs.avertissement`, `avertissementClair` (ajoutés) |
| `colors.danger`, `dangerTint` | `couleurs.danger`, `dangerClair` |
| `spacing.xs`, `sm`, `md`, `lg`, `xl` | `espaces.xs`, `s`, `m`, `l`, `xl` |
| `radius.sm`, `md`, `lg`, `full` | `rayons.s`, `m`, `l`, `pilule` |

## Changements visibles à valider sur téléphone

- **Succès et danger** : plus foncés que dans l'ancien système (succès `#1F7A4D` au lieu de `#1FA971`, danger `#B42318` au lieu de `#DC3545`).
- **Coins** : légèrement plus arrondis pour les rayons `m` et `l` (12 et 16 px au lieu de 10 et 14 px).
- **Violet** : écart négligeable (`#7B2DE7` au lieu de `#7A2AE3`).

## Dépendances ajoutées

Importées depuis longtemps sans être déclarées : `zustand` (^5.1.0), utilisé par les stores panier et authentification, et `socket.io-client` (^4.8.4), utilisé par le temps réel. Les versions sont celles de l'installation courante.

## Résultats mesurés

- Erreurs TypeScript mobiles : **294 → 13**.
- Erreurs liées au design : **0** (aucun `colors.`, `spacing.`, `radius.` restant).
- Bundle Android (`expo export`) : compilé sans erreur.

## Erreurs restantes (13), à traiter aux étapes suivantes

**Taxi (domaine exclu, étape 2) : 8 erreurs.** `app/ride-request.tsx`, `app/ride/[id].tsx`, `app/dashboard/driver.tsx`. Les fonctions `createRide`, `listMyRides`, `cancelRide` et les constantes de `mobility-api` n'existent plus côté backend.

**Remboursements (étape 3) : 5 erreurs.** `app/admin/refunds.tsx`, `app/dashboard/refunds.tsx`. Ces écrans attendent des fonctions absentes de `refunds-api.ts` (`listAdminRefunds`, `confirmRefund`, `listStoreRefunds`, `decideRefund`, le type `RefundDecision`). Avant de les réparer, vérifier que le backend expose bien ces routes.
