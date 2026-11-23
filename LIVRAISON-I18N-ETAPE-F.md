# Étape F — Traduction de l'interface client

## Ce qui est en place
- **Quatre langues complètes** : français, anglais, arabe, chinois simplifié. Chaque langue porte les 392 mêmes clés (`nze-mobile/src/i18n/dictionnaire.ts`).
- **Contrôles automatiques** (`nze-mobile/tests/i18n.test.ts`, 4 tests) :
  - parité des clés entre les langues ;
  - aucun texte vide, variables `{…}` identiques dans toutes les langues ;
  - toute clé passée à `t(…)` dans l'application existe dans le dictionnaire ;
  - détection de la langue du téléphone.
- **Détection au premier lancement** : `nze-mobile/src/i18n/detection.ts` (fonction pure, testée). Le chinois traditionnel et les langues non prises en charge retombent sur le français.
- **Choix manuel et mémorisation** : sur le profil et dans les réglages, le choix est conservé sur le téléphone.
- **Sens droite-gauche pour l'arabe** : appliqué au redémarrage de l'application (contrainte de React Native).

## Écrans traduits dans cette livraison
- Acceptation des conditions (`app/(auth)/accept-terms.tsx`) : titre, texte d'introduction, liens, case à cocher, boutons, messages d'erreur.
- Libellé « Photo » de la fiche produit et de l'accueil.

## Non traduit (à décider)
- **Interfaces internes** : administration, partenaire, livreur (environ 70 textes). Décision à prendre : O-10 dans le registre.
- Messages d'erreur renvoyés par le serveur : déjà en français, à traduire côté serveur par code d'erreur lors d'une étape ultérieure.

## Points ouverts
- O-6 : relecture des traductions arabes et chinoises par des traducteurs.
- O-10 : langue des interfaces internes.

## Résultats mesurés
- Mobile : typage 0 erreur ; tests 14 sur 14.
