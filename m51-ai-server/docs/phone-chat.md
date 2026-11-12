# Chat hosted entirely on M51

The primary chat now runs on M51 itself. The phone's runit service m51-chat serves the HTML/CSS/JS and Python proxy at 127.0.0.1:8787, calling the authenticated AI router at 127.0.0.1:8080 directly.

Phone Tailscale Serve privately maps TCP8787 to that chat listener. Existing SSH8022 mapping is preserved. Authorized tailnet clients open the phone's Tailscale IP on port 8787; live addresses remain in the operator's private access map.

No PC web backend or PC SSH API tunnel is required. The former PC chat, PC API tunnel listeners and PC Serve8787 mapping have been stopped. The PC remained on as the test client; a literal PC shutdown was not performed.

## Actual verification

- Both model choices and two switches through the phone's own web endpoint: PASS.
- Static assets, real streamed greeting, key absent from browser assets, secret route blocked, cross-origin POST blocked: PASS.
- PC backend/API-tunnel listener count during these tests: zero.
- Chat SIGKILL recovery by runit: PASS, 1.11 seconds.
- Five healthy samples over 60.25 seconds after recovery; chat RSS about 25.5 MiB.
- Logs/key security scan after migration: PASS.

Evidence: phone-model-selection-results.json, phone-chat-ui-results.json, phone-pc-independence-results.json, phone-chat-service-results.json. Browser visual QA, actual 4G/5G, real reboot and long endurance remain unverified.

## Operations on the phone via SSH

    python ~/m51-ai-server/scripts/manage-chat.py setup
    python ~/m51-ai-server/scripts/manage-chat.py start
    python ~/m51-ai-server/scripts/manage-chat.py publish
    python ~/m51-ai-server/scripts/manage-chat.py status

The install script sets up the service; start-ai.sh starts AI plus chat. Existing runit supervision and the additional Termux:Boot hook start chat on subsequent Termux service startup. Reboot survival remains SKIP until actually tested.

## Domain discussion

The user controls DNS through Cloudflare and has asked about a custom domain. No Cloudflare tunnel, Access application or DNS route has been created yet. Cloudflare Tunnel plus Access can serve web/API and provide SSH access without requiring Tailscale. Tailscale can alternatively provide private access with custom DNS; the clients would still need tailnet access and custom-domain HTTPS would need appropriate TLS configuration.

Before publishing through an HTTPS reverse proxy, configure and validate the exact permitted public Origin in the chat proxy. The current Origin check deliberately expects its direct HTTP endpoint; do not simply trust arbitrary forwarded headers or disable that check.
