"""Exercise actual svlogd size rotation on isolated synthetic logs."""
import json
from pathlib import Path
import subprocess
import tempfile
import time
from common import save

result = {"status": "FAIL"}
try:
    with tempfile.TemporaryDirectory(prefix="m51-log-qa-") as directory:
        log = Path(directory)
        (log / "config").write_text("s65536\nn2\n")
        proc = subprocess.Popen(["svlogd", "-tt", directory], stdin=subprocess.PIPE)
        try:
            for _ in range(1800):
                proc.stdin.write(b"synthetic-rotation-test " + b"x" * 250 + b"\n")
            proc.stdin.close()
            proc.wait(timeout=20)
        finally:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=10)
        files = {file.name: file.stat().st_size for file in log.iterdir() if file.is_file()}
        rotated = [name for name in files if name.startswith("@")]
        assert rotated, "No rotation occurred"
        assert len(rotated) <= 2, "Retention count exceeded"
        assert files.get("current", 0) < 65536 + 1024, "Current log exceeds configured size"
        result.update(status="PASS", observed_files=files, isolation="temporary synthetic logs; production logs untouched")
except Exception as exc:
    result["error"] = str(exc)
save("log-rotation-results", result)
raise SystemExit(0 if result["status"] == "PASS" else 1)
