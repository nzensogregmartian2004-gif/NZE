> **OBSOLÈTE — archive.** Ce document n'est plus une référence. Utiliser `docs/LIRE-EN-PREMIER.md` et les documents 01 à 05. Conservé uniquement pour l'historique.

# État après suppression — NZE (base 8)

Date : 5 novembre 2026. Tous les chiffres sont mesurés sur ce dossier, pas recopiés de l'audit.

## 1. La suppression était-elle nécessaire ?

Oui, avec trois réserves.

- **`backend/.env`** : livré dans le zip alors que `.gitignore` l'exclut. Supprimé. Il ne contenait qu'une variable mobile, mais un fichier d'environnement ne doit jamais partir dans une archive.
- **155 fichiers TypeScript listés** : aucun n'est atteignable depuis le serveur, les jobs ou la migration (analyse des imports). 10 ne servaient qu'à des tests que `npm test` n'exécute pas, 145 n'étaient importés par personne. Supprimés.
  - Effet mesuré : typage backend **140 erreurs → 0**.
  - Suite de tests inchangée (217 tests, 202 réussis, 15 échecs) : aucun test ne dépendait de ces fichiers.
- **Chaîne B de migrations** (26 fichiers SQL, 25 snapshots) : **non exécutée**. Le journal `_journal.json` ne référence que 13 migrations (`0000_init` → `0012_rev19_support_litiges`). La liste demandait de les supprimer en renvoyant vers un dossier d'archive qui n'existait pas : supprimer aurait effacé l'historique (cahier §19.3). Ils sont **déplacés** dans `backend/src/db/archive-migrations-chaine-B/`, avec un README.

Réserves :

1. **Le module `legal` (CGV, acceptation légale) a été supprimé.** Il n'était jamais branché au serveur. L'audit le comptait comme fonctionnel (« acceptation légale ✅ ») : c'était faux. La fonctionnalité n'existe donc pas dans l'application. Elle est récupérable depuis `NZE__8_.zip`.
2. **Le snapshot de la chaîne en vigueur n'existe pas.** Les snapshots présents ne s'enchaînent pas (`0011`, `0012`, `0013` ont des identifiants discontinus) : `drizzle-kit generate` produirait une migration fausse.
3. **La liste ne couvre pas le mobile.** Écrans et clients d'API des domaines exclus restent (voir §3).

## 2. Mesures : audit contre état actuel

