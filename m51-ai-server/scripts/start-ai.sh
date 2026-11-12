#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
python "$(dirname -- "$0")/manage-ai.py" start
if [[ -f "$(dirname -- "$0")/manage-chat.py" ]]; then
    python "$(dirname -- "$0")/manage-chat.py" start
fi
