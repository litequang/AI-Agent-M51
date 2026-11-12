"""One-time Windows console authentication, then verify a dedicated SSH key."""
import datetime
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from access import required

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "docs" / "connection-state.json"
HOST = required("M51_LAN_IP")
USER = required("TERMUX_USER")
SSH_DIR = Path.home() / ".ssh"
KEY = SSH_DIR / "id_ed25519_m51"
KNOWN = SSH_DIR / "known_hosts_m51"
HOST_ALIAS = "m51-termux-20261112"


def state(status, **details):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({"status": status, "time": datetime.datetime.now().astimezone().isoformat(), **details}, indent=2), encoding="utf-8")


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    state("waiting_for_pc_authentication")
    SSH_DIR.mkdir(exist_ok=True)
    if not KEY.exists():
        run(["ssh-keygen", "-q", "-t", "ed25519", "-f", str(KEY), "-N", "", "-C", "m51-ai-windows"])
    pub = Path(str(KEY) + ".pub")
    if not pub.exists():
        run(["ssh-keygen", "-y", "-f", str(KEY)], stdout=pub.open("w", encoding="ascii"))
    public_key = pub.read_text(encoding="ascii").strip()
    if not public_key.startswith("ssh-ed25519 ") or "\n" in public_key:
        raise RuntimeError("Invalid dedicated public key")
    common = ["ssh", "-p", "8022", "-i", str(KEY), "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new", "-o", "UserKnownHostsFile=~/.ssh/known_hosts_m51", "-o", f"HostKeyAlias={HOST_ALIAS}"]
    quoted = shlex.quote(public_key)
    command = (
        "set -eu; umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; "
        f"if ! grep -qxF -- {quoted} ~/.ssh/authorized_keys; then "
        f"printf '\\n%s\\n' {quoted} >> ~/.ssh/authorized_keys; fi; "
        "chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys; "
        "printf 'M51_PUBLIC_KEY_INSTALLED\\n'"
    )
    print("M51 Termux was reinstalled. A separate host-key file will be used.", flush=True)
    print("Enter the TERMUX SSH password below. Input is hidden. Do not send it in chat.", flush=True)
    run(common + ["-o", "NumberOfPasswordPrompts=3", f"{USER}@{HOST}", command])
    verified = subprocess.check_output(common + ["-o", "BatchMode=yes", "-o", "PasswordAuthentication=no", f"{USER}@{HOST}", "uname -a && whoami"], text=True)
    if USER not in verified.splitlines():
        raise RuntimeError("Unexpected remote user; SSH config was not updated")
    config = SSH_DIR / "config"
    previous = config.read_text(encoding="utf-8-sig") if config.exists() else ""
    existing_alias = bool(re.search(r"(?im)^\s*Host\s+[^\r\n]*\bm51-ai\b", previous))
    if existing_alias and (f"HostKeyAlias {HOST_ALIAS}" not in previous or KEY.as_posix() not in previous):
        raise RuntimeError("An unrelated m51-ai alias exists; key works but config needs review")
    if config.exists() and not existing_alias:
        backup = SSH_DIR / ("config.before-m51-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
        backup.write_text(previous, encoding="utf-8")
    block = (
        f'Host m51-ai\n    HostName {HOST}\n    User {USER}\n    Port 8022\n'
        f'    IdentityFile "{KEY.as_posix()}"\n    IdentitiesOnly yes\n'
        f'    UserKnownHostsFile "{KNOWN.as_posix()}"\n    HostKeyAlias {HOST_ALIAS}\n'
        '    StrictHostKeyChecking yes\n    ServerAliveInterval 30\n    ServerAliveCountMax 3\n'
    )
    # Put exact alias before any existing Host * defaults (OpenSSH uses first value).
    if not existing_alias:
        config.write_text(block + "\n" + previous, encoding="utf-8")
    verified_alias = subprocess.check_output(["ssh", "-o", "BatchMode=yes", "m51-ai", "uname -a && whoami"], text=True)
    print(verified_alias, flush=True)
    state("connected_key_verified", host=HOST, user=USER, alias="m51-ai", verification=verified_alias)
    print("PASS: ssh m51-ai works with the dedicated key. Return to the Codex chat.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        state("failed", error=str(exc))
        print(f"Connection setup stopped: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
