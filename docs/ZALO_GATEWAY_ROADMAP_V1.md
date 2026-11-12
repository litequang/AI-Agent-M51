# Zalo Chat Gateway — Product Roadmap V1
Date: 2026-11-12 | Status: APPROVED FOR DESIGN + SAFE CODE POC, NOT FOR REAL PERSONAL-ACCOUNT ACTIVATION
Repository: https://github.com/litequang/AI-Agent-M51
Baseline: codex/m51-ai-server-20261112 @ 927bba851c92415166c8da6795977daffc0cc274

## 1. Product contract
Build a **multi-account, two-way, unified Zalo inbox with an AI assistant**, hosted on Samsung Galaxy M51 using Termux, accessible privately by Tailscale; the Windows PC is a development/maintenance machine, not a production dependency.

- The product collects **new** messages starting only when each account's collector becomes active. **No historical backfill, no promise of complete history**.
- Receive individual and group chats, including groups muted at the notification layer *if the authorized web session actually emits those events*. Validate this rather than asserting.
- Display an account filter and unified inbox; manual compose/send/reply/quote, delivery states, account health; AI draft is separate from user-approved send.
- Separate accounts completely (authentication sessions, listener lifecycle, message IDs, permissions, data access, outbox). Every outgoing action identifies exact account + thread + explicit operator intent.
- **Never auto-reply by default.** No bulk sending, scraping strangers, or evasion of platform restrictions.
- Read from Zalo personal accounts only via an explicitly authorized, permitted connector. QR login is a UX, **not** evidence of official authorization or enduring history access.
- Existing Samsung M51 AI services and private network access must stay operational.

## 2. Starting technical truth (checked at baseline)
- M51 Termux hosts the phone chat service itself (runit service, loopback 127.0.0.1:8787) through private phone Tailscale Serve; no always-on PC required.
- llama.cpp router uses 127.0.0.1:8080, CPU 4 threads, context 2048, at most one model loaded. Installed **Qwen3.5 2B Q4_K_M** (default API ID qwen3.5-2b) and **Qwen3 1.7B Q4_K_M** (qwen3-1.7b).
- Qwen3.5 structured extraction took ~154 seconds with bounded thinking. Previous concurrent chat versus long direct inference timed out. Never let a slow LLM block event capture.
- Real cellular path, reboot recovery, power management and 24–72h endurance remain unverified until new evidence.
- GitHub repo is PUBLIC. Runtime secrets, raw Zalo content, device identifiers and network details are forbidden in commits.

## 3. Open-source inheritance (evaluate, don't copy blindly)
Primary whole-product candidate: https://github.com/vuhai2002/zalo-agent
- Candidate reference for dashboard QR onboarding, multi-account manager, SQLite data model, provider-agnostic AI orchestration.
Protocol candidate: https://github.com/RFS-ADRENO/zca-js
- Candidate for personal Zalo QR login, session and realtime WS events, send/reply methods.
Security/design reference: https://github.com/minhkhoa0502/zalo-personal-mcp
- Session encryption, exact dependency pin, restricted process rights/egress, append-only durable message capture.
Additional comparison: https://github.com/cuongdev/hermes-zalo-plugin and https://github.com/monas-team/zaloclaw

Audit exact commit, LICENSE, transitive dependencies, release cadence, supported OS/Node, session ownership, handling of self messages, read-only controls, and provider calls. Record a **reuse/adapter/fork/reject** verdict per component. If a proposed reuse needs heavy runtimes or auto-send capabilities, prefer extracting narrow modules. Keep notices/attribution as required.

**Platform risk gate:** zca-js and these personal-account integrations are unofficial and warn about ToS/account restrictions. Verify current Zalo terms and documented official options (OA/Bot API generally do not provide full personal-account inbox parity). Do not evade platform restrictions, anti-bot controls, rate limits or device checks. If permission/acceptable risk is not established, stop before live QR activation and complete mock/synthetic work only. A paid/authorized provider offering similar QR UX must be validated separately; Sapo UX is not technical proof.

## 4. Architecture and runtime boundaries
~~~text
Authenticated Operator (Web/PWA over Tailscale)
  -> Zalo Chat UI (account list, unified inbox, manual send approval)
      -> Gateway API + Account Manager
          -> per-account connector / QR session / listener (one listener per account)
          -> normalizer + durable ingest queue -> SQLite WAL
          -> manual Outbox (separate state machine with send guard)
      -> AI Job Queue -> existing M51 llama.cpp router (optional, never on ingest critical path)
~~~

