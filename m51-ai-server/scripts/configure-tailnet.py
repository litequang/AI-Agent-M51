"""After browser authentication, expose only private tailnet SSH forwarding."""
import ipaddress
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
cli = [str(ROOT / "tailscale/tailscale"), "--socket=" + str(ROOT / "run/tailscaled.sock")]
data = json.loads(subprocess.check_output(cli + ["status", "--json"], text=True))
if data.get("BackendState") != "Running":
    print(json.dumps({"status": "WAITING_FOR_BROWSER_LOGIN", "backend": data.get("BackendState")}))
    raise SystemExit(2)
ips = [str(ipaddress.ip_address(ip)) for ip in data.get("TailscaleIPs", []) if ipaddress.ip_address(ip).version == 4 and ipaddress.ip_address(ip) in ipaddress.ip_network("100.64.0.0/10")]
if len(ips) != 1:
    raise SystemExit("Expected one private Tailscale IPv4 address")
subprocess.run(cli + ["serve", "--bg", "--tcp=8022", "tcp://127.0.0.1:8022"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
serve = json.loads(subprocess.check_output(cli + ["serve", "status", "--json"], text=True))
report = {"status": "PHONE_READY", "phone_tailscale_ipv4": ips[0], "private_ssh_port": 8022, "serve": serve, "api_public": False, "detail": "Phone authenticated; PC tailnet SSH/tunnel verification remains required"}
(ROOT / "docs/tailnet-results.json").write_text(json.dumps(report, indent=2))
print(json.dumps({key: value for key, value in report.items() if key != "serve"}))
