> **OBSOLÈTE — archive.** Ce document n'est plus une référence. Utiliser `docs/LIRE-EN-PREMIER.md` et les documents 01 à 05. Conservé uniquement pour l'historique.

# Décisions appliquées et état (NZE 9)

## Décisions appliquées dans le code

1. **OTP de livraison retiré.** Le client ne reçoit plus de code de remise. La preuve de remise est la signature papier confirmée par le livreur. Le code, sa vérification, son effacement et son exposition ont été supprimés. Migration `0013_suppression_otp_livraison` : suppression des colonnes `code_livraison` et `tentatives_code`.

2. **Module légal réintégré.** Routes publiques `GET /legal` et `GET /legal/:slug` (français et anglais), route authentifiée `POST /legal/accept`. Migration `0014_legal_acceptance` : colonnes `users.conditions_version` et `users.conditions_acceptees_le`. Les textes sont un **texte de travail** : ils doivent être validés par un juriste avant publication.
   - En production, `LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_ADDRESS` et `LEGAL_CONTACT_EMAIL` sont obligatoires : le serveur refuse de démarrer sans elles.
   - Les appels mobiles `/legal/...` sont désormais servis par le backend.

## Décision à consigner (conflit avec novembre)

3. **Retrait : le commerçant déclenche le retrait.** La route `POST /partenaire/retraits` est conservée. Cela contredit la décision de novembre (commerçant en lecture seule, versement manuel par l'administrateur principal). Le document de décisions doit être mis à jour, sinon il contredit le code.

## Actions de ton côté

4. **Chaîne de migrations en base.** Dans le shell de la base Render ou de test, exécuter :
   ```sql
   select count(*) from drizzle.__drizzle_migrations;
   select tablename from pg_tables where schemaname = 'public' and tablename in ('lodgings', 'restaurant_profiles', 'service_profiles');
   ```
   - Un nombre de 13 (ou 15 après cette version) avec aucune table ci-dessus : chaîne active, rien à faire de plus.
   - Un nombre de 26 ou des tables `lodgings` / `restaurant_profiles` présentes : la chaîne B est appliquée, il faut en parler avant tout déploiement.
   - Après cette version, `npm run db:migrate` applique 0013 et 0014 sur une base à jour de la chaîne active.

5. **Cloudflare R2, Firebase, Supabase Realtime** (intégrations voulues). Je ne peux pas créer les comptes. Il me faut :
   - R2 : identifiant de compte, nom du bucket, clé d'accès et clé secrète (ou jeton API), domaine public.
   - Firebase : projet, et le fichier JSON du compte de service (envoi via l'API HTTP v1).
   - Supabase : URL du projet et clé publique (anon).
   Chaque intégration sera derrière la configuration, avec un mode console par défaut, comme l'OTP.

## Résultats mesurés

- Typage backend : voir la sortie de contrôle (0 erreur attendue).
- Suite backend : 223 tests, 208 réussis, 15 échecs. Les 15 échecs sont préexistants : `collectes` (9), `livraisons` (2), `notifications` (1), `schema-migrations` (1), `suivi-partenaire` (2).
- Nouveaux tests : `legal` (4), `legal-acceptation` (2). Tests de remise réécrits pour la signature papier seule. La matrice des droits déclare les deux routes légales publiques.
- Mobile : non modifié. 294 erreurs TypeScript persistent (`@/theme`, doublons, écrans exclus).

## Reste à faire (ordre de priorité)

1. Chaîne de migrations en base (point 4), puis snapshot de référence de la chaîne active.
2. Mobile : un seul design system (`couleurs`, `espaces`, `rayons`, `tailles`), 294 erreurs TypeScript.
3. Mobile : supprimer les 8 doublons d'écrans et les écrans des domaines exclus.
4. Tests en échec : `collectes` (format `produitId` / `ligneCommandeId`), `livraisons` (anomalie de qualité, tableaux de bord), `notifications`, `suivi-partenaire`.
5. Retrait commerçant : mettre à jour le document de décisions (point 3).
6. Réclamations : notes internes, historique par dossier, alerte automatique des retards, traduction des notifications.
7. Intégrations R2, Firebase, Realtime (point 5), puis MyPVit validé en réel.
8. Promotions (§8.4), SKU, recherche administrative globale, support §17.2 complet.
9. Validation juridique des textes légaux, APK de test, tests sur appareil.
