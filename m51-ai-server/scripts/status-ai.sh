#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
exec python "$(dirname -- "$0")/manage-ai.py" status
