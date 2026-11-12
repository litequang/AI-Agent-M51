"""Private deployment addresses are configured locally, never in public source."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def connection():
    path = Path(os.environ.get("M51_CONNECTION_CONFIG", str(ROOT / "config/connection.local.json")))
    data = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {}
    for name in ("M51_LAN_IP", "TERMUX_USER", "PC_LAN_IP", "LAN_SUBNET"):
        if os.environ.get(name):
            data[name] = os.environ[name]
    return data


def required(name):
    value = connection().get(name)
    if not value:
        raise RuntimeError(f"Set {name} in private config/connection.local.json or the environment")
    return value
