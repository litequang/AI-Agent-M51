"""Termux runit lifecycle. Never bind the AI API outside IPv4 loopback."""
import json
import os
from pathlib import Path
import shlex
import secrets
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PREFIX = Path(os.environ.get("PREFIX", "/data/data/com.termux/files/usr"))
SERVICE = PREFIX / "var/service/m51-ai"
WATCH = PREFIX / "var/service/m51-ai-watch"
os.environ["SVDIR"] = str(SERVICE.parent)


def config():
    values = {"HOST": "127.0.0.1", "PORT": "8080", "CONTEXT": "2048", "THREADS": "4", "GPU_LAYERS": "0", "BATCH": "128", "UBATCH": "128"}
    path = ROOT / "config/server.env"
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            key, value = line.split("=", 1)
            if key.strip() not in {*values, "BUILD_JOBS"}:
                raise ValueError(f"Unknown configuration: {key}")
            values[key.strip()] = value.strip()
    if values["HOST"] != "127.0.0.1" or values["GPU_LAYERS"] != "0":
        raise ValueError("This deployment requires loopback host and CPU-only execution")
    for key in ("PORT", "CONTEXT", "THREADS", "BATCH", "UBATCH"):
        if not values[key].isdigit() or int(values[key]) < 1:
            raise ValueError(f"Invalid {key}")
    if not 1024 <= int(values["PORT"]) <= 65535 or int(values["THREADS"]) > 8 or int(values["CONTEXT"]) > 4096:
        raise ValueError("Configuration exceeds this deployment's resource limits")
    return values


def health():
    c = config()
    with urllib.request.urlopen(f'http://127.0.0.1:{c["PORT"]}/health', timeout=8) as r:
        data = json.load(r)
    if data.get("status") != "ok":
        raise RuntimeError(f"Model not ready: {data}")
    return data


def write_executable(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"#!{PREFIX}/bin/sh\n" + content, encoding="utf-8")
    path.chmod(0o700)


def setup():
    c = config()
    binary = ROOT / "llama.cpp/build/bin/llama-server"
    model = ROOT / "models/Qwen3-1.7B-Q4_K_M.gguf"
    if not binary.is_file() or not model.is_file():
        raise RuntimeError("Build/model missing")
    secret_dir = ROOT / "secrets"
    secret_dir.mkdir(mode=0o700, exist_ok=True)
    api_key = secret_dir / "ai-api.key"
    if not api_key.exists():
        api_key.write_text(secrets.token_urlsafe(32) + "\n")
    api_key.chmod(0o600)
    args = [str(binary), "-m", str(model), "-c", c["CONTEXT"], "-t", c["THREADS"], "-ngl", "0", "--host", "127.0.0.1", "--port", c["PORT"], "-np", "1", "-b", c["BATCH"], "-ub", c["UBATCH"], "--poll", "0", "--poll-batch", "0", "--jinja", "--chat-template-kwargs", '{"enable_thinking":false}', "--no-webui", "--no-slots", "--api-key-file", str(api_key), "--log-verbosity", "2"]
    for service in (SERVICE, WATCH):
        service.mkdir(parents=True, exist_ok=True)
        # Create services down; only explicit start enables them.
        (service / "down").touch()
        logdir = ROOT / "logs" / service.name
        logdir.mkdir(parents=True, exist_ok=True)
        (logdir / "config").write_text("s2097152\nn5\nt86400\n")
        write_executable(service / "log/run", f"exec {PREFIX}/bin/svlogd -tt {shlex.quote(str(logdir))}\n")
    write_executable(SERVICE / "run", "exec 2>&1\ncd " + shlex.quote(str(ROOT)) + "\nexec " + shlex.join(args) + "\n")
    write_executable(WATCH / "run", f"exec 2>&1\nexec {PREFIX}/bin/python {shlex.quote(str(ROOT / 'scripts/health-watch.py'))}\n")
    boot = Path.home() / ".termux/boot/20-m51-ai"
    write_executable(boot, f"timeout 12 {PREFIX}/bin/termux-wake-lock || true\n{PREFIX}/bin/sshd -p 8022 2>/dev/null || true\n{PREFIX}/bin/python {shlex.quote(str(ROOT / 'scripts/manage-ai.py'))} start\n")
    # Termux:Boot is installed, but Android launch permission still needs real reboot verification.
    bashrc = Path.home() / ".bashrc"
    old = bashrc.read_text() if bashrc.exists() else ""
    marker = "# m51-ai autostart"
    if marker not in old:
        bashrc.write_text(old + f"\n{marker}\n({PREFIX}/bin/python {shlex.quote(str(ROOT / 'scripts/manage-ai.py'))} start >> {shlex.quote(str(ROOT / 'logs/autostart.log'))} 2>&1) &\n")
    print("PASS: runit services, rotating logs, Termux start and boot hooks installed")


def ensure_daemon(service=SERVICE):
    script = PREFIX / "etc/profile.d/start-services.sh"
    subprocess.run([str(PREFIX / "bin/bash"), "-c", f"source {shlex.quote(str(script))}"], check=True)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if (service / "supervise/ok").exists():
            return
        time.sleep(0.5)
    raise RuntimeError("runit daemon did not create supervision state")


def sv(*args, check=True):
    return subprocess.run(["sv", *map(str, args)], check=check)


def main():
    action = sys.argv[1]
    if action == "setup":
        setup()
    elif action == "start":
        ensure_daemon()
        try:
            subprocess.run(["termux-wake-lock"], check=False, timeout=12)
        except subprocess.TimeoutExpired:
            print("SKIP: Android wake-lock command timed out; continuing service startup", flush=True)
        for service in (SERVICE, WATCH):
            (service / "down").unlink(missing_ok=True)
            sv("up", service)
        for _ in range(150):
            try:
                print(json.dumps(health()))
                return
            except Exception:
                time.sleep(2)
        raise RuntimeError("Model not healthy within 300 seconds; inspect logs")
    elif action == "stop":
        for service in (WATCH, SERVICE):
            (service / "down").touch()
            result = sv("-w", "30", "down", service, check=False)
            if result.returncode:
                sv("kill", service, check=False)
                sv("down", service)
        print("PASS: AI services stopped; down markers prevent autostart by runit")
    elif action == "health":
        print(json.dumps(health()))
    elif action == "status":
        sv("status", SERVICE, WATCH, check=False)
        print(json.dumps(health()))
    else:
        raise ValueError("Expected setup/start/stop/status/health")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
