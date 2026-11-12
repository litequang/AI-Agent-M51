"""Collect reproducible runtime evidence; never read or report secret values."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    return {"exit_code": result.returncode, "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}


result = {"timestamp": datetime.datetime.now().astimezone().isoformat()}
result["package_audit"] = run(["dpkg", "--audit"])
result["curl"] = run(["curl", "--version"])
result["openssl"] = run(["openssl", "version"])
result["uname"] = run(["uname", "-a"])
result["whoami"] = run(["whoami"])
result["version"] = run([str(ROOT / "llama.cpp/build/bin/llama-server"), "--version"])
result["source_commit"] = run(["git", "-C", str(ROOT / "llama.cpp"), "rev-parse", "HEAD"])
result["source_changes"] = run(["git", "-C", str(ROOT / "llama.cpp"), "diff", "--stat"])
result["android_patch"] = "docs/android-subprocess.patch; SUBPROCESS_HAVE_CWD=0 in common/subproc.h on Android only"
result["services"] = run(["sv", "status", os.environ["PREFIX"] + "/var/service/m51-ai", os.environ["PREFIX"] + "/var/service/m51-ai-watch", os.environ["PREFIX"] + "/var/service/m51-tailscale"])
match = re.search(r"\(pid (\d+)\)", result["services"]["stdout"])
if match:
    pid = match.group(1)
    result["server_pid"] = int(pid)
    args = Path(f"/proc/{pid}/cmdline").read_bytes().decode().strip("\0").split("\0")
    result["server_args"] = args  # Contains credential FILE PATH only, never its content.
    result["loopback_configured"] = args[args.index("--host") + 1] == "127.0.0.1"
    result["api_key_file_configured"] = "--api-key-file" in args
cache = ROOT / "llama.cpp/build/CMakeCache.txt"
result["build_settings"] = [line for line in cache.read_text().splitlines() if line.startswith(("GGML_NATIVE:", "GGML_CPU_ARM_ARCH:", "GGML_OPENMP:", "GGML_VULKAN:", "GGML_CUDA:", "CMAKE_BUILD_TYPE:", "LLAMA_SUBPROCESS:"))]
monitor = ROOT / "run/monitor.json"
if monitor.exists():
    result["monitor"] = json.loads(monitor.read_text())
result["status"] = "PASS" if result["version"]["exit_code"] == 0 and result.get("loopback_configured") and result.get("api_key_file_configured") and not result["package_audit"]["stdout"] else "FAIL"
(ROOT / "docs/build-runtime.json").write_text(json.dumps(result, indent=2))
print("Runtime evidence saved; status=" + result["status"])
