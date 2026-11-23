# NZE — Application mobile

Application Expo et React Native (expo-router). Quatre langues : français, anglais, arabe (droite à gauche), chinois simplifié.

## Lancer

- Installation : `npm ci` (dans `mobile-nze/`).
- Développement : `npm start`, puis `npm run android` ou `npm run ios`.
- Vérification des types : `npm run typecheck`.
- Tests : `npm test` (24 tests unitaires : libellés, traductions, rôles, pagination du catalogue, règles des fiches prestataires).

## Adresse de l'API

La variable `EXPO_PUBLIC_API_URL` est fixée dans `eas.json` par profil de build (`https://nze.onrender.com` dans la configuration actuelle). À confirmer : l'adresse du service Render est `nze-api`, et un domaine personnalisé peut la remplacer.

## Structure

- `app/` : écrans (expo-router). Dossiers présents : `(admin)`, `(auth)`, `(livreur)`, `(partenaire)`, `(tabs)`, `collecte`, `commande`, `conversation`, `legal`, `livraison`, `messagerie`, `produit`, `reclamation`.
- `src/` : composants, API (`src/lib`), thème (`src/theme`), langues (`src/i18n`), état (`src/store`).

## Points ouverts

- Parcours client : le parcours d'achat de bout en bout est testé côté backend (`parcours-achat.test.ts`). Reste à le tester sur téléphone réel (aucun test d'écran automatisé).
- Test sur téléphone réel de chaque parcours, et APK de preview (`npx eas build -p android --profile preview`).

Référence active : `../docs/LIRE-EN-PREMIER.md`.
