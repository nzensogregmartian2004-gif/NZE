# 03 — Architecture et technique

## 1. Stack retenue

| Couche | Choix | Remarque |
|---|---|---|
| Application mobile | React Native avec Expo (Android et iOS), Expo Router | Build de test : `eas build -p android --profile preview` |
| API | Node.js (22.6 ou plus, `--experimental-strip-types`), Express, TypeScript | Hébergée sur Render (`backend/render.yaml`) |
| Base de données | PostgreSQL chez Supabase | Migrations Drizzle |
| ORM | Drizzle | Prisma écarté |
| Authentification | Module propre : téléphone et mot de passe. Sessions avec jetons hachés. | Pas Supabase Auth |
| Temps réel | Supabase Realtime | Socket.IO non retenu. Pas encore branché. |
| Fichiers et médias | Cloudflare R2 | Pas encore branché. |
| Notifications push | Firebase (API HTTP v1) | Pas encore branché. |
| SMS | eSMS Afrique, uniquement pour renouveler un mot de passe | Documentation et clé de test à obtenir |
| Paiement | MyPVit (Mobile Money et carte) | Intégration existante, à valider en réel (étape E) |

## 2. Dépôt

```
NZE/
├── backend/                 API, base et tests
│   ├── src/
│   │   ├── app.ts, server.ts, config.ts
│   │   ├── core/            sécurité, journalisation
│   │   ├── db/              schéma (schema.ts), migrations, migrate.ts
│   │   ├── jobs/            relances, alertes de retard
│   │   ├── modules/         un dossier par domaine (voir section 3)
│   │   └── realtime/        vide : à construire avec Supabase Realtime
│   ├── tests/               tests d'intégration (node --test)
│   └── render.yaml, drizzle.config.ts, .env.example
├── mobile-nze/              application Expo
│   ├── app/                 écrans (routes Expo Router)
│   └── src/                 api, auth, components, features, hooks, i18n, lib, realtime, store, theme
├── docs/                    documentation (ce dossier)
│   ├── reference/           cahier des charges V3.0
│   └── archive/             anciens documents, obsolètes
```

## 3. Modules backend

Colonne « Tests » mise à jour le 17 novembre 2026 : tous les modules de la suite sont **verts** (372 réussis sur 372). **Aucun test dédié** ou **dossier vide** (`.gitkeep` seul, à construire) restent indiqués tels quels.

| Module | Tests | Note |
|---|---|---|
| auth | verts | Inscription sans OTP ; OTP réservé au renouvellement de mot de passe (D-T4) |
| admin | verts | Droits par rôle ; tableau de bord reporté (D-P11) |
| audit | verts | Journal des actions |
| cartographie | verts | |
| catalogue | verts | Catégories, fiche produit ; garanties et variantes à compléter |
| collectes | verts | Bordereaux, collecte, anomalies |
| commandes | verts | Sous-commandes multi-partenaires à compléter |
| echelonnement | verts | **À désactiver par configuration** (D-P7) |
| entreprises | dossier vide | **À construire** (lot 1.2) |
| finance | verts | Répartition, retraits ; grand livre et écritures séparées à compléter |
| legal | verts | Textes de travail ; validation juridique à faire (O-5) |
| litiges-partenaire | verts | |
| livraisons | verts | Preuve de remise sans OTP |
| location | dossier vide | **À construire** : location journalière (D-P3) |
| messagerie | verts | Liée à l'article ; temps réel Supabase à brancher |
| notifications | verts | Textes à traduire (quatre langues) |
| paiements | verts | MyPVit ; essais réels à faire (étape E) |
| parametres | verts | Point fixe NZE, réglages |
| parcours | verts | Parcours client |
| publicite | verts (9 tests) | Fiches prestataires et demandes (D-P6) ; publicité payante et carrousel : phase 2 (D-P3) |
| reclamations | verts | Réclamations et support de base |
| retours | dossier vide | **À construire** (retours et remboursements) |
| stock | verts | Réservation au paiement, vente, libération (`reservation-stock.test.ts`) ; mouvements historisés (D-F12) |
| suivi-partenaire | verts | Résumé et détail des collectes |
| support | dossier vide | Fonctions dans réclamations ; priorités, responsables, notes internes à construire (O-7) |

Les modules retirés (restaurants, hébergements, taxi, abonnements) ne sont plus dans le backend. Les anciennes migrations correspondantes sont dans `archive-migrations-chaine-B/`.

## 4. Migrations

- Une seule chaîne active : `backend/src/db/migrations`, de `0000` à `0027`.
- Le snapshot Drizzle doit correspondre au schéma. Un test vérifie cette correspondance ; il réussit (mesure du 17 novembre 2026).
- Toute migration nouvelle : un seul fichier numéroté, ajouté au journal, jamais de modification d'une migration déjà appliquée.
- Aucune suppression de données sans sauvegarde et migration explicitement justifiée. Préférer l'archivage.
- Commande : `npm run db:migrate` (lit `.env` ou les variables d'environnement).

## 5. Configuration et secrets

- Modèle : `backend/.env.example`. Aucune valeur réelle dans le dépôt.
- `.env` interdit dans les livrables. Les secrets sont saisis dans l'environnement Render.
- Variables obligatoires en production : base, secrets JWT, `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS`, `LEGAL_CONTACT_EMAIL` (le serveur refuse de démarrer sans elles).
- Intégrations sans clé : mode console (OTP, notifications), jamais d'envoi réel ni de paiement simulé en production.

## 6. Tests et vérifications

| Vérification | Commande | Résultat au 13 novembre 2026 |
|---|---|---|
| Typage backend | `npm run typecheck` (dans `backend/`) | 0 erreur |
| Tests backend | `npm test` (dans `backend/`) | 413 tests réussis sur 413 (mesure du 19 novembre 2026, étape 20) |
| Typage mobile | `npx tsc --noEmit` (dans `mobile-nze/`) | 0 erreur (mesure du 17 novembre 2026) |
| Tests mobile | `npm test` (dans `mobile-nze/`) | 26 tests réussis sur 26 (mesure du 16 novembre 2026) |

Règle : un résultat n'est annoncé qu'après exécution. Le LIRE-MOI de chaque livraison indique la commande et le résultat exact.

## 7. Historique et conservation

- Aucune suppression silencieuse : une donnée retirée est archivée, puis supprimée seulement sur décision écrite.
- Les opérations historiques restent consultables après désactivation d'un compte.
- Les ajustements financiers sont des écritures nouvelles.
