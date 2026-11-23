# Procédure de mise en production — NZE

Date : 17 novembre 2026. Décision : **D-PROD-1**. Statut : **NON PRÊT** tant que les points bloquants de la section 2 ne sont pas fermés.

Aucune valeur secrète n'est écrite dans ce document. Les valeurs se saisissent uniquement dans le tableau de bord Render (variables d'environnement) ou dans Supabase. Ne les collez jamais dans un message, un ticket ou un journal.

## 1. Règle

Aucun déploiement en production sans un passage préalable sur une base de préproduction (point O-32), et sans fermeture des points bloquants ci-dessous.

## 2. Points bloquants

| Point | Attendu |
|---|---|
| O-32 | Parcours complet joué sur une base de préproduction, avec les migrations 0000 à 0027. |
| Identifiants compromis | Révoquer le jeton Cloudflare R2 dont les identifiants ont été écrits dans une discussion, et confirmer la révocation de la clé MyPVit de production (O-3). Générer de nouveaux secrets dans Render. |
| O-19 | Projet Firebase, clé de service et `google-services.json` pour l'application Android. Sans eux, aucune notification push n'est envoyée. |
| Décisions validées par écrit | D-ECH-3 à D-ECH-12, D-STOCK-2, D-PUSH-1 à D-PUSH-3, D-CMD-1, D-CARTE-1, D-COL-1, D-COL-2, D-PART-1. |
| O-22 à O-31 | Chaque point traité ou explicitement accepté. |
| O-25, O-26 | Fuseau et heure des rappels vérifiés (relance quotidienne à 08 h UTC, soit 09 h à Libreville). |
| O-29 | Retour de la page de paiement carte vérifié sur téléphone. |
| O-18 | Retrait partenaire par carte : laissé fermé tant que MyPVit n'a pas confirmé par écrit. |

## 3. Variables d'environnement

Noms seulement. Les valeurs sont dans Render et Supabase.

| Nom | Rôle | Secret |
|---|---|---|
| `APP_ENV` | Environnement (production) | non |
| `PORT` | Port d'écoute | non |
| `DATABASE_URL` | Connexion à la base (Supabase) | **oui** |
| `SESSION_SECRET` | Signature des sessions | **oui** |
| `OTP_PROVIDER` | Fournisseur des codes de connexion | non |
| `TRUST_PROXY` | Confiance accordée au proxy (Render) | non |
| `RECUPERATION_ASSISTEE` | Récupération de compte assistée | non |
| `NODE_VERSION` | Version de Node utilisée par Render | non |
| `MYPVIT_BASE_URL`, `MYPVIT_AGENT`, `MYPVIT_PRODUCT` | Accès à MyPVit | non |
| `MYPVIT_PASSWORD`, `MYPVIT_CODE_SECRET` | Authentification MyPVit | **oui** |
| `MYPVIT_CALLBACK_URL_CODE`, `MYPVIT_RECEPTION_URL_CODE`, `MYPVIT_REDIRECT_SUCCESS_CODE`, `MYPVIT_REDIRECT_FAILURE_CODE` | Adresses de retour MyPVit | non |
| `MYPVIT_CODE_BALANCE`, `MYPVIT_CODE_COUNTRIES`, `MYPVIT_CODE_FEES`, `MYPVIT_CODE_LINK`, `MYPVIT_CODE_OPERATORS`, `MYPVIT_CODE_PAYMENT`, `MYPVIT_CODE_QRCODE`, `MYPVIT_CODE_STATUS` | Opérations MyPVit | non |
| `MYPVIT_OPERATION_ACCOUNT_CODE`, `MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL`, `MYPVIT_OPERATION_ACCOUNT_CODE_MOOV` | Comptes de versement (Airtel, Moov) | non |
| `MYPVIT_OPERATION_ACCOUNT_CODE_CARD` | Compte de versement carte (inactif, voir O-18) | non |
| `MYPVIT_TIMEOUT_MS`, `MYPVIT_WEBHOOK_ALLOWED_IPS` | Délai et adresses autorisées des notifications | non |
| `GOOGLE_MAPS_API_KEY` | Calcul des distances de livraison | **oui** |
| `CARTOGRAPHIE` | Service de cartographie | non |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Clé de service Firebase (push, O-19) | **oui** |

