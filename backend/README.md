# NZE — Backend

API Express et TypeScript, base PostgreSQL (Drizzle), exécutée sans étape de compilation (`--experimental-strip-types`).

## Lancer

- Installation : `npm ci` (dans `backend/`).
- Développement : `npm run dev` (lit le fichier `.env` s'il existe).
- Production : `npm start` (applique les migrations au démarrage, puis lance le serveur).
- Vérification des types : `npm run typecheck`.
- Tests : `npm test` (suites d'intégration, base embarquée, aucun service externe).
- Migrations : `npm run db:migrate` ; génération : `npm run db:generate`.

## Tâches planifiées (Render Cron)

- `npm run job:relances` : relances des paiements échelonnés.
- `npm run job:alertes-retards` : alertes de retard des réclamations.
- `npm run job:rattrapage-paiements` : vérification des paiements restés en attente (toutes les 10 minutes).

## Configuration

Les valeurs ne sont jamais écrites dans le dépôt. Elles sont saisies dans Render ou dans un `.env` local non versionné.

- Serveur : `APP_ENV` (`development`, `test`, `production`), `PORT`, `DATABASE_URL`, `SESSION_SECRET` (32 caractères minimum), `OTP_PROVIDER` (`console` interdit en production), `TRUST_PROXY` (1 minimum en production).
- Légal (obligatoire en production) : `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_CONTACT_EMAIL`.
- MyPVit : `MYPVIT_BASE_URL`, `MYPVIT_PASSWORD`, `MYPVIT_AGENT`, `MYPVIT_PRODUCT`, `MYPVIT_CALLBACK_URL_CODE`, `MYPVIT_CODE_*` (un code par service), `MYPVIT_OPERATION_ACCOUNT_CODE` (compte par défaut) et `MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL`, `_MOOV`, `_CARD` (un compte par opérateur). Optionnels : `MYPVIT_RECEPTION_URL_CODE`, `MYPVIT_WEBHOOK_ALLOWED_IPS`, `MYPVIT_TIMEOUT_MS`, `MYPVIT_REDIRECT_SUCCESS_CODE`, `MYPVIT_REDIRECT_FAILURE_CODE`.
- Détail et valeurs de référence : `backend/src/config.ts`, `backend/src/modules/paiements/providers/mypvit/config.ts`, et la documentation `docs/paiements/MYPVIT-INTEGRATION.md`.

## Modules (`src/modules`)

- `admin`
- `audit`
- `auth`
- `cartographie`
- `catalogue`
- `collectes`
- `commandes`
- `echelonnement`
- `entreprises`
- `finance`
- `legal`
- `litiges-partenaire`
- `livraisons`
- `location` : vide, placeholder
- `messagerie`
- `notifications`
- `paiements`
- `parametres`
- `parcours`
- `publicite` : fiches des prestataires publicitaires administrées par NZE, et demandes des clients transmises à NZE (D-P6). Pas de réservation ni de compte prestataire.
- `reclamations`
- `retours` : vide, placeholder
- `stock`
- `suivi-partenaire`
- `support` : vide, placeholder

## Documentation

Référence active : `../docs/LIRE-EN-PREMIER.md`. Les anciens documents sont dans `../docs/archive/`.
