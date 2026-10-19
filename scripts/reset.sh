#!/usr/bin/env sh
# Stop stack and remove volumes (destroys DB + Paper world + plugin volume)
set -eu
cd "$(dirname "$0")/.."
docker compose down -v --remove-orphans
echo "Stack stopped and volumes removed."
