# Étape 2 — Notifications serveur traduites

## Ce qui change
- `nze-backend/src/modules/notifications/textes.ts` (nouveau) : 22 types de notification traduits en français, anglais, arabe et chinois simplifié. Les montants, délais et motifs sont des paramètres.
- `nze-backend/src/modules/notifications/service.ts` : `notifier()` lit la langue du compte du destinataire (`users.langue`), applique la traduction si elle existe, sinon garde le texte d'origine. Nouveaux champs optionnels : `cle` (variante par destinataire) et `parametres`.
- `nze-backend/src/modules/collectes/service.ts` et `nze-backend/src/modules/reclamations/service.ts` : passent les paramètres et les variantes.
- `nze-backend/tests/notifications-langue.test.ts` (nouveau) : 6 tests (langues, repli français, paramètres, types sans traduction, variantes).

## Non traduit (volontairement)
- Module échelonnement (notifications `ECHELONNEMENT_*`, `VERSEMENT_ENREGISTRE`, `ENCAISSEMENT_ECHELONNE`, `PAIEMENT_ECHOUE`, `ECHEANCE_*`) : module désactivé au lancement. Il sera traduit s'il est activé.

## Résultats mesurés
- `npm run typecheck` (backend) : 0 erreur.
- `npm test` (backend) : 229 tests, 229 réussis, 0 échec.

## Points ouverts
- Relecture des traductions arabes et chinoises par des traducteurs (O-6).
- Traduction de l'interface mobile et de l'aide : étape F.
