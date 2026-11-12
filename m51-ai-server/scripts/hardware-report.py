import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=12)
        return (result.stdout + result.stderr).strip() or f"exit={result.returncode}, no output"
    except Exception as exc:
        return f"SKIP: {exc}"


def read(path):
    try:
        return Path(path).read_text().strip()
    except OSError as exc:
        return f"SKIP: {exc}"


if __name__ == "__main__":
    checks = {
        "Timestamp": datetime.datetime.now().astimezone().isoformat(),
        "Kernel and architecture": command(["uname", "-a"]),
        "Model": command(["getprop", "ro.product.model"]),
        "Android release": command(["getprop", "ro.build.version.release"]),
        "Android SDK": command(["getprop", "ro.build.version.sdk"]),
        "CPU cores available to Termux": str(os.cpu_count()),
        "CPU possible": read("/sys/devices/system/cpu/possible"),
        "CPU online": read("/sys/devices/system/cpu/online"),
        "CPU flags": command(["sh", "-c", "cat /proc/cpuinfo"]),
        "Memory": read("/proc/meminfo"),
        "Disk": str(shutil.disk_usage(Path.home())),
        "Termux package versions": command(["dpkg-query", "-W", "termux-tools", "apt", "dpkg", "curl", "libcurl", "openssl", "openssh"]),
        "Termux app info": command(["termux-info"]),
        "Package audit (empty output means no issues)": command(["dpkg", "--audit"]),
        "curl linkage": command(["curl", "--version"]),
        "OpenSSL linkage": command(["openssl", "version"]),
        "Termux Android apps": command(["/system/bin/pm", "list", "packages", "com.termux"]),
        "Termux app version (may be permission restricted)": command(["/system/bin/dumpsys", "package", "com.termux"]),
        "Magisk binary without privilege request": shutil.which("magisk") or "SKIP: not visible in Termux PATH; no su/root request made",
        "Battery state": command(["/system/bin/dumpsys", "battery"]),
        "Battery temperature tenths Celsius (sysfs)": read("/sys/class/power_supply/battery/temp"),
        "Battery capacity percent (sysfs)": read("/sys/class/power_supply/battery/capacity"),
        "Battery charge state (sysfs)": read("/sys/class/power_supply/battery/status"),
        "Battery optimization whitelist": command(["/system/bin/dumpsys", "deviceidle", "whitelist"]),
    }
    thermal = {}
    for zone in Path("/sys/class/thermal").glob("thermal_zone*"):
        thermal[zone.name] = {"type": read(zone / "type"), "temp": read(zone / "temp")}
        for trip in zone.glob("trip_point_*_temp"):
            thermal[zone.name][trip.name] = read(trip)
    checks["Thermal sensors and OS trip limits"] = json.dumps(thermal, indent=2)
    text = "# M51 hardware report\n\nCollected over verified SSH key authentication. No Zalo data or root access.\n\n"
    for title, value in checks.items():
        text += f"## {title}\n\n```text\n{value}\n```\n\n"
    text += "Android permissions may block battery, thermal or app-version inspection. Such results are SKIP, not PASS. Reboot/autostart and battery exemption require separate verification.\n"
    (ROOT / "docs/m51-hardware-report.md").write_text(text, encoding="utf-8")
    print(text)
