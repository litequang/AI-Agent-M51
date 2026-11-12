"""Lightweight model health watchdog. No root or thermal override."""
import datetime
import importlib.util
import json
import re
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("manage", ROOT / "scripts/manage-ai.py")
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)


def sensors():
    values = {}
    for zone in Path("/sys/class/thermal").glob("thermal_zone*"):
        try:
            name = (zone / "type").read_text().strip()
            raw = float((zone / "temp").read_text().strip())
            values[name] = raw / 1000 if abs(raw) > 200 else raw
        except (OSError, ValueError):
            pass
    return values


def snapshot():
    status = subprocess.run(["sv", "status", str(manage.SERVICE)], text=True, capture_output=True).stdout.strip()
    mem = {line.split(":")[0]: line.split(":")[1].strip() for line in Path("/proc/meminfo").read_text().splitlines() if line.startswith(("MemTotal:", "MemAvailable:", "SwapFree:"))}
    record = {"time": datetime.datetime.now().astimezone().isoformat(), "service": status, "memory": mem, "thermal_c": sensors()}
    battery = Path("/sys/class/power_supply/battery")
    try:
        record["battery_c"] = float((battery / "temp").read_text()) / 10
        record["battery_percent"] = int((battery / "capacity").read_text())
        record["battery_status"] = (battery / "status").read_text().strip()
    except (OSError, ValueError):
        record["battery_inspection"] = "SKIP: sysfs battery access unavailable"
    match = re.search(r"\(pid (\d+)\)", status)
    if match:
        record["server_pid"] = int(match.group(1))
        try:
            for line in Path(f"/proc/{match.group(1)}/status").read_text().splitlines():
                if line.startswith("VmRSS:"):
                    record["server_rss_kb"] = int(line.split()[1])
        except OSError:
            pass
    return record


if __name__ == "__main__":
    failures = 0
    grace = time.monotonic() + 300
    while True:
        try:
            manage.health()
            failures = 0
        except Exception:
            if time.monotonic() > grace:
                failures += 1
        record = snapshot()
        record["health_failures"] = failures
        temporary = ROOT / "run/monitor.tmp"
        temporary.write_text(json.dumps(record, indent=2))
        temporary.replace(ROOT / "run/monitor.json")
        print(json.dumps(record), flush=True)
        if failures >= 3:
            print("Unhealthy three times after startup grace: restarting own AI service", flush=True)
            subprocess.run(["sv", "-w", "30", "restart", str(manage.SERVICE)], check=False)
            grace = time.monotonic() + 300
            failures = 0
        time.sleep(30)
