"""Install checksum-verified official static ARM64 Tailscale binaries, without root."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import urllib.request

os.umask(0o077)
ROOT = Path(__file__).resolve().parents[1]
BASE = "https://pkgs.tailscale.com/stable/"


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


if __name__ == "__main__":
    metadata = json.loads(fetch(BASE + "?mode=json"))
    name = metadata["Tarballs"]["arm64"]
    if not re.fullmatch(r"tailscale_[0-9.]+_arm64\.tgz", name):
        raise RuntimeError("Unexpected official ARM64 artifact name")
    expected = fetch(BASE + name + ".sha256").decode().split()[0]
    if not re.fullmatch("[0-9a-f]{64}", expected):
        raise RuntimeError("Invalid official SHA256")
    dest = ROOT / "tailscale"
    dest.mkdir(exist_ok=True)
    archive = dest / name
    subprocess.run(["curl", "--fail", "--location", "--proto", "=https", "--proto-redir", "=https", "--retry", "3", "--output", str(archive), BASE + name], check=True)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise RuntimeError("Tailscale archive checksum mismatch; refusing execution")
    with tarfile.open(archive) as tar:
        for binary in ("tailscale", "tailscaled"):
            member = next(m for m in tar.getmembers() if m.name.endswith("/" + binary) and m.isfile())
            with tar.extractfile(member) as stream:
                (dest / binary).write_bytes(stream.read())
            (dest / binary).chmod(0o700)
    version = subprocess.check_output([str(dest / "tailscale"), "version"], text=True)
    report = {"status": "PASS", "artifact": name, "sha256": expected, "version": version.strip(), "mode": "static ARM64 binary verified; userspace daemon not yet validated"}
    (ROOT / "docs/tailscale-install.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)
