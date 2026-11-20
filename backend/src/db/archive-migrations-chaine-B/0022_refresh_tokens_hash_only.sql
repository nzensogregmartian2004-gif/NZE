-- Étape 16 : aucun refresh token en clair ne doit subsister en base.
-- Les empreintes SHA-256 font toujours 64 caractères ; toute autre valeur est un token brut hérité.
-- Ces sessions sont supprimées : les utilisateurs concernés se reconnectent une fois. Aucune donnée personnelle n'est touchée.
DELETE FROM "refresh_tokens" WHERE length("token_hash") <> 64;
