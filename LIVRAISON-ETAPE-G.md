# Étape G — Préparation de la mise en production

## Livré
- `docs/LANCEMENT.md` : liste de contrôle en sept volets (configuration, secrets, base de données, tests, application mobile, décisions ouvertes, après mise en production).
- `nze-backend/scripts/sauvegarde.sh` et `nze-backend/scripts/restaure.sh` : sauvegarde au format custom et restauration dans une base vide. Ces scripts n'ont pas pu être exécutés dans l'environnement de travail (pg_dump absent) : à tester avant le lancement, comme l'indique la liste de contrôle.
- `nze-backend/render.yaml` : avertissement ajouté sur `APP_ENV`, qui doit passer de `test` à `production` au lancement. Les gardes de production existantes refusent le démarrage si la configuration est incomplète (notamment `OTP_PROVIDER=console`).
- Historique par dossier de réclamation : `GET /admin/reclamations/:id/historique` (actions journalisées sur le dossier, avec leur auteur). Réservé à l'administration. 2 tests.

## Constats
- Les migrations sont appliquées automatiquement au démarrage : une migration destructive doit être relue avant chaque mise en production.
- Aucun fichier `.env` ni clé de production dans le dépôt.

## Non fait ici (dépend de tiers ou de décisions)
- Interface administrateur de l'historique (mobile).
- Tests sur téléphone réel, APK de preview.
- Validation juridique, relecture des traductions arabe et chinoise.
- Location de véhicules, publicité, prestataires (phase 2).

## Résultats mesurés
- Backend : typage 0 erreur ; tests 273 sur 273.
- Mobile : inchangé depuis la dernière livraison (typage 0 erreur ; tests 15 sur 15).
