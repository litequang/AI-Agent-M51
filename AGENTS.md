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
- The LAN chat UI intentionally binds only to PC `<PC_LAN_IP>:8787`, with a Windows firewall rule restricted to `<LAN_SUBNET>`. Its backend keeps the model key out of browser code.
- Do not use Magisk/root, reinstall Termux, delete phone data or weaken Android thermal/battery protection to solve routine setup issues.
- Preserve the Tailscale daemon's restricted helper PATH and explicit state directory. Official Linux binaries otherwise hit Android's blocked `faccessat2` syscall after login.
- Keep model/source checksums and actual build commit evidence. Do not silently download alternative large models.

## Validation

- Use real API/SSH checks for runtime changes; Windows syntax checks alone do not establish Android correctness.
- Report PASS, FAIL and SKIP separately. Real 4G/5G, reboot survival, battery exemption and 24–72h endurance are not yet verified.
- Fast/non-thinking mode produced wrong arithmetic and assignment extraction. Structured extraction passed with thinking enabled and a larger output budget; do not erase the failed experiments or imply general accuracy.
- Never feed real Zalo messages into setup tests.
- A 30-minute soak already passed. Repeat an appropriate soak after material runtime/resource changes; do not rerun long tests merely to restate a passed result.
