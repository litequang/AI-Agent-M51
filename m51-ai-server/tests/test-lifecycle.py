import socket
import subprocess
import sys
from common import ROOT, request, save

result = {"status": "FAIL"}
try:
    subprocess.run(["bash", str(ROOT / "scripts/stop-ai.sh")], check=True)
    with socket.socket() as sock:
        sock.settimeout(3)
        stopped = sock.connect_ex(("127.0.0.1", 8080)) != 0
    assert stopped, "API listener survives safe stop"
    result["stop_closed_listener"] = True
    subprocess.run(["bash", str(ROOT / "scripts/start-ai.sh")], check=True)
    result["restarted_health"], _ = request("/health")
    assert result["restarted_health"].get("status") == "ok"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("lifecycle-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
