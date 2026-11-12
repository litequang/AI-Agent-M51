"""Run official userspace tailscaled under runit; redact auth links from logs."""
import os
from pathlib import Path
import re
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
os.umask(0o077)
env = dict(os.environ)
env["SSL_CERT_FILE"] = os.environ["PREFIX"] + "/etc/tls/cert.pem"
# Linux Go probes package managers with faccessat2 when they are on PATH.
# Android's seccomp policy rejects that syscall. This userspace-only daemon needs
# no external system helpers, so give it an empty helper search directory.
empty_path = ROOT / "tailscale/empty-path"
empty_path.mkdir(exist_ok=True)
env["PATH"] = str(empty_path)
state_dir = ROOT / "secrets/tailscale-data"
state_dir.mkdir(mode=0o700, exist_ok=True)
args = [str(ROOT / "tailscale/tailscaled"), "--tun=userspace-networking", "--socket=" + str(ROOT / "run/tailscaled.sock"), "--state=" + str(ROOT / "secrets/tailscaled.state"), "--statedir=" + str(state_dir), "--port=0", "--no-logs-no-support"]
child = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)


def stop(signum, frame):
    child.terminate()


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
for line in child.stdout:
    line = re.sub(r"https?://\S+", "[URL REDACTED]", line)
    line = re.sub(r"tskey-[A-Za-z0-9_-]+", "[KEY REDACTED]", line)
    print(line, end="", flush=True)
sys.exit(child.wait())
