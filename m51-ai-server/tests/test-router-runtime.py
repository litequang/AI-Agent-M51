"""Check running router/child boundaries and external binding after switching."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from common import ROOT, BASE, request, save

result = {"status": "FAIL"}
try:
    target = str(ROOT / "llama.cpp/build/bin/llama-server").encode()
    processes = []
    key = (ROOT / "secrets/ai-api.key").read_bytes().strip()
    for directory in Path("/proc").glob("[0-9]*"):
        try:
            raw = (directory / "cmdline").read_bytes()
            args = [value.decode() for value in raw.split(b"\0") if value]
            if not args or args[0].encode() != target:
                continue
            assert key not in raw, "API credential present in argv"
            processes.append({"pid": int(directory.name), "args": args})
        except (OSError, UnicodeError):
            continue
    assert len(processes) == 2, "Expected router plus one model"
    router = next(item for item in processes if "--models-max" in item["args"])
    assert router["args"][router["args"].index("--models-max")+1] == "1"
    assert "--api-key-file" in router["args"]
    for item in processes:
        args = item["args"]
        assert "--host" in args and args[args.index("--host")+1] == "127.0.0.1", "Non-loopback listener arguments"
    models, _ = request("/models")
    loaded = [item["id"] for item in models["data"] if item.get("status", {}).get("value") == "loaded"]
    assert loaded == ["qwen3.5-2b"], loaded
    try:
        urllib.request.urlopen(BASE + "/v1/models", timeout=10)
        raise AssertionError("Unauthenticated router access accepted")
    except urllib.error.HTTPError as exc:
        assert exc.code == 401
    result.update(status="PASS", processes=processes, loaded=loaded, models_max=1, all_listeners_loopback_arguments=True, unauthorized_http=401, credential_absent_from_argv=True)
except Exception as exc:
    result["error"] = str(exc)
save("router-runtime", result)
sys.exit(0 if result["status"] == "PASS" else 1)
