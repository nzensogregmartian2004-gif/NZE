#!/usr/bin/env bash
# Restauration d'une sauvegarde dans une base VIDE de test. Ne jamais restaurer sur la production sans décision écrite.
# Usage : DATABASE_URL_CIBLE=postgres://... bash scripts/restaure.sh fichier.dump
set -euo pipefail
: "${DATABASE_URL_CIBLE:?DATABASE_URL_CIBLE requis (base vide)}"
fichier="${1:?Fichier .dump requis}"
pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL_CIBLE" "$fichier"
echo "Restauration terminée dans la base cible."
