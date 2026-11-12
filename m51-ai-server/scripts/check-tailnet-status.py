"""Print only safe tailnet readiness fields; omit auth URLs and account data."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
pc_cli = Path("C:/Program Files/Tailscale/tailscale.exe")
pc = {}
if pc_cli.exists():
    result = subprocess.run([str(pc_cli), "status", "--json"], capture_output=True, text=True, timeout=15)
    if result.stdout.strip():
        pc = json.loads(result.stdout)
command = "~/m51-ai-server/tailscale/tailscale --socket=/data/data/com.termux/files/home/m51-ai-server/run/tailscaled.sock status --json"
result = subprocess.run(["ssh", "-n", "-o", "BatchMode=yes", "m51-ai", command], capture_output=True, text=True, timeout=20)
phone = json.loads(result.stdout) if result.stdout.strip() else {}
pc_net, phone_net = pc.get("CurrentTailnet") or {}, phone.get("CurrentTailnet") or {}
same = bool(pc_net.get("Name")) and pc_net.get("Name") == phone_net.get("Name")
report = {"pc_installed": pc_cli.exists(), "pc_backend": pc.get("BackendState", "not available"), "pc_ips": pc.get("TailscaleIPs", []), "phone_backend": phone.get("BackendState", "not available"), "phone_ips": phone.get("TailscaleIPs", []), "same_tailnet": same}
(ROOT / "docs/tailnet-readiness.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
