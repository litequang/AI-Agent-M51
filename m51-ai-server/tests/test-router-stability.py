"""Five-minute post-change router soak, separate from the original 30-minute soak."""
import json
import sys
import time
from pathlib import Path
from common import ROOT, request, save

result = {"status": "RUNNING", "scope": "300-second post-change router/resource soak; not 24h endurance", "samples": [], "requests": [], "failures": []}
started = time.monotonic()
next_request = 0

def processes():
    items = []
    target = str(ROOT / "llama.cpp/build/bin/llama-server").encode()
    for directory in Path("/proc").glob("[0-9]*"):
        try:
            cmd = (directory / "cmdline").read_bytes().split(b"\0")
            if not cmd or cmd[0] != target:
                continue
            status = (directory / "status").read_text()
            rss = next(int(line.split()[1]) for line in status.splitlines() if line.startswith("VmRSS:"))
            items.append({"pid": int(directory.name), "rss_kb": rss, "args": [value.decode() for value in cmd if value]})
        except (OSError, StopIteration):
            pass
    return items

while time.monotonic() - started < 300:
    try:
        health, _ = request("/health", timeout=10)
        assert health["status"] == "ok"
        models, _ = request("/models", timeout=10)
        loaded = [item["id"] for item in models["data"] if item.get("status", {}).get("value") == "loaded"]
        assert len(loaded) == 1, f"Expected exactly one loaded model: {loaded}"
        sample = {"elapsed_seconds": time.monotonic()-started, "loaded": loaded, "processes": processes()}
        sample["total_rss_kb"] = sum(item["rss_kb"] for item in sample["processes"])
        assert len(sample["processes"]) <= 2, "More than router plus one model process"
        monitor = ROOT / "run/monitor.json"
        if monitor.exists():
            sample["monitor"] = json.loads(monitor.read_text())
        result["samples"].append(sample)
        if sample["elapsed_seconds"] >= next_request:
            response, seconds = request("/v1/chat/completions", {"model": "qwen3.5-2b", "messages": [{"role": "user", "content": "Thủ đô Việt Nam là thành phố nào? Trả lời ngắn."}], "max_tokens": 64, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False}}, timeout=240)
            content = response["choices"][0]["message"]["content"] or ""
            assert "Hà Nội" in content, content
            result["requests"].append({"model": response.get("model"), "seconds": seconds, "content": content, "timings": response.get("timings", {})})
            next_request = time.monotonic()-started+60
    except Exception as exc:
        result["failures"].append(str(exc))
    result["elapsed_seconds"] = time.monotonic()-started
    (ROOT / "docs/router-stability-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"router-soak elapsed={result['elapsed_seconds']:.0f}s failures={len(result['failures'])}", flush=True)
    time.sleep(min(15, max(0, 300-(time.monotonic()-started))))
result["elapsed_seconds"] = time.monotonic()-started
result["status"] = "PASS" if not result["failures"] else "FAIL"
save("router-stability-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
