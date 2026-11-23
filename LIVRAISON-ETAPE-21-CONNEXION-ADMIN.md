# Livraison — correctif : connexion de l'administrateur de démonstration

Date : 19 novembre 2026.

## Constat

Le compte administrateur de démonstration (+24101000001) pouvait exister sans mot de passe, selon la version du démarrage local avec laquelle la base a été créée. L'écran de connexion refusait alors toute connexion.

## Correction

`nze-backend/scripts/donnees-demo.ts` : à chaque démarrage local, le script vérifie que l'administrateur de démonstration a un rôle d'administration, puis lui affecte le mot de passe de démonstration s'il n'en a pas. Il ne modifie jamais un mot de passe déjà défini.

## Vérification

1. Démarrage normal : les données de démonstration sont en place, connexion de l'administrateur 200.
2. Simulation : mot de passe de l'administrateur retiré en base pendant que le serveur tourne.
3. Redémarrage : le script rétablit le mot de passe, connexion de l'administrateur 200.

## Pour vous

Arrêtez le serveur (Ctrl+C), relancez `npm run demarrage:local` dans `nze-backend/`, puis connectez-vous sur l'application :
- téléphone : +24101000001
- mot de passe : demo-nze-2026 (valable uniquement en local)

## Rapport de passation

```
Correctif : connexion de l'administrateur de démonstration
Fichiers modifiés : nze-backend/scripts/donnees-demo.ts, docs/GUIDE-TEST-LOCAL.md, docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md
Migrations : aucune
Vérifications : reproduction (mot de passe retiré), redémarrage, connexion 200 ; typecheck backend 0 erreur
```
