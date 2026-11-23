# MyPVit : analyse et intégration (NZE 10)

Date : 15 novembre 2026. Référence analysée : une application du fondateur, en production, qui intègre déjà MyPVit (client, paiements, retraits, webhooks, job de rattrapage, tests dédiés).

## 1. Ce que la référence fait et que NZE n'avait pas

| Sujet | Référence | NZE avant | NZE après |
|---|---|---|---|
| Compte d'opération par opérateur | Oui (Airtel, Moov, carte) | Un seul compte | Un compte par opérateur, `DEFAULT` en repli |
| Clé secrète par compte | Oui : une clé n'est jamais envoyée avec le compte d'un autre (bug du 27/08 documenté) | Une seule clé en cache | Une clé par compte |
| Clé reçue par webhook | Oui, routée au bon compte | Non | Oui, avec liste d'IP obligatoire |
| Renouvellement de clé | Formulaire, réception configurable | JSON, réponse obligatoire | Formulaire, réponse ou webhook (délai 15 s) |
| Reprise sur 401 | Une fois | Non | Une fois, après renouvellement de la clé du compte |
| Filtrage IP des callbacks | Oui | Non | Oui si la liste est configurée |
| Contrôle des comptes au démarrage | Oui | Non | Oui, sans bloquer le serveur |
| Rattrapage des paiements en attente | Oui (job) | Non | Oui (job Render toutes les 10 min) |
| Montant d'un versement vérifié | Oui | Non | Oui : un montant différent n'est jamais tenu pour versé |
| Versement incertain | Résolution manuelle | Aucune | Route `POST /admin/retraits/:id/resoudre` (motif obligatoire) |
| Callback vérifié par l'API, verrou, idempotence | Oui | Oui | Conservé |
| Versement : réservation, `FAILED` rend le montant | Oui | Oui | Conservé |

## 2. Ce qui a été modifié

- `providers/mypvit/config.ts` : comptes par opérateur, `MYPVIT_RECEPTION_URL_CODE`, `MYPVIT_WEBHOOK_ALLOWED_IPS`.
- `providers/mypvit/client.ts` : réécrit, même contrat public. Une clé par compte, un renouvellement à la fois par compte, réception par webhook, reprise unique sur 401, statut interrogé sur le compte de la transaction.
- `paiements/service.ts` : statut au compte de l'opérateur, rattrapage `rattraperPaiementsEnAttente`.
- `paiements/routes.ts` : filtrage IP du callback, route `POST /paiements/mypvit/secret` (garde IP, échec fermé).
- `finance/verdict-versement.ts` (nouveau) : verdict pur d'un versement, montant vérifié.
- `finance/retraits.ts` et `finance/routes.ts` : statut de versement au bon compte, montant vérifié, résolution manuelle.
- `jobs/rattrapage-paiements.ts` (nouveau), script `job:rattrapage-paiements`, cron Render `nze-rattrapage-paiements` (toutes les 10 min).
- `server.ts` : contrôle des comptes au démarrage.
- `render.yaml` : `TRUST_PROXY=1` sur le service web (sans lui, le filtrage IP refuse tous les webhooks).

## 3. Configuration à renseigner (noms uniquement, valeurs à obtenir de MyPVit)

- `MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL`, `MYPVIT_OPERATION_ACCOUNT_CODE_MOOV` : si MyPVit attribue un compte par opérateur (c'est le cas de la référence).
- `MYPVIT_OPERATION_ACCOUNT_CODE_CARD` : si les paiements par carte sont activés.
- `MYPVIT_WEBHOOK_ALLOWED_IPS` : adresses IP sortantes de MyPVit, séparées par des virgules. Sans cette liste, la réception de clé par webhook est refusée.
- `MYPVIT_RECEPTION_URL_CODE` : seulement si le compte reçoit sa clé par webhook. L'URL `…/api/paiements/mypvit/secret` doit être enregistrée chez MyPVit sous ce code.

## 4. Points à confirmer auprès de MyPVit avant la production

1. Pour chaque compte : la clé arrive-t-elle dans la réponse de renouvellement, ou par webhook ?
2. Quelles sont les IP sortantes de MyPVit à mettre dans `MYPVIT_WEBHOOK_ALLOWED_IPS` ?
3. Pour interroger le statut d'un versement (GIVE_CHANGE) : faut-il l'identifiant MyPVit (`reference_id`) ou la référence marchande ? Aujourd'hui NZE utilise l'identifiant MyPVit s'il existe, sinon la référence marchande : à confirmer.
4. Le code exact du moyen de paiement carte (`VISA_MASTERCARD`) : la référence signale qu'il n'est pas encore confirmé.

## 5. Risques restants, non traités

- Un paiement dont le montant ne correspond pas passe en `UNCERTAIN` : il n'est plus rattrapé automatiquement, et doit être tranché à la main.
- Un versement dont l'envoi est incertain reste en `VERSEMENT_EN_COURS` jusqu'à résolution manuelle par un administrateur principal.
- Le rattrapage est une tâche planifiée : son coût Render est à valider avec le fondateur.
- Aucun appel réel n'a été fait : les tests utilisent un faux serveur MyPVit. L'exactitude des contrats (format du renouvellement, réception par webhook, statut GIVE_CHANGE) reste à valider en sandbox.

## 7. Frais : à confirmer (ajouté le 17 novembre 2026)

La question la plus importante reste ouverte : les frais de paiement s'ajoutent-ils au montant envoyé (le client paie plus), ou sont-ils déduits du montant reçu par le marchand ?

Indice dans le code : `getFees` renvoie à la fois `fees` et `totalAmount`. Cela suggère que `totalAmount` est le montant débité au client, mais ce n'est pas confirmé.

À vérifier dans l'application de référence (en production) :

1. Quel montant est envoyé à l'initiation : le total de la commande, ou le total plus les frais ?
2. Que voit le client sur l'invite de paiement de l'opérateur (montant débité) ?
3. Comment le montant reçu est-il réconcilié avec les frais dans les écritures de la référence ?

Le banc d'essai (`npm run sandbox:mypvit`) donne la même réponse à la ligne « relation » du rapport, sur un montant de 1 000 FCFA.

## 6. Tests

- Tests MyPVit : 18 sur 18 (11 existants, 7 nouveaux : comptes par opérateur, clés croisées, webhook routé, clé refusée sans demande, compte non configuré, contrôle au démarrage, montant de versement).
- Suite backend complète : 285 sur 285.
- Typage backend : 0 erreur.
