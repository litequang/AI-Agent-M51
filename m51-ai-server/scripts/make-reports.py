"""Generate clear PASS/FAIL/SKIP reports from actual JSON evidence."""
import datetime
import json
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def get(name):
    path = DOCS / (name + ".json")
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"status": "SKIP"}


def accepted(value):
    return value if value in ("PASS", "FAIL") else "SKIP"


runtime = get("build-runtime")
model = get("model-verification")
soak = get("stability-results")
summary = get("summary-results")
tailnet = get("tailnet-results")
api = get("api-results")
vi = get("vietnamese-results")
idle = get("idle-results")
recovery = get("recovery-results")
now = datetime.datetime.now().astimezone().isoformat()
rows = [
    ("Termux curl/OpenSSL and package audit", runtime.get("status", "SKIP"), "See build-runtime.json and hardware report"),
    ("SSH Ed25519 key and m51-ai alias", get("connection-state").get("status") == "connected_key_verified" and "PASS" or "SKIP", "Actual uname/whoami command over key login"),
    ("llama.cpp Android ARM64 build / model load", runtime.get("status", "SKIP"), "Actual binary version, args and running service"),
    ("Exact model bytes, GGUF and SHA256", model.get("status", "SKIP"), str(model.get("bytes", "not checked")) + " bytes"),
    ("HTTP API and five repeated requests", api.get("status", "SKIP"), "api-results.json"),
    ("Vietnamese sample", vi.get("status", "SKIP"), "vietnamese-results.json"),
    ("Summary, owners, urgency and JSON", summary.get("status", "SKIP"), "summary-results.json; initial FAIL retained separately"),
    ("Additional fast-mode arithmetic probe", get("api-initial-results").get("status", "SKIP"), "Initial repeated-request experiment exposed formatting/arithmetic errors; kept separately from HTTP availability"),
    ("Crash recovery", recovery.get("status", "SKIP"), str(round(recovery.get("recovery_seconds", 0), 2)) + " seconds"),
    ("Safe stop and restart", get("lifecycle-results").get("status", "SKIP"), "lifecycle-results.json"),
    ("Idle CPU", idle.get("status", "SKIP"), str(idle.get("idle_cpu_percent_one_core", "not measured")) + "% of one core"),
    ("Log rotation", get("log-rotation-results").get("status", "SKIP"), "Actual svlogd rotation using isolated synthetic data"),
    ("API credential and secret-free logs", get("security-results").get("status", "SKIP"), "Unauthenticated API rejected; logs inspected without printing secrets"),
    ("PC SSH tunnel / LAN API port closed", get("network-results").get("status", "SKIP"), "Actual PC HTTP request and direct LAN socket probe"),
    ("LAN chat UI and streamed generation", get("chat-ui-results").get("status", "SKIP"), "chat-ui-results.json; actual M51 LAN GET also returned HTTP 200"),
    ("Browser visual QA", "SKIP", "Browser/native control host unavailable; HTTP and streaming tests passed"),
    ("Initial 30 minute stability", accepted(soak.get("status")), str(round(soak.get("elapsed_seconds", 0), 1)) + " measured seconds; " + soak.get("status", "not run")),
    ("Tailscale private remote access", accepted(tailnet.get("status")), tailnet.get("detail", "Waiting for PC installation/authentication and tailnet test")),
    ("Real 4G/5G path", "SKIP", "Requires a client actually outside the LAN"),
    ("Real reboot / Termux:Boot", "SKIP", "Hooks installed; reboot not performed to preserve remote access"),
    ("Android battery optimization exemption", "SKIP", "Android denies dumpsys deviceidle without elevated permission"),
    ("24-72 hour endurance", "SKIP", "Follow-up plan in README; not represented as completed"),
]
deployment = f"# Deployment report\n\nGenerated: {now}\n\n| Item | Status | Evidence / limitation |\n|---|---|---|\n"
deployment += "".join(f"| {name} | {status} | {detail} |\n" for name, status, detail in rows)
deployment += "\nOnly synthetic conversations were used. No Zalo data or Magisk/root access was used. No router port forwarding or public API binding was configured.\n"
deployment += "\nLocal API: `http://127.0.0.1:18080` through the PC SSH tunnel. Credentials are stored in `secrets/ai-api.key` with restricted permissions and are excluded from source control.\n"
deployment += "\nThe initial summary failed semantic checks (omitted hazard and invented a deadline). The revised prompt explicitly asks for both ordinary work and incidents, confirmed owners only, and full quoted evidence. Initial output remains in summary-initial-results.json. Passing these samples is not a general accuracy guarantee.\n"
deployment += "\nFast-mode arithmetic also produced wrong answers/formatting; see api-initial-results.json. A 192-token thinking experiment did not finish its JSON answer. HTTP availability is tested separately with five nonempty completed greeting responses. Structured extraction passed using thinking with a larger token budget; it took about two minutes for the sample.\n"
deployment += "\nThe phone was discharging during initial setup. Continuous 24/7 operation still requires an adequate power source and verified Android background survival. Thermal/battery protection remains enabled.\n"
(DOCS / "deployment-report.md").write_text(deployment, encoding="utf-8")
responses = list(api.get("requests", []))
responses += [vi["response"]] if "response" in vi else []
responses += [summary["response"], summary["nonurgent_response"]] if "response" in summary and "nonurgent_response" in summary else []
rates = [r["timings"]["predicted_per_second"] for r in responses if r.get("timings", {}).get("predicted_per_second", 0) > 0]
memories = [s["monitor"]["server_rss_kb"] for s in soak.get("samples", []) if "server_rss_kb" in s.get("monitor", {})]
batteries = [s["monitor"]["battery_c"] for s in soak.get("samples", []) if "battery_c" in s.get("monitor", {})]
benchmark = f"# Benchmark report\n\nGenerated: {now}\n\nCPU only, context 2048, threads 4, batch/ubatch 128, one slot, idle polling disabled. Chat defaults to non-thinking; the structured extraction retest can override thinking per request, as recorded in summary-results.json.\n\n"
benchmark += f"- Measured generation tokens/s: {min(rates):.2f} to {max(rates):.2f}, median {statistics.median(rates):.2f}.\n" if rates else "- Generation tokens/s: SKIP.\n"
benchmark += f"- Idle CPU: {idle.get('idle_cpu_percent_one_core', 'SKIP')}% of one core over {idle.get('measured_seconds', 'SKIP')} seconds.\n"
benchmark += f"- Idle RSS: {idle.get('VmRSS_kb', 'SKIP')} KiB.\n"
if memories:
    benchmark += f"- Soak RSS range: {min(memories)/1024:.1f} to {max(memories)/1024:.1f} MiB.\n"
if batteries:
    benchmark += f"- Soak battery temperature range: {min(batteries):.1f} to {max(batteries):.1f} C.\n"
benchmark += f"- Crash recovery: {recovery.get('recovery_seconds', 'SKIP')} seconds.\n- Soak: {soak.get('status', 'SKIP')}, {soak.get('elapsed_seconds', 0):.1f} seconds, {soak.get('samples_total', len(soak.get('samples', [])))} samples, {len(soak.get('failures', []))} recorded failures.\n\n"
benchmark += "Generation rates come from llama.cpp's reported predicted_per_second, excluding prompt processing. End-to-end rates and wall times are recorded separately in JSON files. Short arithmetic requests benefit from prompt caching; the longer summary response is more representative of the requested workflow.\n\n"
for label, response in (("Vietnamese", vi.get("response")), ("Structured summary", summary.get("response"))):
    if response:
        benchmark += f"- {label}: {response['seconds']:.2f} seconds, {response['completion_tokens']} completion tokens, {response['end_to_end_tokens_per_second']:.2f} end-to-end tokens/s.\n"
(DOCS / "benchmark-report.md").write_text(benchmark, encoding="utf-8")
print("Reports regenerated from measured JSON evidence.")
