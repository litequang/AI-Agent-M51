"""Verify runit recovers the router and that its old child does not linger."""
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
from common import ROOT, request, save

service = Path(os.environ["PREFIX"]) / "var/service/m51-ai"
binary = str(ROOT / "llama.cpp/build/bin/llama-server")

def own_processes():
    found = []
    for path in Path("/proc").glob("[0-9]*"):
        try:
            args = (path / "cmdline").read_bytes().split(b"\0")
            if args and args[0].decode() == binary:
                found.append(int(path.name))
        except (OSError, UnicodeError):
            pass
    return found

def router_pid():
    status = subprocess.check_output(["sv", "status", str(service)], text=True)
    return int(re.search(r"\(pid (\d+)\)", status).group(1))

result = {"status": "FAIL"}
try:
    old = router_pid()
    previous = own_processes()
    assert old in previous and len(previous) == 2, previous
    result["previous_pids"] = previous
    started = time.monotonic()
    os.kill(old, signal.SIGKILL)
    while time.monotonic()-started < 60:
        time.sleep(2)
        try:
            health, _ = request("/health", timeout=5)
            if health["status"] == "ok" and router_pid() != old:
                break
        except Exception:
            pass
    response, seconds = request("/v1/chat/completions", {"model": "qwen3.5-2b", "messages": [{"role": "user", "content": "Thủ đô Việt Nam là thành phố nào? Trả lời ngắn."}], "max_tokens": 64, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False}}, timeout=240)
    assert "Hà Nội" in (response["choices"][0]["message"]["content"] or "")
    after = own_processes()
    assert len(after) == 2, f"Unexpected lingering model/router processes: {after}"
    assert not set(previous).intersection(after), "Old router/model process lingered"
    result.update(status="PASS", replacement_pids=after, recovery_including_generation_seconds=time.monotonic()-started, response_model=response.get("model"), response=response["choices"][0]["message"]["content"])
except Exception as exc:
    result["error"] = str(exc)
save("router-recovery-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
