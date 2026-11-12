"""Verify private Tailscale SSH from PC, then keep an authenticated API tunnel."""
import datetime
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import socket
import sys
import time
from access import required

ROOT = Path(__file__).resolve().parents[1]
USER = required("TERMUX_USER")
cli = Path("C:/Program Files/Tailscale/tailscale.exe")
status = json.loads(subprocess.check_output([str(cli), "status", "--json"], text=True))
if status.get("BackendState") != "Running":
    raise SystemExit("PC Tailscale authentication required")
subprocess.run(["ssh", "-n", "-o", "BatchMode=yes", "m51-ai", "python ~/m51-ai-server/scripts/configure-tailnet.py"], check=True)
raw = subprocess.check_output(["ssh", "-n", "-o", "BatchMode=yes", "m51-ai", "cat ~/m51-ai-server/docs/tailnet-results.json"], text=True)
report = json.loads(raw)
ip = ipaddress.ip_address(report["phone_tailscale_ipv4"])
if ip not in ipaddress.ip_network("100.64.0.0/10"):
    raise SystemExit("Not a Tailscale IPv4 address")
sshdir = Path.home() / ".ssh"
config = sshdir / "config"
old = config.read_text(encoding="utf-8-sig") if config.exists() else ""
begin, end = "# BEGIN M51 PRIVATE TAILNET", "# END M51 PRIVATE TAILNET"
if re.search(r"(?im)^\s*Host\s+m51-ai-remote\s*$", old) and begin not in old:
    raise SystemExit("Unmanaged m51-ai-remote alias exists; inspect before changing")
backup = sshdir / ("config.before-tailnet-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
backup.write_text(old, encoding="utf-8")
old = re.sub(re.escape(begin) + r".*?" + re.escape(end) + r"\n?", "", old, flags=re.S)
block = f'''{begin}
Host m51-ai-remote
    HostName {ip}
    User {USER}
    Port 8022
    IdentityFile "{(sshdir / 'id_ed25519_m51').as_posix()}"
    IdentitiesOnly yes
    UserKnownHostsFile "{(sshdir / 'known_hosts_m51').as_posix()}"
    HostKeyAlias m51-termux-20261112
    StrictHostKeyChecking yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
{end}
'''
config.write_text(block + old, encoding="utf-8")
verify = subprocess.check_output(["ssh", "-n", "-o", "BatchMode=yes", "-o", "ConnectTimeout=12", "m51-ai-remote", "uname -a && whoami"], text=True, timeout=30)
if USER not in verify.splitlines():
    raise SystemExit("Unexpected remote user")
logs, run = ROOT / "logs", ROOT / "run"
logs.mkdir(exist_ok=True)
run.mkdir(exist_ok=True)
with socket.socket() as probe:
    probe.settimeout(2)
    existing = (run / "tailnet-tunnel.pid").exists() and probe.connect_ex(("127.0.0.1", 18081)) == 0
if not existing:
    with (logs / "tailnet-tunnel.log").open("w") as log:
        child = subprocess.Popen(["ssh", "-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-L", "127.0.0.1:18081:127.0.0.1:8080", "m51-ai-remote"], stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
    (run / "tailnet-tunnel.pid").write_text(str(child.pid))
    time.sleep(2)
    if child.poll() is not None:
        raise SystemExit("Private tailnet API tunnel failed; inspect tunnel log")
report.update(status="PASS", detail="PC verified SSH key over Tailscale address and API request through its SSH tunnel", pc_backend="Running", ssh_verification=verify, api_base="http://127.0.0.1:18081", actual_cellular_path="SKIP: no independent 4G/5G client tested")
sys.path.insert(0, str(ROOT / "tests"))
import common
common.BASE = report["api_base"]
report["health"], _ = common.request("/health")
assert report["health"].get("status") == "ok"
report["synthetic_response"] = common.chat("Thủ đô Việt Nam là thành phố nào? Trả lời một câu tiếng Việt.", max_tokens=64)
assert "ha noi" in common.fold(report["synthetic_response"]["content"])
(ROOT / "docs/tailnet-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("PASS: private Tailscale SSH and actual API generation on PC at 127.0.0.1:18081")
