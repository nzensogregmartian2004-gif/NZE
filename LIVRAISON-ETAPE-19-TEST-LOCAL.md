# Livraison — Étape 19 : test local de l'application

Date : 19 novembre 2026. Demande : pouvoir tester l'application maintenant ; la rotation des identifiants sera faite plus tard, à votre rythme.

## 1. Ce qui a été fait

- **Démarrage local** (`nze-backend/scripts/demarrage-local.ts`, commande `npm run demarrage:local`) : Postgres local persistant, migrations, compte administrateur de test, puis le vrai serveur (`src/server.ts`). Les valeurs factices sont locales et ne servent qu'à faire démarrer le serveur.
- **Serveur réel vérifié** : `/sante` 200 ; inscription 201 (avec jeton) ; connexion par mot de passe 200 ; catalogue public 200.
- **Application mobile** : bundle Android compilé sans erreur (2,4 Mo) ; typage et tests verts (38/38).
- **Guide de test** (`docs/GUIDE-TEST-LOCAL.md`) : démarrage, connexion de l'application à l'API locale, comptes de test, parcours à tester, ce qui ne marche pas en local et pourquoi.

## 2. Ce que vous pouvez tester maintenant

Suivre `docs/GUIDE-TEST-LOCAL.md`, sections 3 à 6 : inscription, commande, administration des articles et des étapes, historique du commerçant, paiement échelonné et échéancier, alerte de stock faible, relances.

## 3. Limites connues en local

- Paiements MyPVit : pas de réseau vers MyPVit ; un paiement reste en attente.
- Distances : estimation locale.
- Push et SMS : non actifs (O-19 et SMS non branchés).
- Un compte administrateur sans mot de passe : à définir depuis l'administration ou par la récupération de mot de passe.

## 4. Ce qui reste pour la production (à votre rythme)

- Rotation des identifiants (`docs/ROTATION-IDENTIFIANTS.md`) : vous avez indiqué que ce sera fait avant la production.
- Firebase (O-19) : nécessaire pour le push.
- Préproduction (O-32) : parcours complet sur une base de préproduction.
- Validations écrites des décisions.

## 5. Vérifications de cette étape

| Vérification | Résultat |
|---|---|
| Démarrage du serveur réel | OK : `/sante` 200 |
| Inscription, connexion, catalogue | OK : 201, 200, 200 |
| Bundle Android de l'application | OK |
| Tests backend | 412 réussis sur 412 |
| Tests application | 38 réussis sur 38 |

## 6. Rapport de passation — Étape 19

```
RAPPORT DE PASSATION — Étape 19
Date : 19 novembre 2026
Objectif livré : test local de l'application (serveur réel, base locale, bundle Android, guide)
Fichiers ajoutés / modifiés : nze-backend/scripts/demarrage-local.ts, nze-backend/package.json (script), docs/GUIDE-TEST-LOCAL.md, docs/04-ETAT-ET-FEUILLE-DE-ROUTE.md, LIVRAISON-ETAPE-19-TEST-LOCAL.md
Migrations : aucune
Vérifications : serveur réel (santé, inscription, connexion, catalogue), bundle Android, backend 412/412, application 38/38
Ce qui reste : test manuel sur téléphone (vous), rotation des identifiants (vous), Firebase (O-19), préproduction (O-32)
Proposition : tests manuels guidés, puis correction des anomalies trouvées, avant la rotation et la production
```
