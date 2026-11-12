"""Use the vendor's supported no-CWD override on Termux's Android SDK.

The router inherits its CWD and never supplies process_cwd. A caller requesting
a changed CWD will receive ENOSYS instead of silently ignoring that request.
Only this exact, reversible patch is accepted in the pinned source checkout.
"""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "llama.cpp"
relative = "common/subproc.h"
original = subprocess.check_output(["git", "-C", str(source), "show", "HEAD:" + relative])
prefix = b"#if defined(__ANDROID__)\n#define SUBPROCESS_HAVE_CWD 0\n#endif\n\n"
target = source / relative
actual = target.read_bytes()
if actual not in (original, prefix + original):
    raise SystemExit("Refusing to overwrite unexpected subproc.cpp changes")
changed = subprocess.check_output(["git", "-C", str(source), "diff", "--name-only"], text=True).splitlines()
if any(name not in (relative, "common/subproc.cpp") for name in changed):
    raise SystemExit("Unexpected source changes; review before building")
legacy = source / "common/subproc.cpp"
legacy_original = subprocess.check_output(["git", "-C", str(source), "show", "HEAD:common/subproc.cpp"])
if legacy.read_bytes() not in (legacy_original, prefix + legacy_original):
    raise SystemExit("Unexpected subproc.cpp changes")
if legacy.read_bytes() != legacy_original:
    legacy.write_bytes(legacy_original)
target.write_bytes(prefix + original)
(ROOT / "docs/android-subprocess.patch").write_text(subprocess.check_output(["git", "-C", str(source), "diff", "--", relative], text=True), encoding="utf-8")
print("PASS: Android subprocess no-CWD compatibility override applied")
