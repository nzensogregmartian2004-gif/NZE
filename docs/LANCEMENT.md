# Mise en production — liste de contrôle

Document de référence pour la mise en production. Chaque ligne est un point bloquant tant qu'elle n'est pas cochée.

## 1. Configuration (Render, service `nze-api`)
- [ ] `APP_ENV` passé de `test` à `production` (`nze-backend/render.yaml`). **Action du fondateur, au jour du lancement uniquement.** Vérifié dans le code le 17 novembre 2026 : en production, l'API refuse de démarrer si la configuration est incomplète (tests `config-production-lot3`).
- [ ] `OTP_PROVIDER` : `console` est refusé en production (vérifié, testé). **Bloquant :** l'eSMS n'est pas encore branché ; tant que ce n'est pas fait, le renouvellement de mot de passe ne fonctionne pas en production (décision D-T4).
- [ ] `DATABASE_URL` : base Supabase de production, distincte de la base de test. **Action du fondateur.**
- [ ] `SESSION_SECRET` : généré par Render, jamais écrit dans le dépôt. Vérifié dans le code : au moins 32 caractères, sinon refus au démarrage. **À vérifier dans le tableau de bord Render.**
- [ ] Variables MyPVit (`MYPVIT_*`) : saisies dans Render, jamais dans le dépôt. Toutes les variables lues par le code sont déclarées dans le Blueprint (vérifié le 17 novembre 2026). Les valeurs de test ne vont jamais dans ce service de production. Vérifié dans le code : toutes obligatoires (refus au démarrage sinon) ; **la liste des IP des callbacks est désormais obligatoire en production** et chaque adresse doit être une IPv4 valide. **Action du fondateur :** saisir `MYPVIT_WEBHOOK_ALLOWED_IPS=176.31.65.18,176.31.65.20,176.31.65.21,13.59.249.167`.
- [ ] `GOOGLE_MAPS_API_KEY` : clé restreinte au serveur, saisie dans Render. Vérifié dans le code : exigée dès que `CARTOGRAPHIE=google`. **Action du fondateur.**
- [ ] Variables légales (`LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_CONTACT_EMAIL`) renseignées. Vérifié dans le code : contrôlées au démarrage en production (`server.ts`). **Action du fondateur :** valeurs réelles et validées par le juriste (O-5).

## 2. Secrets et dépôt
- [x] Aucun fichier `.env` ni secret dans le dépôt ou dans les livrables (contrôle effectué le 17 novembre 2026 : aucun).
- [ ] Clé MyPVit de production : confirmer qu'aucune clé n'a été exposée dans un échange ou un livrable ; si c'est le cas, la révoquer et en générer une nouvelle (point O-3).
- [ ] Clés Supabase, Cloudflare R2, Firebase, eSMS : fournies par le fondateur et saisies directement dans Render.

## 3. Base de données
- [ ] **Les migrations s'appliquent automatiquement au démarrage** (`startCommand` de `render.yaml`). Avant chaque mise en production, relire les nouvelles migrations : une migration destructive (suppression de tables ou de colonnes) doit être précédée d'une sauvegarde et d'une décision écrite.
- [ ] Sauvegarde avant mise en production : `DATABASE_URL=... bash nze-backend/scripts/sauvegarde.sh ./sauvegardes`. Les scripts existent ; `pg_dump` n'est pas disponible dans l'environnement de contrôle : **à exécuter par le fondateur.**
- [ ] Restauration testée sur une base vide : `DATABASE_URL_CIBLE=... bash nze-backend/scripts/restaure.sh fichier.dump`, puis `npm test` contre cette base. Une sauvegarde qui n'a pas été restaurée n'est pas une sauvegarde.

## Suivi du lot 3 (17 novembre 2026) — vérifications faites dans le code

- Healthcheck : `render.yaml` pointe vers `/sante`, la route existe (`nze-backend/src/app.ts`). Vérifié.
- CORS : aucun middleware CORS. L'API sert l'application mobile, pas un navigateur : aucune configuration requise. Vérifié.
- URL publique : aucune variable d'URL publique n'est utilisée par le serveur ; les adresses de callback MyPVit sont fixées par l'opérateur. Rien à configurer côté code.
- Blueprint : `APP_ENV: test` et `OTP_PROVIDER: console` restent en place jusqu'au lancement ; `TRUST_PROXY` n'est plus déclaré qu'une fois.
- Tests ajoutés : `nze-backend/tests/config-production-lot3.test.ts` (liste d'IP en production, IPv4 valides, secret de session, base de données, configuration complète acceptée).
- Restent à faire par le fondateur : bascule `APP_ENV` au lancement, saisie des variables dans Render, eSMS (bloquant), juriste (O-5), restauration de sauvegarde testée sur une base vide.

## 4. Tests
- [ ] `npm test` (backend) : toutes les suites vertes sur la version livrée.
- [ ] `npx tsc --noEmit` (backend et mobile) : zéro erreur.
- [ ] Tests sur téléphone réel de chaque parcours : client (achat, paiement, suivi, remise, réclamation, messagerie), partenaire (signalement de stock), livreur (collecte, remise), administrateur (validation, versement).

## 5. Application mobile
- [ ] Textes légaux (CGU, confidentialité) validés par un juriste (point O-5). Toute modification du texte peut exiger une nouvelle acceptation des utilisateurs.
- [ ] APK de preview : `npx eas build -p android --profile preview`, installé et testé sur un téléphone réel.
- [ ] Traductions arabes et chinoises relues par des traducteurs (point O-6).

## 6. Points de décision ouverts
- [ ] Lot 4 (MyPVit sandbox) : dossier de preuves à produire par le fondateur, voir `docs/SANDBOX-MYPVIT.md`. **Bloquant** pour tout encaissement réel.
- [ ] Frais MyPVit (D-AUD-2) : réponses de MyPVit requises avant d'afficher le montant final au client.
- [ ] O-12 : onglets tableau de bord et portefeuille du partenaire en phase 1 (masquer ou garder).
- [ ] Location de véhicules, publicité, prestataires : phase 2, hors lancement.

## 7. Après la mise en production
- [ ] Surveiller les tâches planifiées (alertes de retard, relances) : configurer le cron Render une fois le coût validé.
- [ ] Vérifier la première sauvegarde automatique et la première restauration de test dans la semaine.
