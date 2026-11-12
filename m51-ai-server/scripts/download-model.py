"""Download exactly the requested GGUF; verify revision, bytes, SHA256 and magic."""
import hashlib
import fcntl
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request
import sys

ROOT = Path(__file__).resolve().parents[1]
REPO = "unsloth/Qwen3-1.7B-GGUF"
NAME = "Qwen3-1.7B-Q4_K_M.gguf"
EXPECTED_SHA = "b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897"
if len(sys.argv) > 1:
    if sys.argv[1:] != ["qwen3.5-2b"]:
        raise SystemExit("Expected optional argument qwen3.5-2b")
    REPO = "unsloth/Qwen3.5-2B-GGUF"
    NAME = "Qwen3.5-2B-Q4_K_M.gguf"
    EXPECTED_SHA = "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223"


def main():
    request = urllib.request.Request(f"https://huggingface.co/api/models/{REPO}?blobs=true", headers={"User-Agent": "m51-local-ai-setup/1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        metadata = json.load(response)
    file = next(f for f in metadata["siblings"] if f["rfilename"] == NAME)
    lfs = file["lfs"]
    size, sha = int(lfs["size"]), lfs["sha256"]
    if sha != EXPECTED_SHA:
        raise RuntimeError("Published model hash changed; review the official source before downloading")
    revision = metadata["sha"]
    dest = ROOT / "models" / NAME
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_suffix(".gguf.part")
    if not dest.exists():
        if shutil.disk_usage(dest.parent).free < size + 512 * 1024**2:
            raise RuntimeError("Insufficient free space for model and safety margin")
        subprocess.run(["curl", "--fail", "--location", "--proto", "=https", "--proto-redir", "=https", "--retry", "5", "--retry-delay", "3", "--continue-at", "-", "--output", str(partial), f"https://huggingface.co/{REPO}/resolve/{revision}/{NAME}"], check=True)
        candidate = partial
    else:
        candidate = dest
    digest = hashlib.sha256()
    with candidate.open("rb") as stream:
        if stream.read(4) != b"GGUF":
            raise RuntimeError("Not a GGUF file")
        stream.seek(0)
        for chunk in iter(lambda: stream.read(4 * 1024**2), b""):
            digest.update(chunk)
    if candidate.stat().st_size != size or digest.hexdigest() != sha:
        raise RuntimeError("Model byte count/SHA256 mismatch; file preserved for diagnosis, not loaded")
    if candidate != dest:
        candidate.replace(dest)
    report = {"status": "PASS", "repository": REPO, "revision": revision, "file": NAME, "bytes": size, "sha256": sha}
    report_name = "model-qwen35-verification.json" if "3.5" in NAME else "model-verification.json"
    (ROOT / "docs" / report_name).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    (ROOT / "models").mkdir(exist_ok=True)
    with (ROOT / "models/download.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        main()
