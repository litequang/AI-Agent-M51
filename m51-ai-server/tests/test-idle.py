"""Measure real process CPU ticks and RSS while it receives no inference requests."""
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from common import request, save

result = {"status": "FAIL"}
try:
    request("/health")
    status = subprocess.check_output(["sv", "status", os.environ["PREFIX"] + "/var/service/m51-ai"], text=True)
    pid = int(re.search(r"\(pid (\d+)\)", status).group(1))

    def ticks():
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
        return int(fields[11]) + int(fields[12])

    time.sleep(5)
    before, started = ticks(), time.monotonic()
    time.sleep(20)
    elapsed = time.monotonic() - started
    usage = 100 * (ticks() - before) / os.sysconf("SC_CLK_TCK") / elapsed
    result.update(pid=pid, idle_cpu_percent_one_core=usage, measured_seconds=elapsed)
    for line in Path(f"/proc/{pid}/status").read_text().splitlines():
        if line.startswith(("VmRSS:", "VmHWM:")):
            result[line.split(":")[0] + "_kb"] = int(line.split()[1])
    assert usage < 15, "Idle CPU usage remains high"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("idle-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
