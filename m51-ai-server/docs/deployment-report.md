# Deployment report

Generated: 2026-11-12T20:45:03.629040+07:00

| Item | Status | Evidence / limitation |
|---|---|---|
| Termux curl/OpenSSL and package audit | PASS | See build-runtime.json and hardware report |
| SSH Ed25519 key and m51-ai alias | PASS | Actual uname/whoami command over key login |
| llama.cpp Android ARM64 build / model load | PASS | Actual binary version, args and running service |
| Exact model bytes, GGUF and SHA256 | PASS | 1107409472 bytes |
| HTTP API and five repeated requests | PASS | api-results.json |
| Vietnamese sample | PASS | vietnamese-results.json |
| Summary, owners, urgency and JSON | PASS | summary-results.json; initial FAIL retained separately |
| Additional fast-mode arithmetic probe | FAIL | Initial repeated-request experiment exposed formatting/arithmetic errors; kept separately from HTTP availability |
| Crash recovery | PASS | 2.03 seconds |
| Safe stop and restart | PASS | lifecycle-results.json |
| Idle CPU | PASS | 0.0% of one core |
| Log rotation | PASS | Actual svlogd rotation using isolated synthetic data |
| API credential and secret-free logs | PASS | Unauthenticated API rejected; logs inspected without printing secrets |
| PC SSH tunnel / LAN API port closed | PASS | Actual PC HTTP request and direct LAN socket probe |
| LAN chat UI and streamed generation | PASS | chat-ui-results.json; actual M51 LAN GET also returned HTTP 200 |
| Browser visual QA | SKIP | Browser/native control host unavailable; HTTP and streaming tests passed |
| Initial 30 minute stability | PASS | 1800.0 measured seconds; PASS |
| Tailscale private remote access | PASS | PC verified SSH key over Tailscale address and API request through its SSH tunnel |
| Real 4G/5G path | SKIP | Requires a client actually outside the LAN |
| Real reboot / Termux:Boot | SKIP | Hooks installed; reboot not performed to preserve remote access |
| Android battery optimization exemption | SKIP | Android denies dumpsys deviceidle without elevated permission |
| 24-72 hour endurance | SKIP | Follow-up plan in README; not represented as completed |

Only synthetic conversations were used. No Zalo data or Magisk/root access was used. No router port forwarding or public API binding was configured.

Local API: `http://127.0.0.1:18080` through the PC SSH tunnel. Credentials are stored in `secrets/ai-api.key` with restricted permissions and are excluded from source control.

The initial summary failed semantic checks (omitted hazard and invented a deadline). The revised prompt explicitly asks for both ordinary work and incidents, confirmed owners only, and full quoted evidence. Initial output remains in summary-initial-results.json. Passing these samples is not a general accuracy guarantee.

Fast-mode arithmetic also produced wrong answers/formatting; see api-initial-results.json. A 192-token thinking experiment did not finish its JSON answer. HTTP availability is tested separately with five nonempty completed greeting responses. Structured extraction passed using thinking with a larger token budget; it took about two minutes for the sample.

The phone was discharging during initial setup. Continuous 24/7 operation still requires an adequate power source and verified Android background survival. Thermal/battery protection remains enabled.
