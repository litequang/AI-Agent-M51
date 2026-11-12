"""Kill only this deployment's verified llama PID, then verify runit recovery."""
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from common import ROOT, request, save

service = Path(os.environ["PREFIX"]) / "var/service/m51-ai"


def pid():
    status = subprocess.check_output(["sv", "status", str(service)], text=True)
    return int(re.search(r"\(pid (\d+)\)", status).group(1))


result = {"status": "FAIL"}
try:
    request("/health")
    old = pid()
    actual = Path(f"/proc/{old}/cmdline").read_bytes().split(b"\0")[0].decode()
    assert actual == str(ROOT / "llama.cpp/build/bin/llama-server"), "Refusing to signal an unrelated process"
    result["old_pid"] = old
    started = time.monotonic()
    os.kill(old, signal.SIGKILL)
    while time.monotonic() - started < 240:
        time.sleep(2)
        try:
            healthy, _ = request("/health", timeout=5)
            new = pid()
            if healthy.get("status") == "ok" and new != old:
                result.update(status="PASS", new_pid=new, recovery_seconds=time.monotonic() - started)
                break
        except Exception:
            pass
    assert result["status"] == "PASS", "No healthy replacement process within 240 seconds"
except Exception as exc:
    result["error"] = str(exc)
save("recovery-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
