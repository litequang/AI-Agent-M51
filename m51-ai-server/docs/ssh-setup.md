# SSH connection status: PASS

Target: `<TERMUX_USER>@<M51_LAN_IP>:8022`.

Windows OpenSSH client is available. The target returned an OpenSSH 10.6 banner.
The old Windows known_hosts entry differs. The user confirmed Termux was reinstalled.
The PC connection helper uses a separate known_hosts_m51 file and preserves old entries.
Host-key identity has not been independently checked on the phone.

The one-time password authentication was completed in a visible Windows console.
Key-only login and `ssh m51-ai 'uname -a && whoami'` both passed.
The actual remote result was Android aarch64, user `<TERMUX_USER>`.

For rebuilding this PC setup, run `scripts/connect-m51.ps1` in a visible Windows PowerShell console for one password authentication.
The password goes directly into OpenSSH, never into a file or chat.
The helper generates a dedicated Ed25519 key, appends only its public key to Termux,
verifies key-only authentication, and creates the `m51-ai` alias after verification.
Password authentication on the phone remains unchanged.

Connection results are saved in `connection-state.json`; it contains no password or private key.
AI installation and benchmark status is recorded separately in `deployment-report.md`.
