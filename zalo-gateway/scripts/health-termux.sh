#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
exec node dist/scripts/operator.js health
