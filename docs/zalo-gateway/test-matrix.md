# Phase 01 measured verification

Run date: 2026-11-12. All accounts, messages and test tokens are synthetic.
No real Zalo access or Qwen inference was used.

| Check | Windows Node24.19 x64 | M51 Node24.22.2 Android ARM64 | Evidence / limits |
|---|---|---|---|
| Strict TS build + synthetic unit/integration/HTTP E2E | PASS20/20,46.967s | PASS20/20,11.292s | npm test; phone executes PC-built portable JS |
| Account isolation / shared source IDs / duplicate no-op | PASS | PASS | storage.test.ts |
| New-only cutoff / unknown gaps / reconnect | PASS | PASS | storage.test.ts |
| QR expiry / one listener / bounded pending callbacks | PASS | PASS | mock.test.ts |
| Durable pre-receipt journal / backpressure | PASS | PASS | storage.test.ts |
| SIGKILL recovery / pending sends become uncertain | PASS | PASS | recovery.test.ts; isolated child only |
| Recall tombstone / stale edits / bound connector account | PASS | PASS | recovery.test.ts |
| Immutable draft / selected scope / confirmation / no retry | PASS | PASS | outbox.test.ts |
| Bearer / Host / Origin / body bounds / blocked secret route | PASS | PASS | http.test.ts |
| Latest200 messages / AI queue16 / text bounds | PASS | PASS | budgets.test.ts |
| Slow injected AI provider independent of ingest | PASS | PASS | storage.test.ts; no model called |
| DB ownership / early worker exit / clone failure | PASS | PASS | recovery.test.ts |
| CLI init idempotence / private health / own-process stop | PASS | PASS | verify-cli.js; M51 verified stop helper, PC own child |
| Termux shell syntax | n/a | PASS | bash -n on all three helpers |
| 600-event three-account resource sample | PASS | PASS | resource-results.json |
| Existing AI/chat/models/Tailscale preservation | client | PASS | same four service PIDs and Serve config before/after |
| Own exact dev lock npm advisory query | PASS,zero findings | no npm runtime graph | npm audit --json,3 dev entries |
| Browser visual/mobile interaction | SKIP | SKIP | @oai/sky native pipe unavailable: Windows error2 |
| Real login/send/DM/group/muted/self coverage | SKIP | SKIP | LIVE_PILOT permission NO-GO; no connector installed |
| Physical power-loss/disk-full injection | SKIP | SKIP | SIGKILL/queue pressure do not establish these |
| Cellular/reboot/screen-off/charger/thermal/endurance | SKIP | SKIP | not performed |

No implemented runtime check above failed. Whole-upstream reuse and personal-session
permission remain FAIL/NO-GO audit decisions, not runtime PASS claims.

## Resource sample

M51:600/600 events across3 accounts in1959.26ms;306 events/s, ingest p95=5.11ms,
event-loop p99=12.96ms, RSS74.34MiB, CPU1840.99ms, one-second idle1.94% of one
core, DB+WAL+owner metadata1,506,564 bytes. Budgets: RSS<192MiB,p99<250ms,
ingest p95<500ms. This sequential synthetic sample is not a real Zalo throughput,
concurrent burst, power or endurance guarantee. Windows measurements are separate.

Before/after checks invoked no inference: four existing runit services remained up
with identical PIDs, both model IDs remained in AI/chat catalogs, router health ok,
Tailscale Running and identical Serve config. No persistent gateway was enabled.

## Commands

From zalo-gateway on Windows:

    npm.cmd ci --ignore-scripts
    npm.cmd run typecheck
    npm.cmd test
    npm.cmd run resource-check
    node dist/scripts/verify-cli.js
    npm.cmd audit --json
    node --check web/app.js

From an authorized isolated compiled copy on M51:

    python scripts/check-existing-services.py before
    node --test --test-concurrency=1 dist/tests/*.test.js
    node dist/scripts/resource-check.js
    node dist/scripts/verify-cli.js
    bash -n scripts/start-termux.sh scripts/stop-termux.sh scripts/health-termux.sh
    python scripts/check-existing-services.py after

Preservation snapshots retain raw PIDs/config hashes only in ignored private phone
artifacts. Public output contains sanitized booleans. Tests clean their own temporary
DBs and processes, use ephemeral loopback ports and never enable service/Serve rules.
