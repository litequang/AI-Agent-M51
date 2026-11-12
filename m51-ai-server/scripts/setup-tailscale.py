"""Create a supervised userspace Tailscale daemon. No phone VPN permission/root."""
import importlib.util
import os
from pathlib import Path
import shlex
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("manage", ROOT / "scripts/manage-ai.py")
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)
prefix = Path(os.environ["PREFIX"])
service = prefix / "var/service/m51-tailscale"
service.mkdir(parents=True, exist_ok=True)
(service / "down").touch()
(ROOT / "secrets").mkdir(mode=0o700, exist_ok=True)
logdir = ROOT / "logs/m51-tailscale"
logdir.mkdir(parents=True, exist_ok=True)
(logdir / "config").write_text("s1048576\nn3\nt86400\n")
manage.write_executable(service / "run", f"exec 2>&1\nexec {prefix}/bin/python {shlex.quote(str(ROOT / 'scripts/tailscale-daemon.py'))}\n")
manage.write_executable(service / "log/run", f"exec {prefix}/bin/svlogd -tt {shlex.quote(str(logdir))}\n")
manage.ensure_daemon(service)
(service / "down").unlink(missing_ok=True)
subprocess.run(["sv", "up", str(service)], check=True)
time.sleep(3)
subprocess.run([str(ROOT / "tailscale/tailscale"), "--socket=" + str(ROOT / "run/tailscaled.sock"), "version"], check=True)
print("Userspace daemon service installed. Tailnet authentication still required.")
