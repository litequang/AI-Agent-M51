# AI Agent M51 — instructions for the next agent

Read `HANDOFF.md` first. The actual implementation is in `m51-ai-server/`.
Read the measured JSON/Markdown reports in `m51-ai-server/docs/` before claiming a capability works.

## Access and authorization

- Work from the existing Windows PC where possible. The user requests PC-only operation; do not ask them to type Termux commands when SSH can do the work.
- `ssh m51-ai` is LAN access; `ssh m51-ai-remote` is private Tailscale access. Both use the dedicated local Ed25519 key. Never log or upload that key.
- The private API credential is `m51-ai-server/secrets/ai-api.key` on the PC and the matching deployment path on M51. Read credentials from files in process memory; do not echo them or pass values in shell arguments.
- Never commit/upload `secrets`, `.ssh`, logs, runtime directories, model binaries, Tailscale binaries/state or real Zalo data. The GitHub repository is PUBLIC.
- The user authorized uploading this implementation to this repository. Use a separate branch; do not merge/release without a new explicit instruction.

## Runtime constraints

- Keep llama.cpp listening at `127.0.0.1:8080`, CPU only. No router forwarding or public Funnel.
- The primary chat now runs ON M51 as runit service m51-chat, bound to 127.0.0.1:8787 and calling the phone API at 127.0.0.1:8080 directly. Phone Tailscale Serve forwards private TCP8787 to this listener and preserves SSH8022. No PC backend or API tunnel is required. Keep the model key outside browser code.
- The former PC chat, both PC API tunnels and PC Serve8787 mapping were stopped. Their scripts are legacy optional helpers, not the primary architecture. See phone-chat.md and phone-pc-independence-results.json. Real cellular/reboot tests remain unverified.
- Do not use Magisk/root, reinstall Termux, delete phone data or weaken Android thermal/battery protection to solve routine setup issues.
- Preserve the Tailscale daemon's restricted helper PATH and explicit state directory. Official Linux binaries otherwise hit Android's blocked `faccessat2` syscall after login.
- Router mode uses `--models-max 1` and `LLAMA_SUBPROCESS=ON`. Keep the chosen model in every template, tokenize and chat request. The old 30-minute benchmark applies only to the original single-model deployment.
- Keep model/source checksums and actual build commit evidence. Do not silently download alternative large models.

## Validation

- Use real API/SSH checks for runtime changes; Windows syntax checks alone do not establish Android correctness.
- Report PASS, FAIL and SKIP separately. Real 4G/5G, reboot survival, battery exemption and 24–72h endurance are not yet verified.
- Fast/non-thinking mode produced wrong arithmetic and assignment extraction. Structured extraction passed with thinking enabled and a larger output budget; do not erase the failed experiments or imply general accuracy.
- Never feed real Zalo messages into setup tests.
- A 30-minute soak already passed. Repeat an appropriate soak after material runtime/resource changes; do not rerun long tests merely to restate a passed result.

## Planned Zalo Gateway project (not yet deployed)
Read docs/ZALO_GATEWAY_ROADMAP_V1.md and docs/CODEX_ZALO_GATEWAY_PHASE01.md for scope, sourcing, model-cost recommendations and mandatory gates. Phase 01 is **mock-first**; this instruction alone does not authorize logging into any real Zalo account, fetching history, sending real messages, changing AI runtime or exposing new ports.
