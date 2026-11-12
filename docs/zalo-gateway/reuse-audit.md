# Phase 01 pinned-source reuse audit


## Integrated resolution after the sidecar

The sidecar above remains a snapshot, not a claim about the final files. Subsequent
integration fixed SIDE-01 (version ordering and terminal recall), SIDE-02 (trusted
connector account binding), SIDE-04 (aggregate event/outbox/job/thread/gap caps,
16KiB snapshots and soft64MiB admission threshold), SIDE-05 (readiness rejection,
deadlines and clone cleanup). Regression tests PASS on PC and M51; see test-matrix.md.
The storage threshold is not a hard disk quota; actual disk-full injection is SKIP.
SIDE-03 stays a live-send gate: mock HTTP authenticates/scopes operators and claims
immutable drafts transactionally, but an expiring payload/operator-bound one-use
confirmation nonce is still required before real sending. Real mode remains absent.
Own exact dev lock npm audit returned zero findings. Actual Android SQLite tests,
CLI smoke and resource evidence are in resource-results.json. These later results
do not change the upstream vulnerability or platform-permission NO-GO findings.


Audit date: 2026-11-12. Branch: `feature/zalo-gateway-p1-mock-20261112`.
**MOCK implementation may proceed. LIVE_PILOT = NO-GO; live execution = SKIP.**
Platform permission and a later explicit owner approval are both required; see [platform-risk.md](platform-risk.md).

This is a source/dependency audit with the focused implementation sidecar below, not a certification of the concurrent gateway implementation. No upstream lifecycle scripts, dependency installation, QR login, real messages, phone changes, service enablement or network publication were performed. Only public dependency names/versions were submitted to npm's advisory endpoint. This audit copies no code; the coding implementation now contains the narrow inherited helpers identified below.

## Revisions and licenses

All three local HEADs matched these pins; `git status --porcelain` was empty. Sources remained read-only. References below are relative to the named repository at its SHA in this table, never floating HEAD. Machine inventories, lockfile SHA-256 hashes, manifest scripts and advisory responses are in [source-audit.json](source-audit.json).

