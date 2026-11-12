# Private API access from outside the LAN

## Private chat UI

The PC now runs a background Tailscale Serve TCP forwarder on port 8787 to its existing LAN chat listener. An authorized client signs into the same tailnet, enables Tailscale, and opens the PC's Tailscale IPv4 on HTTP port 8787. The operator's local access map contains the live URL. This does not enable public Funnel or Internet router forwarding.

The PC, chat process, SSH API tunnel and M51 must stay online. The current UI is hosted by the PC; the model runs on M51. The remote browser receives no model API key. Traffic travels inside Tailscale's encrypted network.

Run scripts/enable-remote-chat.ps1 on the PC to restore this mapping after a LAN address/configuration change. Disable this mapping only with tailscale serve --tcp=8787 off; do not reset unrelated mappings.

An actual M51-to-PC tailnet probe fetched the page and model catalog, then streamed a Qwen3.5 answer successfully. Evidence: remote-chat-results.json. Both peers currently share a LAN; a real 4G/5G path remains SKIP.

## Direct model API

The local path has passed an actual Windows HTTP health request:
Windows `127.0.0.1:18080` -> SSH `m51-ai` -> M51 `127.0.0.1:8080`.
Direct connections to `<M51_LAN_IP>:8080` were refused. API calls without a Bearer
credential were rejected with HTTP 401. The key is stored in `secrets/ai-api.key`.

Windows Tailscale -> private phone Tailscale IPv4 -> Termux sshd port 8022 ->
SSH tunnel -> llama.cpp on phone loopback is the prepared outside-network path.

The phone has verified official static ARM64 Tailscale 1.104.6 binaries and a running
userspace daemon under runit. No root or Android VPN permission is required for
this method. Logs redact authentication URLs and key-shaped values; daemon state
and temporary login URL are kept under the private `secrets/` directory.
DNS replacement, subnet routes, exit-node routing and public Funnel are not enabled.

Windows Tailscale installation requires its normal Windows UAC confirmation.
Both devices must be authenticated to the same intended tailnet in the PC browser.
Open the phone authentication page on the PC:

```powershell
python .\scripts\open-tailscale-login.py phone
```

After the Windows installer finishes:

```powershell
python .\scripts\open-tailscale-login.py pc
```

After both browser authentications, while existing LAN SSH still works:

```powershell
python -X utf8 .\scripts\finish-tailnet-pc.py
python -X utf8 .\scripts\query-ai.py --base http://127.0.0.1:18081 "Tính 3+4."
```

The finish script creates private Tailscale TCP forwarding for SSH, verifies the
same host key and Ed25519 identity over the Tailscale address, creates alias
`m51-ai-remote`, starts a separate local tunnel on port 18081, and makes an actual
synthetic API generation request. Its result goes to `docs/tailnet-results.json`.
The original local alias/tunnel remain available.

For subsequent sessions:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18081:127.0.0.1:8080 m51-ai-remote
```

Real 4G/5G acceptance requires an authenticated client actually outside the phone's
LAN. Successful Tailscale access while both devices share Wi-Fi does not establish
that a cellular path was tested. Tailnet policy should permit intended clients to
reach only the required phone SSH port. The AI endpoint additionally requires its
separate API credential.

Official references:

- https://tailscale.com/docs/concepts/userspace-networking
- https://tailscale.com/docs/reference/tailscale-cli/serve
- https://pkgs.tailscale.com/stable/
