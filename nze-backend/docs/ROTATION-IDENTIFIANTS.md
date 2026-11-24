# Rotation des identifiants — procédure

Date : 17 novembre 2026. Décision : **D-PROD-2**. Responsable des actions : le fondateur, depuis ses comptes (Cloudflare, MyPVit, Supabase, Render).

Ce document ne contient aucune valeur. Les nouvelles valeurs ne sont saisies que dans le tableau de bord Render. Ne les collez dans aucune discussion, aucun ticket, aucun fichier du dépôt.

## 1. Ce qui a été écrit dans une discussion

D'après la documentation du projet (section « suivi »), deux identifiants ont été écrits dans une discussion :

1. le jeton Cloudflare R2 (premier jeton créé) ;
2. la clé MyPVit de production.

Le fondateur doit confirmer s'il existe d'autres exposition (mot de passe de la base Supabase, secret de session, clé Google Maps).

## 2. Ordre des actions

| # | Action | Où | Vérification |
|---|---|---|---|
| 1 | Révoquer le premier jeton R2 et en créer un nouveau, avec les droits minimaux sur le seul bucket NZE. | Cloudflare, section R2 | L'ancien jeton est refusé. R2 n'est pas encore branché dans le code : aucune variable à mettre à jour sur Render pour l'instant. |
| 2 | Demander à MyPVit le remplacement de la clé de production, puis mettre à jour `MYPVIT_PASSWORD` et `MYPVIT_CODE_SECRET` dans Render. | MyPVit, puis Render | Un paiement de test en préproduction aboutit ; le webhook répond avec la nouvelle clé. |
| 3 | Si le mot de passe de la base a été exposé : le réinitialiser dans Supabase, puis mettre à jour `DATABASE_URL` dans Render. | Supabase, puis Render | `GET /sante` répond après redéploiement. |
| 4 | Si `SESSION_SECRET` a été exposé : le régénérer dans Render. Toutes les sessions sont invalidées : les utilisateurs se reconnectent. | Render | Une connexion fonctionne après redéploiement. |
| 5 | Si la clé Google Maps a été exposée : la restreindre (domaines et API) ou la régénérer. | Google Cloud | Un calcul de distance de livraison fonctionne. |
| 6 | Créer la clé de service Firebase (point O-19) et la saisir dans `FIREBASE_SERVICE_ACCOUNT_JSON`. | Firebase, puis Render | Voir O-19. |

## 3. Contrôles après chaque action

1. Lancer `npm run verifier:secrets` dans `nze-backend/` : aucun motif ne doit être trouvé.
2. Vérifier dans les journaux Render qu'aucune erreur d'authentification n'apparaît pendant une heure.
3. Consigner la date et l'action dans le journal de livraison.

## 4. Ce que l'assistant ne fait pas

- Il ne révoque, ne crée et ne saisit aucun identifiant.
- Il ne lit aucune valeur secrète. Le contrôle `npm run verifier:secrets` signale seulement l'emplacement d'un motif, sans jamais l'afficher.

## 5. Contrôle permanent

`npm run verifier:secrets` peut être lancé avant chaque livraison. Il ne détecte que des motifs courants (clés AWS, clés privées, jetons JWT, clés de production) : il ne remplace pas la vigilance.
