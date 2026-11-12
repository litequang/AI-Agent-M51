# Implementation handoff — Phase 01 complete, mock only

Branch: feature/zalo-gateway-p1-mock-20261112.
Parent: plan/zalo-chat-gateway-20261112 @ a0ee0f34b2700d7a445080ccf46889bbfafcd6c8.
The commit containing this document is the implementation revision; resolve with
git rev-parse HEAD, avoiding a self-referential SHA. No main merge/release.

## Working implementation

zalo-gateway/ is an independent Node24/TypeScript package with zero runtime npm
dependencies:3 synthetic accounts, simulated QR lifecycle, one listener/account,
DM/group/muted/self/outgoing fixtures, FULL-WAL SQLite worker/journal/projections,
mobile unified inbox/filter/provenance, unknown gaps, explicit mock draft/confirm
outbox and a separate bounded AI queue with its executor disabled.

PC20/20 and M51 Android20/20 PASS. Phone resource sample PASS:600 events,
RSS74.34MiB, ingest p95=5.11ms. CLI init/health/verified stop PASS. Existing
AI/chat/Tailscale PIDs and Serve config unchanged; both Qwen models still in catalog.
See test-matrix.md/resource-results.json. Browser visual QA SKIP: native pipe absent.

## Inherited versus new

- Extracted MIT safeEqual and adapted pure envelope/quote shaping from pinned
  zalo-personal-mcp; no SDK, collector, config or MCP runtime.
- Adapted zalo-agent's composite account/thread schema/WAL idea; newly authored
  worker, FULL journal, schema, identity, budgets and recovery.
- zca-js is a pinned DTO/thread semantics reference only; no installed/imported SDK.
- New contracts, mock lifecycle integration, fixtures, normalizer/validation,
  storage/API/auth/outbox/jobs, UI controller, operations/tests and handoff.
- Luna Medium supplied HTML/CSS and initial mock drafts; parent corrected/integrated
  and tested them. Sol Medium audited source/dependencies/platform and architecture.
  No Sol High escalation. No unreviewed generated code is claimed.
- Whole applications, auto replies, admin/MCP/media/shell/update tools, old-message
  collector, vulnerable upstream graphs and real connectors were rejected.
- Full MIT notices accompany the narrow boundaries. See reuse-audit.md and
  source-audit.json for exact source pins, dependencies and advisory reachability.
  Own exact dev lock audit returned0; this is not a blanket security certification.

## Next-agent map

Read AGENTS.md, this handoff, architecture.md, threat-model.md, test-matrix.md,
reuse-audit.md and platform-risk.md. Source: zalo-gateway/src; web/ has no bundler/CDN;
tests/ is synthetic; scripts/ contains portable TS checks and Termux launch helpers.
API routes/account scope: ui-api-contract.md.

Private SSH aliases and credentials stay outside this PUBLIC checkout. A clone
grants no phone access. Compiled phone checks used a separate directory, never
m51-ai-server. No new gateway runit/Boot/Serve service was enabled. Node24.22.2
was installed with apt-get --no-upgrade:4 new packages nodejs-lts/npm/c-ares/libicu,
zero upgrades/removals. Node remains as the gateway runtime prerequisite.

Build on PC with npm ci --ignore-scripts and npm run build. Package dist/,web/,
package.json,scripts/*-termux.sh,third-party/ and notices; no PC backend or npm dev
packages are required at runtime. Keep var/,tokens,SQLite/WAL,artifacts and logs private.

## Gates and unfinished validation

LIVE_PILOT=SKIP / permission NO-GO. Primary terms review found no permission for the
proposed unofficial personal-session client. Owner consent alone does not establish
platform approval. Establish an authorized personal route or accept official OA/Bot
scope; see platform-risk.md.

Next owner decision: approve starting the MOCK gateway separately on phone
loopback8790 and specify any private access mapping. Scripts do not activate it.
Existing AI/chat/Tailscale setup remains intact.

A later read-only secondary-account pilot needs BOTH explicit owner approval and a
permissible connector, protected per-account sessions, dependency re-audit, clock/skew
policy, retention/deletion consent and authoritative coverage tests. Real send is a
further gate requiring operator identity, fresh expiring one-use payload-bound
confirmation and delivery reconciliation. Mock Boolean confirmation is insufficient.

Browser/mobile, cellular, disk-full, physical power-loss, reboot, screen-off, battery,
thermal/endurance remain SKIP. Soft DB admission threshold is not an OS disk quota.
No live completeness, muted-group capture or multi-account capacity is established.

## Rollback

Tests stop/delete only their own synthetic temporary processes/DBs. No service or
Serve change needs reversal. For a later approved foreground run use Ctrl+C or
stop-termux.sh (verified gateway owner only); a future runit deployment must use its
supervisor. Do not remove Node/shared packages or touch AI runtime as routine cleanup.
