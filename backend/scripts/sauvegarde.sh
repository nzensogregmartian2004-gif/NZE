#!/usr/bin/env bash
# Sauvegarde de la base (format custom, compressé). Usage :
#   DATABASE_URL=postgres://... bash scripts/sauvegarde.sh ./sauvegardes
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
dossier="${1:-./sauvegardes}"
mkdir -p "$dossier"
fichier="$dossier/nze-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$fichier" "$DATABASE_URL"
echo "Sauvegarde écrite : $fichier"