Modèle sans valeurs : `backend/.env.example`.

## 4. Sauvegarde avant déploiement

1. Sauvegarde complète de la base Supabase (sauvegarde planifiée ou instantanée), à noter avec son horodatage.
2. Vérifier qu'une restauration sur une base de test fonctionne, avant le déploiement.
3. Exporter la configuration Render (liste des variables, sans valeurs).

## 5. Migrations

Elles s'exécutent au démarrage (`npm run db:migrate` dans la commande de démarrage de `nze-api`). Elles sont enregistrées et ne se rejouent pas.

| Migration | Nature |
|---|---|
| 0013 | Suppression de colonnes (OTP de livraison) : **destructive**. Relire le fichier avant déploiement. |
| 0020 à 0027 | Ajouts de colonnes, de tables ou de contraintes ; une modification de défaut (0022) et une modification de nullabilité (0023). Additives. |

Les autres migrations ont été relues à leur étape. Dans tous les cas, la sauvegarde de la section 4 est obligatoire.

## 6. Déploiement pas à pas

1. Fusionner la version validée sur la branche de production.
2. Render construit `nze-api` et lance `npm run db:migrate` puis le serveur.
3. Vérifier `GET /sante` (réponse attendue : service opérationnel).
4. Vérifier dans les journaux de démarrage que les migrations sont appliquées sans erreur.
5. Vérifier les tâches planifiées (section 7) : au moins une exécution sans erreur dans les journaux de chacune.
6. Smoke test en lecture seule : connexion d'un compte de test, lecture d'un catalogue, lecture d'un plan de test. Aucune commande ni paiement réel.
7. Construire l'application mobile de production (builds EAS), une fois O-19 fermé pour Android.

## 7. Tâches planifiées

| Tâche | Fréquence (UTC) | Rôle |
|---|---|---|
| `nze-relances-quotidiennes` | 08 h 00 chaque jour (09 h à Libreville) | Rappels, alertes et retards d'échéance ; pénalités |
| `nze-alertes-retards` | chaque heure | Dossiers de réclamation en retard |
| `nze-push-notifications` | toutes les 2 minutes | Envoi push (sans effet sans `FIREBASE_SERVICE_ACCOUNT_JSON`) |
| `nze-rattrapage-paiements` | toutes les 10 minutes | Vérification des paiements en attente |

Coût Render de la tâche push (toutes les 2 minutes) : à valider avec le fondateur.

## 8. État par défaut en production

- Paiement échelonné : **désactivé** (`echelonnement_actif` à faux) tant que le fondateur ne l'active pas.
- Retrait partenaire par carte : **fermé** (`RETRAIT_CARTE_DISPONIBLE = false`).
- Push iOS : **désactivé** (`PUSH_IOS_ACTIF = false`).
- Push Android : **inactif** tant que `FIREBASE_SERVICE_ACCOUNT_JSON` est absent.
- Réglages d'échelonnement : acompte 40 %, durée 3 mois, pénalité 10 000 FCFA par mois, sauf modification par l'administrateur principal.

## 9. Vérifications après déploiement

- Aucune erreur dans les journaux pendant une heure.
- Les tâches planifiées s'exécutent à l'heure prévue.
- Aucune notification envoyée à un mauvais destinataire (contrôle sur un compte de test).
- Les totaux des commerçants et des plans correspondent à ceux de la préproduction.

## 10. Retour arrière

1. Revenir à la version précédente sur Render (redéploiement du commit précédent).
2. Si une migration a modifié les données : restaurer la sauvegarde de la section 4. Les migrations ajoutées ne sont pas réversibles automatiquement ; la restauration est le seul chemin sûr.
3. Prévenir le fondateur et consigner l'incident dans le journal de livraison.
