# Phase 01 architecture

This independently runnable module complements the existing phone AI/chat services.
It does not import their config, API key, model runtime or Tailscale state.

    Browser (memory-only operator token)
      -> loopback HTTP API / account-scoped authorization
        -> Gateway / one mock connector per account
          -> validate + account-bound source normalizer
            -> bounded IPC -> SQLite worker / FULL WAL ingest journal
              -> asynchronous bounded projection -> unified inbox
        -> immutable draft -> explicit mock confirmation -> durable outbox claim
        -> separate bounded AI job queue (executor disabled)

## Contracts and identity

contracts.ts defines the connector, capabilities, account lifecycle, canonical event,
receipt, thread, gap and outbox types. IDs remain strings. Event identity is
(accountId, threadId, sourceMessageId, eventKind, version), never global message ID.
All user operations and quote lookups bind account/thread; connector callbacks
independently check the account supplied by their trusted binding.

Mock account state: disconnected -> qr_pending -> authenticating -> connected;
network loss -> reconnecting -> connected; expired QR/session -> needs_relogin.
Only synthetic session metadata is persisted, never real QR/cookies/keys.
QR challenge TTL is 60 seconds. Restart restores only an unexpired mock session;
no real automatic login path exists. One DB owner lock and one listener per account
prevent duplicate local collectors. Same-user malicious code is outside isolation.

## Durability and ordering

Node's built-in SQLite runs in a worker: WAL, synchronous FULL, foreign_keys ON,
busy_timeout 3000ms, 4 MiB page cache and checkpoint every 128 pages. Effective
pragmas are asserted. Schema migration v1 creates accounts, sessions_metadata,
threads, messages, ingest_events, disconnect_gaps, outbox, outbox_transitions, jobs
and schema_migrations. Future migrations must be versioned and preserve the journal.

An event receipt is emitted only after its journal transaction commits. It means
local durable acceptance, **not an upstream Zalo delivered/seen receipt**. Projection
runs in batches of 32 and marks processed in the same transaction as materialization.
Replayed identities are no-op even when disconnected or at capacity. Delayed versions
cannot overwrite newer projections; recall is terminal and cannot be undone by edits.
The journal still contains the original synthetic events; recall is not data erasure.

New-only cutoff is recorded at first collector activation. Mock source timestamps
older than that cutoff are rejected. No history API or old_messages subscription
exists. This strict clock policy would reject delayed/skewed legitimate source events;
a permitted real adapter needs a source-specific policy and coverage validation first.

Restart records a conservative unknown gap beginning at the last account-state
update; it may overstate downtime. Disconnect gaps never mean zero missed events.
Real protocol overflow cannot be claimed lossless: a future unpausable source must
fail closed, disconnect and expose unknown coverage rather than acknowledge loss.

## Bounds and retention

- 3 accounts; 1 listener each; connector pending callbacks 64.
- Validated event <=12 KiB serialized, text <=8000 chars; HTTP body <=32 KiB.
- Worker mailbox 128; durable pending journal 512; drain 32 (maximum64).
- 10000 total event rows; 100 distinct threads/account; 1000 immutable outbox items.
- 128 gap intervals/account, then conservatively merge unknown intervals.
- 16 pending/running AI jobs, 256 retained total; snapshot <=16 KiB, <=32 messages,
  content <=256 chars/message; result <=8000 chars.
- New ingest/drafts/jobs stop when DB+WAL is already >=64 MiB. The accepting
  transaction and draining already accepted events can exceed this threshold;
  it is a soft admission threshold, not an absolute filesystem quota.
- Latest 200 messages/thread displayed; 100 recent gaps/outbox items returned.

Caps return explicit rejection, never acknowledge uncommitted events or silently
purge journal history. Retention/deletion and disk-full operational alerts remain
a live-pilot gate. SQLite power-loss guarantees depend on Android storage/fsync;
SIGKILL recovery is not a physical power-loss test.

## Sending and AI boundary

Only mock connector dispatch exists. Draft input is immutable and idempotent by
(account,intentId). Operator-selected account/thread and explicit confirmation
atomically claim draft -> user_confirmed -> pending. Dispatch finishes sent_ack,
failed or uncertain; restart converts in-flight sends to uncertain; no automatic
retry. A mock acknowledgement is not a real Zalo delivery.

HTTP authenticates and scopes every operation. The boolean mock confirmation is
not the future live authorization protocol: live requires operator identity,
payload-bound one-use nonce, expiry, fresh review and reconciliation evidence.
AI jobs have no send capability and do not start automatically. An injected test
provider demonstrates ingest independence. No Qwen endpoint is contacted.

## Phone operation

Node 24's native Android SQLite was exercised directly; build portable JS on PC
and run dist on Termux. Only isolated synthetic temporary tests run in Phase 01.
The production AI/chat listeners remain on their existing ports; prospective mock
gateway is loopback8790 only. No persistent service, Boot hook, public listener,
private Serve mapping or real connector was activated. PC is not a gateway runtime
dependency once a separately approved phone service is started.
