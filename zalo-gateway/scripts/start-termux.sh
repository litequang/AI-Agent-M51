#!/data/data/com.termux/files/usr/bin/bash
# Foreground only. No runit/Boot/Tailscale changes.
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")/.."
export GATEWAY_MODE=mock
export GATEWAY_PORT=8790
export GATEWAY_DATA_DIR="$PWD/var"
export GATEWAY_TOKEN_FILE="$GATEWAY_DATA_DIR/operator.key"
test -f dist/src/main.js || { echo "Build on the PC and copy dist/ first." >&2; exit 1; }
node dist/src/main.js --init-token
exec node dist/src/main.js
