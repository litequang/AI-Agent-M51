# Phase 01 threat model and approval gates

Assets: operator token, account/thread boundaries, accepted event journal,
outbox intent and the availability/configuration of existing AI/Tailscale services.
Repository is public. Fixtures are synthetic, not anonymized personal messages.

## Boundaries and mitigations

| Threat | Implemented mitigation | Residual / gate |
|---|---|---|
| Unauthenticated LAN/public calls | Explicit loopback bind, loopback peer check, 32–256 character Bearer tokens, constant-time equality primitive | No public or tailnet publication in this phase |
| Browser cross-origin/rebinding | Exact Host/Origin checks, no CORS, CSP self, frame/base/form restrictions | Reverse proxy HTTPS must explicitly validate its exact host/origin; do not trust arbitrary forwarded headers |
| Token/content exfiltration | Token page memory only; fixed static file allowlist; no filesystem/media/upload routes, external SDK or telemetry; DOM textContent | Same OS user/browser extensions can read memory; token is not Zalo authorization |
| Account crossover | Scoped API principals, composite DB keys, account-bound callbacks, quote scope, per-account connector | Mock slugs do not prove separate actual Zalo identities |
| Duplicate/lost/reordered events | FULL WAL commit before receipt, scoped unique identity, worker ownership, version ordering, terminal recall, replay tests | No upstream durable ACK guarantee, clock skew policy and physical power loss unverified |
| LLM stall/prompt injection | No inference in ingest; disabled AI executor; injected provider receives scoped bounded snapshots, no send tools | Future AI timeout/cancellation, untrusted-content handling and authorization review required |
| Unintended send | Immutable draft, explicit account/thread confirmation, transactional one-time claim, uncertainty state; mock-only mode | Fresh operator/payload-bound expiring nonce required before live send; no live permission claimed |
| Queue/memory/disk exhaustion | Body/event/IPC/pending/total record caps; bounded snapshots; soft64MiB DB admission threshold | Not an OS quota; accepted projection may grow DB beyond threshold. Real disk-full/retention/export policy not validated |
| Unknown dependency/admin execution | Zero runtime npm deps; exact dev lock, ignore-scripts; narrow MIT extractions; no shell/MCP/updater/SDK | Native Node/SQLite security updates still need future audit; upstream vulnerable graphs explicitly rejected |
| DB path/duplicate listener | Private modes, symlink checks, exclusive owner marker, early worker failure/operation deadlines | Parent directory must be private/trusted; same-user races/compromise cannot be sandboxed by a PID file |
| Device availability regression | Separate files, runtime and ports, no service/Boot/Tailscale modification; pre/post live health comparison | No Android reboot, charger, screen-off or long endurance evidence added |

## Data and diagnostics

No real credentials or messages are accepted by mock onboarding fields. Errors expose
bounded codes and sanitized messages; no raw request headers, SQL payloads or upstream
session logs. Synthetic test tokens are clearly named fake constants, never production
keys. Real tokens/DB/WAL/logs/var/dist are excluded from Git. Future real sessions need
a reviewed encrypted per-account store with key separation and atomic private writes.
Metadata-only mock storage is not a tested real credential vault.

## Gates

1. **Mock service activation:** owner approves starting isolated phone loopback8790
   and any separately specified private access mapping. Scripts alone do not enable it.
2. **Real read-only pilot:** both platform-permitted access method and explicit owner
   consent to one secondary account/consented peers; reviewed dependency pin, session
   handling, new-only clock policy, overflow/retention and authoritative coverage test.
3. **Real manual send:** separate approval after gate2 plus payload-bound expiring
   confirmation nonce, operator identity, reconciliation and at-most-once intent tests.
4. Multi-account live scale, AI job execution and external hosting remain later gates.

Current LIVE_PILOT=SKIP / permission NO-GO. QR UX is not permission. See platform-risk.md
for dated primary sources and official OA/Bot alternatives. No restriction evasion,
cookie capture, account password request, bulk sending or auto-reply is implemented.
