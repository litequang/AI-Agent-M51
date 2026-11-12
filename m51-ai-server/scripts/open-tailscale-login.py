"""Open a Tailscale authentication page on PC, without printing the auth URL."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import urllib.parse
import webbrowser

parser = argparse.ArgumentParser()
parser.add_argument("device", choices=("phone", "pc"))
args = parser.parse_args()
if args.device == "phone":
    url = subprocess.check_output(["ssh", "-n", "-o", "BatchMode=yes", "m51-ai", "cat ~/m51-ai-server/secrets/tailscale-login.url"], text=True).strip()
else:
    cli = Path("C:/Program Files/Tailscale/tailscale.exe")
    if not cli.is_file():
        raise SystemExit("Windows Tailscale installation is not complete")
    try:
        result = subprocess.run([str(cli), "up", "--accept-dns=false", "--accept-routes=false", "--hostname=m51-control-pc", "--json", "--timeout=20s"], capture_output=True, text=True, timeout=30)
        output = result.stdout + result.stderr
    except subprocess.TimeoutExpired as exc:
        output = (exc.stdout or b"") + (exc.stderr or b"")
        if isinstance(output, bytes):
            output = output.decode(errors="replace")
    match = re.search(r"https://login\.tailscale\.com/a/[A-Za-z0-9]+", output)
    if not match:
        status = json.loads(subprocess.check_output([str(cli), "status", "--json"], text=True))
        print("PC Tailscale backend:", status.get("BackendState"))
        raise SystemExit(0 if status.get("BackendState") == "Running" else 1)
    url = match.group(0)
parsed = urllib.parse.urlparse(url)
if parsed.scheme != "https" or parsed.hostname != "login.tailscale.com" or not re.fullmatch(r"/a/[A-Za-z0-9]+", parsed.path):
    raise SystemExit("Unexpected authentication URL; browser not opened")
webbrowser.open(url, new=2)
print(f"Opened {args.device} Tailscale authentication on the PC. Sign in using the same account for both devices.")
