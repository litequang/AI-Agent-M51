# M51 Zalo Gateway — Phase 01 MOCK

Standalone Node 24 + SQLite + mobile web console. **No real Zalo login/send, no
history backfill, no AI calls, no automatic replies.** QR challenges are simulated,
non-scannable state-machine fixtures. Three synthetic accounts maximum.

On a development machine with Node >=24.13 <25:

    npm ci --ignore-scripts
    npm run typecheck
    npm test
    npm run resource-check
    node dist/src/main.js --init-token
    npm start

Windows PowerShell uses npm.cmd. Open http://127.0.0.1:8790 and supply the separate
operator token from ignored var/operator.key through a private local viewer.
Never paste credentials into a chat, issue, shell argument or Git. The UI keeps
its token in page memory only. API tokens and Zalo sessions are different concepts;
no real Zalo sessions are stored.

Create mock-a/mock-b/mock-c, click Simulate QR then Confirm simulated QR, and emit
standard/burst/duplicate fixtures. Filter the unified inbox, simulate network loss
and reconnect, inspect unknown gaps. Select a thread, create a draft, then review
its account/thread/text and separately tick and confirm the mock send.

The console displays the latest 200 captured messages per thread. It polls every
five seconds; stored event capture is independent. Notification-muted groups are
fixture metadata, not verified Zalo coverage. Retention caps deliberately reject
new work rather than silently delete acknowledged data.

Phone packaging: copy dist/, web/, scripts/*-termux.sh, third-party/, this README,
THIRD_PARTY_NOTICES.md and package.json into a separate approved phone directory.
Runtime requires Node only, no npm install or PC backend. After owner approval,
bash scripts/start-termux.sh runs in the foreground, health-termux.sh checks the
authenticated local endpoint, stop-termux.sh signals only its verified owner.
No script installs/enables runit, Boot hooks, Tailscale Serve or public ports.

For Phase 01 only isolated temporary tests were authorized on the phone; an
operator-facing persistent mock service still needs approval. See
../docs/zalo-gateway/implementation-handoff.md for results and gates.
