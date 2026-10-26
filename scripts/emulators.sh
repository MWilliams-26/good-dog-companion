#!/usr/bin/env bash
# Starts the Firebase Emulator Suite for local development and the private
# preview. If the emulator starts empty, the fictional demo practice is seeded
# automatically, so the preview always has data to explore.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -d "$HOME/.local/jdk21/bin" ]; then export PATH="$HOME/.local/jdk21/bin:$PATH"; fi
IMPORT=()
if [ -f .emulator-data/firebase-export-metadata.json ]; then IMPORT=(--import .emulator-data); fi

(
  for _ in $(seq 1 90); do
    if curl -sf http://127.0.0.1:8080/ >/dev/null && curl -sf http://127.0.0.1:9099/ >/dev/null; then break; fi
    sleep 2
  done
  if ! curl -s -H 'Authorization: Bearer owner' \
    'http://127.0.0.1:8080/v1/projects/demo-good-dog/databases/(default)/documents/authorizedUsers' | grep -q '"documents"'; then
    node scripts/seed.mjs || echo "seed failed"
  fi
) &

exec firebase emulators:start --project demo-good-dog --only auth,firestore,storage,functions "${IMPORT[@]}" --export-on-exit .emulator-data
