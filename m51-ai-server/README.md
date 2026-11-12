# Samsung M51 local AI server

Windows PC -> SSH tunnel -> Termux llama.cpp CPU -> Qwen3-1.7B Q4_K_M.

M51: `<M51_LAN_IP>`, Termux user `<TERMUX_USER>`, SSH port `8022`.
No root, Debian environment, paid AI API, Internet port forwarding or real Zalo data is used.

SSH setup is done by `scripts/connect-m51.ps1` on Windows. It verifies key login before
creating alias `m51-ai`. Password login is preserved.

On M51 (run remotely from PC):

```bash
bash ~/m51-ai-server/scripts/install-ai.sh
bash ~/m51-ai-server/scripts/start-ai.sh
bash ~/m51-ai-server/scripts/status-ai.sh
bash ~/m51-ai-server/scripts/healthcheck.sh
bash ~/m51-ai-server/scripts/stop-ai.sh
```

AI host is restricted to `127.0.0.1:8080`. Context 2048, threads 4, GPU layers 0,
one request slot, batch/ubatch 128, polling disabled while idle. Configuration is in
`config/server.env`; after edits run `stop`, `python scripts/manage-ai.py setup`, then `start`.

On Windows:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18080:127.0.0.1:8080 m51-ai
```

API: `http://127.0.0.1:18080/v1/chat/completions`; health: `/health`.

The API requires a Bearer credential, stored privately in `secrets/ai-api.key` on
the phone and PC. Never paste its value into chat, a command argument or a log.
The provided PC client reads the file automatically:

```powershell
python -X utf8 .\scripts\query-ai.py "Thủ đô Việt Nam là thành phố nào?"
```

For private access outside the LAN, the phone uses official checksum-verified
Tailscale ARM64 binaries in userspace mode, supervised by runit. This does not need
Magisk, an Android VPN prompt or the Android Tailscale application. Windows uses
the official Tailscale installer. After both devices are authenticated in the same
tailnet, `scripts/finish-tailnet-pc.py` verifies private SSH, creates alias
`m51-ai-remote` and a separate loopback API tunnel at `127.0.0.1:18081`.
Authentication and a real off-LAN test must be completed before remote access is
accepted as PASS. See `docs/remote-access.md`.

Build source: https://github.com/ggml-org/llama.cpp (actual commit recorded in docs).
Android build guidance: https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md
Model: https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/blob/main/Qwen3-1.7B-Q4_K_M.gguf
Exactly one model is downloaded, with fixed expected SHA256 and API-reported exact byte count.

Runit restarts the server after crashes. Its server/watchdog logs rotate at 2 MiB,
retaining five rotated files per service in `logs/`. The watchdog checks every 30 seconds;
after five minutes startup grace, three failed checks trigger a restart.
Termux start and Termux:Boot hooks are installed. Android battery exemptions and
real reboot behavior require explicit verification. Android thermal protection is preserved.

Tests in `tests/` use synthetic Vietnamese text only. JSON results are in `docs/`.
Initial soak is at least 30 minutes. A later 24-72 hour test should repeat moderate
synthetic requests every 2-5 minutes, include screen-off/charging/Wi-Fi changes,
and record failures, RAM, readable thermal data and Android app survival.
No unverified hardware or model capability is counted as PASS.

If package recovery is needed later, the already-transferred bootstrap is a single
command: `bash ~/m51-ai-server/bootstrap/bootstrap-m51-termux.sh`.
It uses signed apt repositories and preserves Termux data and existing login methods.
