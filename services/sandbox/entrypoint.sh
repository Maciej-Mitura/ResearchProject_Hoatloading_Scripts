#!/bin/sh
# Trusted sandbox entrypoint — not untrusted script code.
# Profile → Deno flag mapping is HARD-CODED for known IDs only.
set -eu

WORKDIR="${SANDBOX_WORKDIR:-/workspace}"
export DENO_DIR="${DENO_DIR:-$WORKDIR/.deno}"
mkdir -p "$DENO_DIR"

LANG="${SCRIPT_LANGUAGE:-javascript}"
case "$LANG" in
  javascript)
    FILE="$WORKDIR/main.js"
    ;;
  typescript)
    FILE="$WORKDIR/main.ts"
    ;;
  *)
    echo "sandbox: unsupported SCRIPT_LANGUAGE='$LANG' (allowed: javascript, typescript)" >&2
    exit 2
    ;;
esac

deno --version > "$WORKDIR/runtime-version.txt" 2>&1 || true

AUDIT_PATH="${DENO_AUDIT_PERMISSIONS:-$WORKDIR/permission-audit.jsonl}"
: > "$AUDIT_PATH"
export DENO_AUDIT_PERMISSIONS="$AUDIT_PATH"

cat > "$FILE"

# Trusted profile → structured Deno argv (no shell concatenation of user input).
# host-chat: transport to Host Gateway only + env for gateway URL/token +
# narrow read of /trusted/host for the baked-in SDK (NOT general filesystem).
PROFILE="${PERMISSION_PROFILE:-none}"
HOST_NET_TARGET="${HOST_GATEWAY_NET_ALLOW:-host-gateway:3200}"
set +e
case "$PROFILE" in
  none)
    deno run --no-prompt "$FILE"
    EXIT=$?
    ;;
  read-fixture)
    deno run --no-prompt --allow-read=/fixtures "$FILE"
    EXIT=$?
    ;;
  env-demo)
    deno run --no-prompt --allow-env=SANDBOX_DEMO_VALUE "$FILE"
    EXIT=$?
    ;;
  host-chat)
    deno run --no-prompt \
      --import-map=/trusted/import_map.json \
      --allow-read=/trusted/host \
      --allow-net="$HOST_NET_TARGET" \
      --allow-env=HOST_GATEWAY_URL,HOST_CAPABILITY_TOKEN \
      "$FILE"
    EXIT=$?
    ;;
  *)
    echo "sandbox: unsupported PERMISSION_PROFILE='$PROFILE' (allowed: none, read-fixture, env-demo, host-chat)" >&2
    EXIT=2
    ;;
esac
set -e

MARKER="${POC_FRAME_MARKER:-poc-frame}"
echo "${MARKER}:AUDIT_BEGIN"
if [ -f "$AUDIT_PATH" ]; then
  cat "$AUDIT_PATH"
fi
echo "${MARKER}:AUDIT_END"
echo "${MARKER}:RUNTIME_BEGIN"
if [ -f "$WORKDIR/runtime-version.txt" ]; then
  cat "$WORKDIR/runtime-version.txt"
fi
echo "${MARKER}:RUNTIME_END"

exit "$EXIT"