- Define adapter: capabilities(), beginLogin(), getLoginState(), connect(), disconnect(), onEvent(), sendManual() [disabled until approved], getHealth(). Mock and authorized protocol adapters must implement identical typed contracts.
- Canonical events: account_id; thread_id; thread_type (dm/group); source_message_id; sender_id; direction; source_timestamp; received_at; event_kind (message/edit/recall/attachment/other); content type; sanitized content; source_ref; ingest_sequence; trace_id. No assumption about globally unique Zalo message IDs.
- SQLite WAL with unique identity (account_id, thread_id, source_message_id, event_kind/version), transactionally persist before acknowledging consumer work. Idempotent replay and crash restart; event ordering preserved per conversation where possible. Never call AI inside listener callback.
- Connection state: disconnected -> qr_pending -> authenticating -> connected -> degraded/reconnecting -> needs_relogin. QR expires; auto relogin is prohibited without legitimate live session. Record each disconnect gap and coverage uncertainty.
- Account scoping from DB to UI/API/AI. Use per-account encrypted session storage and strict filesystem permissions; never put QR/session/cookies in frontend logs or Git.
- Send state machine: draft -> user_confirmed -> pending -> sent_ack | failed | uncertain. On uncertain outcome, **never blindly resend**; reconcile with authoritative evidence or ask operator.
- Small bounded process/queue, backpressure, retention policy, resource/thermal instrumentation on M51; use existing runit and private Tailscale, no new public listener, no root/Magisk unless explicit separate approval.
- Data minimization and consent: users of each Zalo account must authorize login. Group message privacy needs explicit scope and a retention/deletion policy before real capture.

## 5. Delivery milestones and stage gates
### P0 — Source audit and feasibility (first)
Audit inherited projects and current repo. Produce third-party license/security matrix, pin SHA, component decision and platform permission risk memo. Confirm repo sanitation. Deliver design docs even if personal Zalo QR is NO-GO.

### P1 — Mock-first, runnable gateway vertical slice (build now)
Implement isolated Node/TypeScript gateway inside repo, SQLite schema + migrations, fake multi-account connector, realtime fixtures (DM/group/muted/self/outgoing), dedup, durable queue, reconnection gap logging, private HTTP API, minimal QR state panel (mock QR state clearly labelled, never misrepresent as actual Zalo QR), and unified inbox showing provenance. Unit/integration tests + startup scripts + M51 resource budget check. Sending initially disabled; fixture/manual-send API protected in mock.

### P2 — One-account authorized QR + realtime pilot (conditional)
Only after explicit operator approval and compliance/security GO; use disposable secondary account and consented test chats. Read-only first. Exercise real authorized QR, DM/group/muted/self/new message, simultaneous messages, bad session, network interruption, duplicate events. Compare ground-truth messages vs records. No old history fetch. Document coverage gaps and limitations.

### P3 — Manual two-way send (conditional)
Add operator-confirmed send/quote to one account, outbox receipts, uncertain-send handling, rate limits. Never implement autonomous replies or bulk campaigns. Verify at most one intentional delivery per authorized action (or surface uncertainty).

### P4 — Multi-account scale (conditional)
Incrementally validate 2 then 3 approved test accounts on M51; isolate sessions, listener, UI, permissions and outbox; avoid extra web listeners per same account. Benchmark memory, CPU, power, network churn, service recovery. Avoid promised capacity until measured.

### P5 — AI and operations
5-minute summaries only when new messages exist; urgent local rules first; AI jobs bounded/prioritized, history stored since start, quoted message evidence; manual AI drafts only; multi-account summaries strictly permission-scoped. Phone-only PWA via private Tailscale; real off-LAN, safe reboot, charger and screen-off, 24–72h endurance with witnessed results.

## 6. Acceptance criteria (per gate; planned, not current PASS)
- P1: typed contracts, reproducible offline tests, persistence/dedup/isolation + restart pass with synthetic events; no real Zalo calls, no auto-send.
- P2: read-only, deliberate 100+ synthetic/consented real *new* event test matrix across DM/group/muted/self, message coverage >=99% **only within continuous connected verified windows**; any gap prominently reported as unknown, never represented as zero missed; no unauthorized events.
- P3: manual sends scoped to selected account/thread; no unauthorized or unintended delivery, no duplicate automatic retries; uncertain status handled transparently.
- P4: 1 -> 2 -> 3 account scalability evidence; no cross-account data bleed, no leaked session, phone AI remains responsive to bounded request load.
- P5: test actually performed, not inferred. Label all outcomes PASS/FAIL/SKIP with test commands, dates, hardware/memory, logs sanitized. Define rollback.
- NO-GO: platform permission not established, credential leakage, unintended send, account crossover, unbounded retries, destructive write, missing provenance, or misleading completeness claims.

## 7. Codex model / cost operating guide
This is about **Codex programming models**; not M51's installed Qwen inference models.
- Audit of third-party code, design trade-offs, security and concurrency: **GPT-6.1 Sol, Medium** (escalate to High only for unresolved high-risk issues).
- Well-scoped implementation, tests, fixtures, docs, UI corrections: **Luna, Medium** (Low for trivial changes).
- Difficult integration/debugging/code review: **GPT-6.1 Sol, High**; Astra only for a truly blocked audit/review if available.
- These are model picker recommendations, *not* runtime dependencies or instructions that can switch a Codex model automatically. Choose closest available label in user's Codex client.
- Minimize usage: separate milestones; avoid reading/generated large files repeatedly; run focused tests before full suite; keep a compact evidence handoff; stop at real approval gates; don't use repeated broad "audit everything" prompts.

## 8. Delivery process
Create feature branch from active M51 baseline, keep phone AI services intact, commit only sanitized source/docs, push branch for review, **do not merge main, release, or activate real Zalo credentials without explicit approval**. Produce roadmap status in docs and a short handoff with exact SHA, PASS/FAIL/SKIP and next authorization needed.
