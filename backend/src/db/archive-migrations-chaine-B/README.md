# Archive : ancienne chaîne de migrations B

Ces fichiers ne sont PAS exécutés. Le journal `src/db/migrations/meta/_journal.json`
ne référence que la chaîne en vigueur (`0000_init` à `0012_rev19_support_litiges`).

Ils sont conservés, sans modification, comme historique (cahier V3.1 §19.3 : historique non destructif).
Ne pas les réintégrer dans `src/db/migrations/` : cela casserait la chaîne en vigueur.
