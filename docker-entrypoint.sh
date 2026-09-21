#!/bin/sh
set -eu

: "${BETTER_AUTH_SECRET:?set BETTER_AUTH_SECRET to a random value, for example: openssl rand -base64 32}"

BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
PINSHELF_DATA_DIR="${PINSHELF_DATA_DIR:-/data}"
PINSHELF_PORT="${PINSHELF_PORT:-3000}"
CONFIG=/app/dist/server/wrangler.json

mkdir -p "$PINSHELF_DATA_DIR"

# wrangler reads secrets from .dev.vars; keep it readable by this user only.
umask 077
printf 'BETTER_AUTH_SECRET=%s\nBETTER_AUTH_URL=%s\n' "$BETTER_AUTH_SECRET" "$BETTER_AUTH_URL" \
  > /app/dist/server/.dev.vars
chmod 600 /app/dist/server/.dev.vars

wrangler d1 migrations apply pinshelf --local --persist-to "$PINSHELF_DATA_DIR" -c "$CONFIG"

exec wrangler dev -c "$CONFIG" \
  --ip 0.0.0.0 \
  --port "$PINSHELF_PORT" \
  --persist-to "$PINSHELF_DATA_DIR" \
  --show-interactive-dev-session false
