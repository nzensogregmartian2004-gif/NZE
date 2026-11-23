# Étape F (suite) — Interfaces internes en quatre langues

## Décision appliquée
O-10 résolu : les interfaces internes (administration, partenaire, livreur) sont traduites dans les quatre langues, comme l'interface client.

## Ce qui change
- `nze-mobile/src/i18n/dictionnaire.ts` : 100 clés ajoutées dans chacune des quatre langues (392 → 492 clés par langue, parité conservée).
- `nze-mobile/src/lib/admin-entreprises.ts` : les libellés des statuts, des états du stock et des registres sont des clés de traduction, et non plus des textes français.
- Écrans réécrits ou traduits :
  - administration : stock, entreprises (identité, statut, accord commercial), registres, suivi des récupérations, produit (stock initial) ;
  - livreur : suivi des récupérations (statuts, actions, erreurs) ;
  - fiche collecte : motif minimum et erreur générale ;
  - saisie des écrans : les libellés dynamiques sont typés en `Cle`.

## Contrôles automatiques (mobile, `tests/i18n.test.ts`)
- Parité des clés entre les quatre langues.
- Aucun texte vide, variables `{…}` identiques dans toutes les langues.
- Toute clé `t('…')` de l'application existe dans le dictionnaire.
- Les libellés des écrans administrateur (statuts, états, registres, récupérations) existent dans toutes les langues.
- Détection de la langue du téléphone.

## Limites connues
- Les textes arabes et chinois ont été rédigés sans relecture de traducteur : relecture à faire (O-6).
- Les messages renvoyés par le serveur restent en français : à traduire côté serveur par code d'erreur (étape ultérieure).
- Les noms de langue « Français » et « English » (écran légal) restent dans leur propre langue, comme le veut l'usage.

## Résultats mesurés
- Mobile : typage 0 erreur ; tests 15 sur 15.
