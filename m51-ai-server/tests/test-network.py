"""Run on Windows: tunnel API works, direct phone AI port stays unreachable."""
import socket
import sys
from common import request, save
from common import ROOT
sys.path.insert(0, str(ROOT / "scripts"))
from access import required

result = {"status": "FAIL", "phone": required("M51_LAN_IP"), "port": 8080}
try:
    result["health"], _ = request("/health")
    assert result["health"].get("status") == "ok"
    with socket.socket() as sock:
        sock.settimeout(4)
        code = sock.connect_ex((result["phone"], result["port"]))
    result["direct_lan_connect_code"] = code
    assert code != 0, "AI port reachable directly on phone LAN address"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("network-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
