"""Supervise the chat on M51 itself; no PC process or SSH API tunnel needed."""
import importlib.util
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("manage", ROOT / "scripts/manage-ai.py")
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)
PREFIX = Path(os.environ["PREFIX"])
SERVICE = PREFIX / "var/service/m51-chat"

def setup():
    for name in ("index.html", "app.js", "style.css"):
        if not (ROOT / "web" / name).is_file():
            raise RuntimeError("Missing chat asset: " + name)
    if not (ROOT / "secrets/ai-api.key").is_file():
        raise RuntimeError("Run AI setup first")
    new = not SERVICE.exists()
    SERVICE.mkdir(parents=True, exist_ok=True)
    if new:
        (SERVICE / "down").touch()
    logs = ROOT / "logs/m51-chat"
    logs.mkdir(parents=True, exist_ok=True)
    (logs / "config").write_text("s2097152\nn5\nt86400\n")
    command = [str(PREFIX/"bin/python"), "-u", str(ROOT/"scripts/chat-ui.py"), "--host", "127.0.0.1", "--port", "8787", "--upstream", "http://127.0.0.1:8080"]
    manage.write_executable(SERVICE/"run", "exec 2>&1\nexec " + shlex.join(command) + "\n")
    manage.write_executable(SERVICE/"log/run", "exec " + str(PREFIX/"bin/svlogd") + " -tt " + shlex.quote(str(logs)) + "\n")
    manage.write_executable(Path.home()/".termux/boot/30-m51-chat", str(PREFIX/"bin/python") + " " + shlex.quote(str(ROOT/"scripts/manage-chat.py")) + " start\n")
    print("PASS: M51 loopback chat service, rotating logs and boot hook installed")

def publish():
    cli = [str(ROOT/"tailscale/tailscale"), "--socket="+str(ROOT/"run/tailscaled.sock")]
    state = json.loads(subprocess.check_output(cli+["status", "--json"]))
    if state["BackendState"] != "Running":
        raise RuntimeError("Authenticate phone Tailscale first")
    config = json.loads(subprocess.check_output(cli+["serve", "status", "--json"]))
    current = config.get("TCP", {}).get("8787")
    if current and current.get("TCPForward") != "127.0.0.1:8787":
        raise RuntimeError("Port 8787 already has a different mapping")
    subprocess.run(cli+["serve", "--bg", "--tcp=8787", "tcp://127.0.0.1:8787"], check=True)
    after = json.loads(subprocess.check_output(cli+["serve", "status", "--json"]))
    for port, mapping in config.get("TCP", {}).items():
        if port != "8787" and after.get("TCP", {}).get(port) != mapping:
            raise RuntimeError("Existing tailnet mapping changed unexpectedly")
    ipv4 = next(ip for ip in state["TailscaleIPs"] if ":" not in ip)
    print("Private M51 chat: http://" + ipv4 + ":8787")

def main():
    action = sys.argv[1]
    if action == "setup":
        setup()
    elif action == "start":
        manage.ensure_daemon(SERVICE)
        (SERVICE/"down").unlink(missing_ok=True)
        subprocess.run(["sv", "up", str(SERVICE)], check=True)
        for _ in range(30):
            try:
                with urllib.request.urlopen("http://127.0.0.1:8787/api/status", timeout=8) as response:
                    data = json.load(response)
                if data.get("ready"):
                    print(json.dumps(data))
                    return
            except Exception:
                pass
            time.sleep(2)
        raise RuntimeError("Chat/API not ready within startup window")
    elif action == "stop":
        (SERVICE/"down").touch()
        subprocess.run(["sv", "-w", "30", "down", str(SERVICE)], check=True)
    elif action == "status":
        subprocess.run(["sv", "status", str(SERVICE)], check=True)
    elif action == "publish":
        publish()
    else:
        raise ValueError("Expected setup/start/stop/status/publish")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)