| Élément | Audit | Mesuré | Statut |
|---|---|---|---|
| Typage backend | 140 erreurs | **0** | ✅ |
| Contrôleurs backend (style « controller ») | 22 | **0** | ✅ |
| Routes / services backend vivants | 52 / 16 | 18 / 16 | ✅ |
| Dépendances fantômes (`jsonwebtoken`, `bcryptjs`, `esms-sms`, `express-rate-limit`) | 4 manquantes | 0 (code mort supprimé) | ✅ |
| `backend/.env` livré | oui | non | ✅ |
| Clé `sk_live` dans le code | mentionnée | **absente du code** (seulement dans l'audit) | ✅ (révocation : action fondateur) |
| Tests backend | 217 / 202 / 15 échecs | identique | ❌ 15 échecs restent |
| Typage mobile | 294 erreurs | 294 | ❌ |
| Imports `@/theme` (exports inexistants) | 176 | 77 fichiers | ❌ |
| Écrans mobiles | 116 | 116 | ❌ |
| Doublons d'écrans | 8 | 8 | ❌ |
| Clés du dictionnaire fr | 392 (audit) | 353 | ⚠️ écart à expliquer |

## 3. Ce qui reste, par priorité

### A. Bloquant avant tout déploiement

1. **Quelle chaîne de migrations est appliquée sur la base Render et la base de test ?** Si c'est la chaîne B, la base contient des tables (`lodgings`, `restaurants`, `service_*`…) que le code ne connaît plus. Si c'est la chaîne en vigueur, la base ne correspond pas à l'audit. Réponse nécessaire avant toute migration.
2. **Snapshot de référence** : reconstruire un snapshot cohérent de la chaîne en vigueur. Le test `schema-migrations` échoue à cause de cela.
3. **Inscription et profil appellent `/legal`** (`(auth)/register.tsx`, `(auth)/accept-terms.tsx`, `(tabs)/profile.tsx`), route absente du backend vivant. Décider : réintégrer le module `legal`, ou retirer ces appels.
4. **Appels mobiles vers des routes absentes** : `/help`, `/tutorials` (`step15-api.ts`, `help.tsx`, `useAutoTutorial`), `/search`, `/vehicles`, `/vehicle-bookings`, `/stores`, `/lodgings`, `/restaurants`, `/services`, `/service-posts`, `/subscriptions`, `/rides`. Ces routes n'étaient déjà pas servies avant la suppression ; les écrans concernés sont cassés.

### B. Tests à réparer (phase 1)

5. `collectes` (9 échecs) : les tests envoient l'ancien format ; la route exige désormais `produitId` et `ligneCommandeId`.
6. `livraisons` (2 échecs) : une anomalie de qualité doit bloquer l'article et prévenir les partenaires.
7. `notifications` (1) et `suivi-partenaire` (2) : tableaux de bord et compteurs.

### C. Périmètre exclu (phase 2)

8. **Mobile** : retirer les écrans `lodging`, `lodgings`, `restaurants`, `services`, `service`, `service-request`, `ride-request`, `mobility`, `stores`, `dashboard` et les API clients correspondants (`lodgings-api`, `restaurants-api`, `services-api`, `stores-api`, `driver-api`, `mobility-api`, `monetization-api`).
9. **Backend** : contrôle sur le code vivant, aucune table exclue dans `schema.ts`, aucune catégorie `reservation` ou `prestation`, aucune location mensuelle ou vente détectée. Confirmation par revue manuelle.

### D. Un seul système de design (phase 3)

10. 77 fichiers importent `@/theme` alors que `couleurs`, `espaces`, `rayons`, `tailles` sont les seuls exports : remplacer les imports (176 erreurs TS2305).
11. Supprimer les 8 doublons d'écrans : `(tabs)/profile` / `profil`, `(auth)/connexion` / `login` / `inscription` / `register`, `orders` / `mes-commandes`, `cart` / `(tabs)/panier`, `products` / `product`.
12. Ramener le typage mobile à 0 erreur, puis écrire de vrais tests mobiles (le script `npm test` est un placeholder).

### E. Règles de novembre (phase 4)

13. **Demande de retrait par le commerçant encore active** : `POST /partenaire/retraits` (`finance/routes.ts`). À remplacer par des versements manuels article par article décidés par l'administrateur principal (décision 3 de l'audit).
14. **OTP à la livraison encore présent** (2 occurrences dans `livraisons`) : décision 4 de l'audit (retirer ou conserver).
15. Registres séparés (dette, éligibilité, blocage, versement réel) et récupération des avances : non vérifiés.

### F. Compléter le cahier (phase 5)

16. Promotions (§8.4) : aucune table.
17. SKU produit (§8.2) : absent.
18. Recherche administrative globale (§18.1) : absente.
19. Support (§17.2) : priorité, responsable et notes internes existent dans le schéma ; couverture réelle à vérifier.
20. **Réclamations** : responsable, litiges partenaire et journal présents ; **notes internes, historique par dossier, alerte de retard automatique et traduction des notifications restent à faire** (aucun mécanisme de traduction côté mobile).
21. Aide, tutoriel et préférences : fr et en seulement (audit).

### G. Intégrations (phase 6)

22. Firebase, Cloudflare R2, eSMS et Realtime : **aucune trace dans le code**. Fournisseur OTP en production : `console` par défaut.
23. MyPVit : code présent, **non validé en réel**.

### H. Hygiène et livraison (phases 0 et 7)

24. Les gardes de production (`production-guards.ts`) étaient mortes et sont supprimées. `config.ts` contient des contrôles de production (4 mentions) : vérifier qu'ils couvrent les mêmes cas.
25. Révoquer la clé MyPVit `sk_live` si elle a été exposée (action fondateur, non vérifiable dans le code).
26. APK de test, tests sur appareil, validation juridique (CGV, rétractation, données personnelles).

## 4. Décisions attendues du fondateur

1. Quelle chaîne de migrations est en base réelle (point A1) ?
2. Le module `legal` (CGV, acceptation) : le réintégrer, ou abandonner l'acceptation dans l'application ?
3. Retrait du commerçant : confirmer la suppression au profit des versements manuels.
4. OTP à la livraison : retirer ou conserver.
5. Fournisseurs : Cloudflare R2, Firebase, Supabase Realtime ou non.
