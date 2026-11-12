"""30 minute soak: health checks, periodic synthetic generation, RAM and sensors."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time
from common import ROOT, chat, request, save

parser = argparse.ArgumentParser()
parser.add_argument("--minutes", type=float, default=30)
args = parser.parse_args()
if args.minutes < 30:
    raise SystemExit("Initial stability acceptance requires >=30 minutes")
result = {"status": "RUNNING", "requested_minutes": args.minutes, "samples": [], "requests": []}
started = time.monotonic()
next_request = 0
failures = []
try:
    while time.monotonic() - started < args.minutes * 60:
        elapsed = time.monotonic() - started
        sample = {"elapsed_seconds": elapsed}
        try:
            sample["health"], sample["health_seconds"] = request("/health", timeout=10)
            assert sample["health"].get("status") == "ok"
            monitor = ROOT / "run/monitor.json"
            if monitor.exists():
                sample["monitor"] = json.loads(monitor.read_text())
            sample["processes"] = subprocess.run(["ps", "-eo", "pid,pcpu,rss,comm"], capture_output=True, text=True).stdout
            if elapsed >= next_request:
                response = chat("Tính 7+5. Chỉ ghi số kết quả.", max_tokens=16)
                assert response["content"].strip().rstrip(".") == "12", response["content"]
                result["requests"].append(response)
                next_request = time.monotonic() - started + 120
        except Exception as exc:
            sample["error"] = str(exc)
            failures.append(str(exc))
        result["samples"].append(sample)
        result["elapsed_seconds"] = time.monotonic() - started
        (ROOT / "docs/stability-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(f"elapsed={result['elapsed_seconds']:.0f}s samples={len(result['samples'])} failures={len(failures)}", flush=True)
        time.sleep(min(15, max(0, args.minutes * 60 - (time.monotonic() - started))))
    result["elapsed_seconds"] = time.monotonic() - started
    result["status"] = "PASS" if not failures and result["elapsed_seconds"] >= 1800 else "FAIL"
except Exception as exc:
    failures.append(str(exc))
    result["status"] = "FAIL"
result["failures"] = failures
save("stability-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