| Source | Exact SHA | Root license evidence | Decision |
|---|---|---|---|
| [vuhai2002/zalo-agent](https://github.com/vuhai2002/zalo-agent/tree/4346f295e9dbd787a427993ddf3b083ebb57cf15) | `4346f295e9dbd787a427993ddf3b083ebb57cf15` | `LICENSE:1-21`, MIT, copyright 2026 Vu Van Hai | Adapt composite-schema/WAL pattern; reject whole application |
| [RFS-ADRENO/zca-js](https://github.com/RFS-ADRENO/zca-js/tree/2a7e360257dfe98e2eb48dc46bbf389834be7e0b) | `2a7e360257dfe98e2eb48dc46bbf389834be7e0b` | `LICENSE:1-21`, MIT, copyright 2024–2025 RFS-ADRENO, truong9c2208, JustKemForFun | Conditional future narrow protocol adapter; no Phase 01 runtime dependency |
| [minhkhoa0502/zalo-personal-mcp](https://github.com/minhkhoa0502/zalo-personal-mcp/tree/e91ecfe0c17d29bb50fa2adc22759407604c9b92) | `e91ecfe0c17d29bb50fa2adc22759407604c9b92` | `LICENSE:1-21`, MIT, copyright 2026 Khoa Tran | Extract two pure helpers; reject MCP tools and collector runtime |

MIT permits code extraction with the copyright and permission notice retained. Each actual extracted file must identify upstream SHA/path and modifications, and carry the applicable full MIT notice in its distribution. Root MIT does not license Zalo's service or establish all transitive licenses. npm lock metadata for zca-js lacks 66 license fields; that means unknown metadata, not necessarily unlicensed software. Its declared values include MIT, ISC, BSD, Apache-2.0 and Python-2.0. MCP lock entries declare permissive licenses including `(MIT AND Zlib)` and `(WTFPL OR MIT)`. Transitive package tarball notices were not downloaded/verified; pnpm's lock does not supply a full license inventory. Do not redistribute whole graphs on this audit alone.

## Dependencies, locks and pins

Counts exclude each root package. npm production/development counts use the lock's `dev` flag; they are resolved paths, not unique package names or proven reachable modules. pnpm counts resolution keys and includes optional platform variants. Bun counts package records; the formats are not interchangeable.

| Source | Direct runtime / dev | Exact manifest runtime pins | Lock inventory |
|---|---:|---|---|
| zalo-agent 0.4.0 | 18 / 14 | Only `zca-js=2.2.0`; other 17 are caret ranges | `pnpm-lock.yaml:1-3663`, format 9.0; 395 name/version resolution entries, 264 snapshots; manager pinned to pnpm 11.28.7 with SHA-512 (`package.json:59`) |
| zca-js 2.2.0 | 8 / 19 | None; all 8 are caret ranges | `package-lock.json:1-3518`, v3: 265 paths = 30 production + 235 dev, 251 unique name/version pairs. Also `bun.lock:1-546`: 253 records, 241 unique name/version pairs |
| zalo-personal-mcp 0.0.1 | 5 / 2 | All five: SDK 1.29.0, https-proxy-agent 9.1.0, undici 8.6.0, zca-js 2.1.2, zod 3.25.76 | `package-lock.json:1-1490`, v3: 119 paths = 116 production + 3 dev, 118 unique name/version pairs |

Manifest evidence: zalo-agent `package.json:60-95`; zca-js `package.json:42-73`; MCP `package.json:32-42`. Complete direct inventories and resolved transitive lists with line references are in JSON. MCP's registry dependency **2.1.2 is not the audited zca-js source 2.2.0**; the standalone checkout audit cannot establish the code of that older tarball.

Lock drift matters: zca-js's npm lock resolves `form-data=4.0.6`, `ws=8.21.0`; Bun resolves `form-data=4.0.4`, `ws=8.18.0` (`bun.lock:270` and `:480`, respectively; JSON retains exact record locations). zalo-agent's separate pnpm graph resolves `ws=8.22.0` (`pnpm-lock.yaml:1880`). A source SHA plus a manifest range is insufficient to reproduce a deployed registry graph. Choose one lock/manager and pin any future adapter to verified package integrity and source provenance after permission review.

No root install hooks in zalo-agent or MCP manifests. zca-js has `prepare: husky`, Bun-based `prebuild`, and build commands (`package.json:14-24`). npm lock marks optional dev `fsevents` as having an install script. The agent build graph contains esbuild, Tailwind oxide, lightningcss and rolldown platform binaries. None was executed; no hooks were assumed safe from manifest names alone.

### Advisory results

Queried `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` using public locked versions, including dev and optional records, with Python stdlib HTTPS. The initial sandbox socket denial was resolved with a scoped network execution; all four graph queries succeeded; a canonical-name supplement checked npm alias packages. Exact query times, submitted counts and full advisory ranges/URLs are retained in JSON. This is a version-match inventory, not `npm audit` metavulnerability analysis or proof of exploitability; multiple records can represent ranges for the same GHSA.

| Graph | Flagged package names / advisory records | Focused assessment |
|---|---:|---|
| zalo-agent pnpm | 1 / 1 | `uuid 8.3.2`, moderate [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Production dependency through `exceljs` (`pnpm-lock.yaml:2641-2651`, resolution `:1808`); affected buffer-taking UUID operations not traced to a reachable app call |
| zca-js npm | 7 / 22 | All flagged paths have `dev=true`: brace-expansion 1.1.12/2.0.2, minimatch 9.0.9, @humanfs/node 0.16.6, ajv 6.12.6, glob 10.5.0, js-yaml 4.2.0, yaml 2.8.1. High DoS findings in brace-expansion/js-yaml; production query matches absent, not proof of security |
| zca-js Bun | 12 / 40 | Includes runtime `ws 8.18.0`: [memory disclosure](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) and [fragment DoS](https://github.com/advisories/GHSA-96hv-2xvq-fx4p); runtime `form-data 4.0.4`: [multipart CRLF injection](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx). Also build/dev glob, rollup, flatted, picomatch and other tooling; do not choose this lock |
| MCP npm | 10 / 66 | All flagged packages are production graph entries: SDK 1.29.0, undici 8.6.0, zod 3.25.76, @hono/node-server 1.19.14, hono 4.12.27, body-parser 2.3.0, fast-uri 3.1.3, ip-address 10.2.0, proxy-addr 2.0.7, qs 6.15.3 |

MCP includes [high SDK OAuth credential exposure](https://github.com/advisories/GHSA-6qxp-vccf-f47h), [high HTTP body/batch limits](https://github.com/advisories/GHSA-f897-62hf-6gxq), and [critical proxy-addr trust bypass](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). Its entry point uses **stdio server** transport (`src/index.ts:8-25`), not the affected HTTP/OAuth server paths; do not report those as remotely exploitable in this entry point. `undici` is actively used for proxy egress (`src/net.ts:11-18`), but individual cache/retry/parser findings still need feature-level reachability review. Exact pins freeze vulnerable versions as well as reproducibility. Do not install this graph as a redaction helper dependency.

## Security and component decisions

| Component / evidence at pinned source | Observed behavior | Phase 01 choice |
|---|---|---|
| Agent account manager `src/zalo/account-manager.ts:42-43,98-137`; DB `src/conversation/database.ts:39-70` | API/listener per logical account; thread/contact composite account keys. Message table lacks source-event unique identity. Logical account names alone do not prove distinct upstream identities | **REFERENCE/ADAPT** account lifecycle; new account-scoped schema and identity checks. Do not inherit AI-oriented messages table |
| Agent credentials `src/zalo/zalo-credential-store.ts:15-49`; route `src/server/routes/account-routes.ts:26-29` | AES-GCM files per account, shared encryption key; path helper trusts accountId, route restricts slug. Mode 0600 on new files, parent mode/atomic replacement not enforced there | **REFERENCE** encryption; central bounded opaque account IDs, canonical private paths, per-account context/key policy, atomic credential writes outside public repo. DB stores metadata only |
| Agent capture `src/zalo/incoming-message-router.ts:45-48,89-96`; listener `src/zalo/zalo-listener.ts:72-75` | Delivered receipt precedes message storage. Storage exceptions are logged and processing continues; listener does not await downstream completion | **REJECT** ingest path. Require commit result before local acceptance/receipt; storage failure must fail closed with a gap/health event |
| Agent DB `src/conversation/database.ts:5-35,39-49`; `src/mcp/mcp-schema.ts:5-16` | Global synchronous main-thread database, WAL + NORMAL; foreign keys not enabled; migrations import AI/MCP/knowledge schemas | **ADAPT** tiny WAL bootstrap idea only; dedicated worker, FULL journal commits, explicit FK enforcement, bounded busy timeout and migrations. No global singleton imports |
| Agent self events `src/zalo/zalo-client.ts:8-14`; zca `src/apis/listen.ts:264-287` | `selfListen=false` removes self messages before application sees them | **REJECT** default for inbox; future permitted listener must capture self events with direction and suppress all reply loops |
| Agent reply path `src/zalo/message-turn-processor.ts:178-219`; actions `src/agent/tools/tool-catalog-action.ts:3-19`; router `:122-129` | Agent turn can deliver replies automatically, invoke file/reaction/schedule tools, and send busy notices | **REJECT** orchestration, scheduler, action catalog and background writes. No LLM in ingest or send authorization |
| Agent remote MCP `src/mcp/mcp-client-connect.ts:26-43`; guards `src/server/routes/mcp-route-guards.ts:13-25` | Admin-supplied HTTP MCP URL/headers, URL syntax/length check; not a host/private-address policy | **REJECT** remote MCP administration. Arbitrary remote tool execution/egress and SSRF risk if such privileged configuration is exposed. No stdio MCP spawning found in this path |
| Agent process execution `src/video/chay-yt-dlp.ts:28,186-231` | External downloader via argument-array `execFile`, not shell interpolation | **REJECT** downloader/process tools. No generic shell tool identified in audited production source search; HTTP MCP may expose arbitrary remote capabilities |
| Updates `zca-js/src/context.ts:202-205`, `src/update.ts:5-30`; agent `src/server/update-check.ts:112-128` | Protocol client defaults to npm version check; agent explicitly disables it. Dashboard can query latest GitHub release. Examined checks fetch metadata, not install code | **REJECT** update calls in gateway. No self-update executor identified in those files; avoid claiming all outbound traffic is Zalo-only in whole agent |
| MCP session `src/config.ts:13-59`, `src/session.ts:44-101`; client `src/zalo-client.ts:16-72` | One process-global session/config and cached API; AES-GCM + scrypt or adjacent random key file. Listener instances can be created separately | **REFERENCE** crypto concept; **REJECT** singleton account model. Copying key and ciphertext together defeats separation; encryption does not sandbox same-user access |
| MCP collector `src/daemon.ts:20-37`, `src/message-log.ts:33-49,84-97,100-123` | Captures both live and old_messages; JSONL has no account field/dedup or fsync; catches write errors, rewrites log during trimming, reads whole log | **REJECT** collector/journal. Backlog violates new-only scope; ~5 MiB trigger plus 5000 lines is not a byte bound after oversized messages |
| MCP write tools `src/tools.ts:172-192,346-410,648-794` | Direct sends, transient upload listener, remove-member/friend and mute/archive writes; no account/thread confirmation token or scoped outbox | **REJECT** all tools. `resolveDataPath` (`:40-42`) accepts absolute and traversal paths; send-media can exfiltrate any readable file in the process sandbox |
| MCP egress `src/net.ts:1-18`, `src/zalo-client.ts:19-35`; `docker-compose.yml:3-11,43-44,70-71`, `sandbox/squid.conf:16-27` | Fetch dispatcher and separate WS proxy agent; intended enforcement is Docker internal network + proxy allowlist, not proxy settings alone | **REFERENCE** separate HTTP/WS paths; **REJECT** Docker/Squid deployment for native Termux. Native launch would lose container egress controls. Proxy URL is logged and may contain credentials |
| Error handling agent `src/shared/safe-error-serializer.ts:19-31,41-88`; MCP `src/tools.ts:58-64` | Agent allowlists but retains message, URL, responseHeaders and stack; MCP returns raw error.message | **REJECT** as ready-made secret redaction. Sanitization/truncation is not credential redaction; gateway should emit bounded codes and explicitly sanitized diagnostics |

zca-js event contract (`src/models/Message.ts:18-54,80-125`) carries string IDs, content union, timestamp and direction; DM/group thread derivation differs. Normalize behind an adapter with account ID supplied by the trusted listener binding. Preserve string IDs, explicit event kind/version and receive sequence; never deduplicate globally by message ID. `src/apis/listen.ts:388-402` emits old_messages separately; prohibit historical APIs and backlog subscription. Notification mute is not proven capture coverage.

`src/apis/listen.ts:173-220,264-287,497` uses WS callbacks/events, reconnect and socket sends; it does not expose a consumer durable acknowledgement contract. An async callback is not protocol backpressure. A future adapter must distinguish local commit acknowledgement from upstream delivery/seen receipts. If source flow cannot be paused or replayed, disconnect on capacity exhaustion and record unknown coverage rather than claim lossless ingest. Agent's reconnect warning (`src/zalo/zalo-listener.ts:14-17,53-69`) describes competing web listeners; require one leased listener per actual account, generation fencing and bounded retries ending at needs_relogin.

## Concrete inheritance in the coding snapshot

This is a newly authored isolated gateway with narrow MIT extractions/pattern adaptations, **not a whole-product fork**. The earlier optional DB transaction-helper suggestion is superseded by these actual implementation choices; `src/shared/db-transaction.ts` is not being inherited.

| Inheritance | Exact upstream boundary | Observed local boundary and license distinction |
|---|---|---|
| Extract `safeEqual` | MCP SHA `e91ecfe0c17d29bb50fa2adc22759407604c9b92`, [`src/session.ts:137-142`](https://github.com/minhkhoa0502/zalo-personal-mcp/blob/e91ecfe0c17d29bb50fa2adc22759407604c9b92/src/session.ts#L137) | `zalo-gateway/src/vendor/session-compare.ts:1-10`; uses only `node:crypto`. No session encryption/config/singleton code inherited. This is a string equality primitive, not secret redaction, authorization or a fixed-size token validator. Bound inputs and handle absent tokens before comparison; equal empty strings compare true |
| Adapt source envelope/quote shaping | Same MCP SHA, [`src/message-log.ts:21-81`](https://github.com/minhkhoa0502/zalo-personal-mcp/blob/e91ecfe0c17d29bb50fa2adc22759407604c9b92/src/message-log.ts#L21); `shapeMessage` at `:53-81` | `zalo-gateway/src/vendor/message-envelope.ts:1-20`; pure mock DTO mapping and narrowed string quote fields. No log append/trim, backlog, filesystem, global config or SDK dependency. Trust/account binding and validation remain the new gateway's responsibility; `normalizer.ts:1-12` exercises the mapper with fixtures |
| Adapt composite account/thread schema and WAL concept | Agent SHA `4346f295e9dbd787a427993ddf3b083ebb57cf15`, `src/conversation/database.ts:12-33,39-70` | `zalo-gateway/src/store-worker.ts:14-48`: newly authored schema/worker. Intentionally FULL + foreign_keys + busy timeout, replacing upstream NORMAL/main-thread singleton. Retain provenance/notice for the adapted schema pattern; no upstream AI, scheduler or migrations imported |
| Protocol reference only | zca-js SHA `2a7e360257dfe98e2eb48dc46bbf389834be7e0b`, `src/models/Enum.ts` and `src/models/Message.ts:18-125` | Synthetic DTO/ThreadType semantics only; no SDK import or installation. Conservatively retaining the upstream MIT notice is appropriate; notice presence does not imply runtime inheritance or platform authorization |

Observed `zalo-gateway/third-party/{zalo-personal-mcp,zalo-agent,zca-js}.LICENSE` contain the complete MIT text, matching each pinned upstream LICENSE after newline normalization. Both extracted helper headers identify source path/SHA; the equality helper links its notice. Keep all applicable notices in packaged distributions, including the envelope adaptation. No safe credential redactor is claimed or inherited.

The actual manifest (`zalo-gateway/package.json:7-20`) declares Node `>=24.13.0 <25`, **zero runtime npm dependencies**, and exact dev pins `@types/node=24.19.2`, `typescript=6.0.3`. TypeScript 6 is the portable JS compiler choice; no TS7 native compiler is required. The v3 local lock (`package-lock.json:20-49`) contains three dev entries, including transitive `undici-types=7.24.6`; it does not install runtime undici or zca-js. The upstream advisory failures above do not transfer to dependency-free extracted functions. Local dev-package advisories were not separately queried in this sidecar.

Hermes/zaloclaw were not inspected: the three pinned candidates already establish the narrow reuse decision; no license/security claims are made about those comparison projects.

## Android/Termux fit and required design

Declared Node minima: agent >=22.13, zca-js >=18, MCP >=22. MCP's locked undici actually requires >=22.19.0 (`package-lock.json:1376-1383`). Node 24 satisfies those version ranges, but this does **not** prove Android support. No Android Node execution/build/resource test was performed. Bundled SQLite must be checked on the actual Termux Node 24 binary before reporting support. Native Linux/glibc or Alpine/musl images are not Android/Bionic deployment evidence; no Docker/root installation is proposed. Build TypeScript/UI on the PC and deploy only the isolated compiled mock gateway; avoid upstream Vite/Tailwind/media/provider graphs on the phone.

Keep `node:sqlite` in a worker, with bounded item/byte IPC capacity and a durable ingest journal committed before local acknowledgement. Use WAL + FULL for acknowledged journal commits: SQLite documents that NORMAL can lose recent commits on power loss ([WAL durability](https://sqlite.org/wal.html#performance_considerations)). Assert effective pragmas, set bounded busy timeout, enable foreign keys, transactionally couple dedup/event/materialization state, and bound WAL growth, retention and disk-full behavior. Commit completion is not a proof of faulty-storage power-loss behavior. Measure phone write latency before making performance claims.

New implementation must enforce account/thread keys throughout API, sessions, inbox, ingest identity and outbox. Confirmation must bind authenticated operator, immutable payload hash, account, thread/type, expiry and one-use nonce; changing destination/body invalidates it. Only mock connector may dispatch in Phase 01. Persist pending/ack/failed/uncertain outcomes; never automatically resend an uncertain send. Capture self messages without routing them into replies. No model inference, external enrichment or attachment fetch on ingest path. Keep real Zalo imports/installations absent, start no persistent service and add no tailnet port. Existing AI/chat services remain outside this module.

## Verification status

| Status | Evidence / meaning |
|---|---|
| PASS | Pinned HEAD and clean-tree checks for all three sources; manifest/lock inventories and SHA-256 hashes; four successful graph queries plus canonical npm alias advisory checks; static path/line review |
| FAIL | Whole-app reuse against Phase 01 safety contract: automatic writes, receipt ordering, non-durable collector/account singleton, missing new-only/self defaults; vulnerable versions in all four queried lock graphs |
| SKIP | Upstream builds/tests/install hooks; package tarball/transitive notice verification; adapter runtime/exploitability tests; real login/send/history; Android gateway tests, phone resource budget/soak, cellular, reboot, battery exemption and endurance |

Reproduction: `git -c safe.directory=<checkout> -C <checkout> rev-parse HEAD` and `status --porcelain`; Python stdlib JSON parsing/hashlib and anchored pnpm/Bun resolution-record scans; urllib HTTPS POST of `{package:[lockedVersions]}` to the recorded npm endpoint. Inventory counts, exact inputs (lock records), responses and timestamps are preserved in JSON. Advisory success is a completed query, not a security PASS. No phone capability or gateway test PASS is inferred from this static audit.

## Focused implementation sidecar ? concurrent coding snapshot

Read-only static inspection of `contracts.ts`, `store-worker.ts`, `store.ts`, `validation.ts`, `gateway.ts`, plus the two vendor files, normalizer, manifest/lock and MIT notices needed to verify inheritance. Snapshot hashes/time are in JSON. No build, install or runtime tests were run. The imported mock connector/fixtures and HTTP/auth/UI layer were not available in the inspected snapshot; this sidecar does not certify those layers. Findings apply to this snapshot and need focused regression evidence after fixes.

Positive source observations: real mode is rejected (`gateway.ts:18`); contracts advertise mock-only capabilities (`contracts.ts:24-29`); journal receipt follows worker operation/transaction completion (`store-worker.ts:125-137,230-237`); storage runs in a separate worker with FULL/FK pragmas (`:14`). Dedup is scoped to account/thread/event/version, quote lookup is account/thread scoped (`:169-183`), and pending sends recover to uncertain (`:119`). These are static observations, not measured PASS claims.

| Priority / ID | Evidence | Concern and focused resolution |
|---|---|---|
| High / SIDE-01 | `store-worker.ts:140-145` | Projection overwrites by ingest sequence, ignoring source version and terminal recall status. Receive recall v3, then a delayed edit v2: v2 has a larger sequence and replaces the tombstone/content. Define explicit version/kind ordering and recall semantics; retain stale events in the journal without resurrecting content. Test out-of-order message/edit/recall, including equal-version different kinds |
| High / SIDE-02 | `gateway.ts:41-44,84-90`; `validation.ts:20-25,27-42` | Connector callback does not assert `event.accountId === boundConnectorId`. Validation accepts any syntactically valid mock account and storage checks the event-selected account. A mislabeled event can cross accounts at this boundary unless the missing connector enforces equality. Bind/check the trusted account at callback and reject mismatches before journaling; test A emits B's ID while both are connected. This is an observed missing gateway defense, not a demonstrated HTTP exploit |
| High before live / SIDE-03 | `gateway.ts:123-132`; `store-worker.ts:189-202` | Confirmation is a caller-supplied Boolean plus matching account/thread. Immutable draft and transactional claim prevent changed-body/repeated dispatch, but these files carry no authenticated operator, expiring confirmation nonce or payload-bound review challenge. Keep mock-only; make HTTP/controller authenticate and authorize the account, then bind fresh one-use confirmation to draft hash/account/thread/operator/expiry. HTTP implementation was not inspected, so absence there is unverified |
| Medium / SIDE-04 | `store-worker.ts:132-144,169-185,209-224`; `store.ts:26-31` | Pending journal count (512), total ingest count (10000), event content limit and mailbox count are useful caps; they do not bound all database growth. Outbox/transitions, gap rows and completed jobs/snapshots have no total byte/retention quota here. Add per-record and aggregate byte budgets, bounded retention/checkpoints, and disk-full health/gap behavior. Verify overload cannot silently acknowledge loss; do not advertise globally bounded storage yet |
| Medium / SIDE-05 | `store.ts:12-27` | Worker exit before ready calls abort but does not reject the ready promise; callers awaiting readiness can hang indefinitely. Reject readiness on every premature exit, bound startup/operations, and test early worker termination and clone/postMessage failures. Keep postMessage exceptions from leaving orphaned pending entries |

Additional targeted checks: assert effective WAL/FULL/FK on initialization rather than only issuing pragmas; normalize timestamps to canonical UTC before text MAX comparisons (`store-worker.ts:143`, `validation.ts:33-42`). Existing source-time cut-off (`store-worker.ts:131`) needs a documented clock-skew/late-event policy before a real protocol adapter; it must not be mistaken for proof of no missing new messages. Keep AI execution off ingest and add timeout/cancellation when job execution is enabled. No recommendation here authorizes service enablement, runtime changes or a live connector.
