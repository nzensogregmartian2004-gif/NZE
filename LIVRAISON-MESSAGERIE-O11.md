# Messagerie : archive, réponses de NZE, réglage d'alerte (O-11 résolu)

## Décisions appliquées
- Suppression d'une conversation par le client : définitive, sauf si la conversation concerne un article sur lequel le client a une réclamation. Dans ce cas, elle est masquée pour le client et archivée pour les administrateurs (cahier V3.0 §17.1).
- Réglage validé : alerte de nouveaux messages, activable ou non depuis le profil.

## Ce qui change
- **Migration 0017** `messagerie_archive_preferences` :
  - `conversations.masquee_pour_client_le` et `conversations.archivee_le` ;
  - index d'unicité par article et par client restreint aux conversations non masquées (une nouvelle conversation peut ainsi être ouverte après suppression) ;
  - `users.notif_messages_actives` (valeur par défaut : active).
- **Backend** (`modules/messagerie`) :
  - `DELETE /conversations/:id` : définitif ou archivage selon la présence d'une réclamation du client sur le même article ;
  - réponses de NZE (administrateurs) acceptées sur toute conversation, avec notification `MESSAGE_RECU` au client, sauf s'il a désactivé l'alerte ;
  - `GET /admin/conversations/archivees` et `GET /admin/conversations/:id/messages` (permission `conversations.archives.consulter`, administrateurs seulement) ;
  - `GET` et `PATCH /messagerie/preferences`.
- **Mobile** : écran `app/messagerie/parametres.tsx` (interrupteur), lien depuis le profil, traductions dans les quatre langues.

## Résultats mesurés
- Backend : typage 0 erreur ; tests 264 sur 264 (dont 6 nouveaux tests d'archive et de réglage).
- Mobile : typage 0 erreur ; tests 15 sur 15.
- Snapshot de migration `0017_snapshot.json` régénéré depuis la base migrée.
