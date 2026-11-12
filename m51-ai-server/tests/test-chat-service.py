"""Real phone chat crash recovery and one-minute post-migration observation."""
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import urllib.request
import json
from common import ROOT, save

service = Path(os.environ["PREFIX"]) / "var/service/m51-chat"
result = {"status": "FAIL", "samples": [], "reboot": "SKIP: actual reboot not performed"}

def pid():
    status = subprocess.check_output(["sv", "status", str(service)], text=True)
    return int(re.search(r"\(pid (\d+)\)", status).group(1))

def ready():
    with urllib.request.urlopen("http://127.0.0.1:8787/api/status", timeout=10) as response:
        return json.load(response)["ready"]

try:
    old = pid()
    args = [s.decode() for s in Path(f"/proc/{old}/cmdline").read_bytes().split(b"\0") if s]
    assert str(ROOT/"scripts/chat-ui.py") in args
    assert args[args.index("--host")+1] == "127.0.0.1"
    assert args[args.index("--upstream")+1] == "http://127.0.0.1:8080"
    result["chat_args"] = args
    started = time.monotonic()
    os.kill(old, signal.SIGKILL)
    while time.monotonic()-started < 30:
        time.sleep(1)
        try:
            if pid() != old and ready():
                break
        except Exception:
            pass
    assert pid() != old and ready()
    result.update(old_pid=old, replacement_pid=pid(), recovery_seconds=time.monotonic()-started)
    start_observation = time.monotonic()
    for index in range(5):
        assert ready()
        current = pid()
        status = Path(f"/proc/{current}/status").read_text()
        rss = next(int(line.split()[1]) for line in status.splitlines() if line.startswith("VmRSS:"))
        result["samples"].append({"seconds": time.monotonic()-start_observation, "chat_pid": current, "chat_rss_kb": rss})
        if index < 4:
            time.sleep(15)
    result.update(status="PASS", observation_seconds=time.monotonic()-start_observation, loopback_upstream_on_phone=True, pc_api_tunnel_required=False)
except Exception as exc:
    result["error"] = str(exc)
save("phone-chat-service-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
