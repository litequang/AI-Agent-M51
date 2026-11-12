# Private API access from outside the LAN

## Primary phone-hosted chat

The primary UI and proxy now run on M51 itself at loopback port8787 and call the phone API directly at loopback8080. Phone Tailscale Serve maps private TCP8787 to this listener. Clients open the phone Tailscale IP on HTTP port8787. The PC backend, API tunnels and PC Serve mapping have been stopped; they are not required. See phone-chat.md for actual checks and operations. Cellular and reboot tests remain unverified.

## Historical PC-hosted deployment

The earlier remote-chat-results.json records the former PC-hosted mapping. That was replaced by the phone-hosted service after the user clarified that the PC must be able to turn off. Do not treat the historical PC URL as the primary endpoint.

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
