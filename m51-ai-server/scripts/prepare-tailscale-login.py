"""Prepare phone tailnet login without putting the authentication URL in logs."""
import json
import os
from pathlib import Path
import re
import subprocess

os.umask(0o077)
ROOT = Path(__file__).resolve().parents[1]
args = [str(ROOT / "tailscale/tailscale"), "--socket=" + str(ROOT / "run/tailscaled.sock"), "up", "--hostname=m51-ai", "--accept-dns=false", "--accept-routes=false", "--json", "--timeout=20s"]
try:
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    output = result.stdout + result.stderr
except subprocess.TimeoutExpired as exc:
    output = (exc.stdout or b"") + (exc.stderr or b"")
    if isinstance(output, bytes):
        output = output.decode(errors="replace")
match = re.search(r"https://login\.tailscale\.com/a/[A-Za-z0-9]+", output)
if match:
    path = ROOT / "secrets/tailscale-login.url"
    path.write_text(match.group(0))
    path.chmod(0o600)
    print(json.dumps({"status": "WAITING_FOR_BROWSER_LOGIN", "url": "stored privately; omitted from logs"}))
else:
    status = subprocess.run([str(ROOT / "tailscale/tailscale"), "--socket=" + str(ROOT / "run/tailscaled.sock"), "status", "--json"], capture_output=True, text=True, timeout=15)
    data = json.loads(status.stdout)
    print(json.dumps({"status": data.get("BackendState"), "tailscale_ips": data.get("TailscaleIPs", []), "auth_url": "omitted"}))
