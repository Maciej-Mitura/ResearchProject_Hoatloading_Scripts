#!/usr/bin/env sh
# Smoke checks against a running Compose stack (API on localhost:3000)
set -eu
API="${API_URL:-http://localhost:3000}"

echo "== health =="
curl -sf "$API/health" | tee /tmp/poc-health.json
echo

echo "== conversations =="
CONV=$(curl -sf -X POST "$API/api/conversations" -H 'Content-Type: application/json' -d '{"title":"smoke"}')
echo "$CONV"
CID=$(echo "$CONV" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

echo "== message =="
curl -sf -X POST "$API/api/conversations/$CID/messages" \
  -H 'Content-Type: application/json' \
  -d '{"content":"Create something that sends a welcome message when a player joins."}' | head -c 500
echo

echo "== scripts =="
curl -sf "$API/api/scripts" | head -c 400
echo

echo "== host status =="
curl -sf "$API/api/host/status"
echo

echo "== runner health =="
curl -sf "http://localhost:3100/health" 2>/dev/null || echo "(runner not published to host — check internal network)"
echo
echo "smoke done"
