# Banc d'essai MyPVit — procédure et dossier de preuves (lot 4 de l'audit)

Statut au 17 novembre 2026 : **non exécuté**. L'environnement de contrôle ne peut pas joindre MyPVit (erreur réseau à l'appel), et aucune documentation officielle de MyPVit n'est disponible en ligne. Les essais doivent être faits par le fondateur, avec les identifiants de test fournis par MyPVit.

## 1. Préalables (côté fondateur)

1. Obtenir de MyPVit : une **adresse de test** (distincte de `https://api.mypvit.pro`), des **identifiants de test**, des **numéros de test** par opérateur (Airtel Money, Moov Money, carte), et la **documentation officielle** de l'API.
2. Ne jamais coller ces identifiants dans une discussion ni dans le dépôt. Les mettre dans un fichier local `sandbox.env` (ignoré par Git), ou les exporter dans le terminal.
3. Ne pas utiliser les identifiants de production pour ce banc d'essai.

## 2. Lancer le banc d'essai

Depuis `nze-backend/`, avec un fichier `sandbox.env` local contenant `MYPVIT_BASE_URL`, `SANDBOX_CONFIRME=oui`, les variables `MYPVIT_*` de test, et optionnellement :

- `SANDBOX_TEST_PAYMENT=oui`, `SANDBOX_MSISDN_TEST=<numéro de test>`, `SANDBOX_OPERATEUR_TEST=AIRTEL_MONEY` (ou `MOOV_MONEY`), `SANDBOX_MONTANT=100`.

```
node --env-file=sandbox.env --experimental-strip-types scripts/sandbox-mypvit.ts
```

Les valeurs de test vont uniquement dans le fichier local `sandbox.env`, jamais dans le service Render de production.

Le script refuse de tourner si `APP_ENV=production`, si l'adresse est celle de la production ou n'est pas en `https`, ou sans `SANDBOX_CONFIRME=oui`. Il écrit `sandbox-rapport-mypvit.md` (ignoré par Git), sans identifiant ni valeur de configuration.

## 3. Dossier de preuves (à remplir par scénario)

Chaque scénario doit être noté : date, opérateur, montant, résultat observé, action de l'API NZE (statut de la commande et de la transaction), et preuve (capture ou extrait du rapport). Un scénario non résolu bloque la mise en production.

| Scénario | Ce qu'il faut prouver | Statut |
|---|---|---|
| Encaissement Airtel Money | Initiation, confirmation, commande payée, stock décompté une seule fois | À exécuter |
| Encaissement Moov Money | Idem | À exécuter |
| Encaissement carte | Idem, si la carte est disponible en test | À exécuter |
| Frais affichés | Frais MyPVit lus avant l'initiation et affichés au client (décision D-AUD-2) | Bloqué : dépend de la documentation MyPVit |
| Callback | Réception, statut confirmé auprès de MyPVit avant application | À exécuter |
| Filtrage IP | Callback d'une IP de la liste acceptée, d'une autre refusée (`callback_ip_refusee`) | À exécuter |
| Interrogation de statut | Statut lu et appliqué sans callback | À exécuter |
| Rattrapage | Transaction restée en attente, reprise par le rattrapage | À exécuter |
| Doublon | Même callback reçu deux fois : une seule application | Couvert par les tests ; à confirmer en sandbox |
| Mauvais montant | Montant différent de celui de la transaction : statut incertain, pas d'application | Couvert par les tests ; à confirmer en sandbox |
| Annulation | Paiement annulé côté client, commande et stock corrects | À exécuter |
| Timeout | Pas de réponse de MyPVit : transaction en attente, pas de double encaissement | À exécuter |
| Résultat incertain | Paiement : montant différent de MyPVit, statut UNCERTAIN, commande non payée (couvert). Versement : résultat inconnu, montant réservé, pas de relance (couvert). Arbitrage manuel par l'administrateur principal | Couvert par les tests ; à confirmer en sandbox |
| GIVE_CHANGE (versement partenaire) | Versement exécuté, montant réservé libéré, pas de second versement | À exécuter |
| Frais de retrait | Frais du versement connus avant validation | Bloqué : dépend de la documentation MyPVit |

## 4. Questions à poser à MyPVit avant tout essai

1. **Frais** : les frais de paiement s'ajoutent-ils au montant envoyé (le client paie montant + frais), ou sont-ils déduits du montant reçu par le marchand ? Cela conditionne le montant à envoyer et l'écriture comptable (décision D-AUD-2).

   **Où en est la question.** Le code lit `fees` et `totalAmount` pour un montant donné. Le banc d’essai classe la relation (ligne « relation » du rapport : FRAIS_EN_PLUS, FRAIS_INCLUS ou INDETERMINE). Deux sources peuvent trancher : (a) l’essai sandbox, (b) l’application de référence déjà en production (voir `docs/paiements/MYPVIT-INTEGRATION.md`, section 7). Aucune n’a encore été lue.
2. **Callbacks** : format exact, en-têtes, signature éventuelle, et adresses IP d'envoi (liste officielle, à comparer à `MYPVIT_WEBHOOK_ALLOWED_IPS`).
3. **Statut** : endpoint de consultation, valeurs possibles, et délai avant un statut définitif.
4. **Numéros de test** par opérateur et résultats attendus (succès, échec, en attente).
5. **Versement (GIVE_CHANGE)** : délais, frais, et que faire en cas de résultat inconnu.
6. **Limites** : montant minimum et maximum, délai d'expiration d'une transaction.

## 5. Ce qui reste bloquant avant tout encaissement réel

- Réponses de MyPVit aux questions 1 et 2 ;
- dossier de preuves complet pour les scénarios Airtel Money et Moov Money ;
- autorisation écrite du fondateur pour un premier encaissement réel de faible montant.
