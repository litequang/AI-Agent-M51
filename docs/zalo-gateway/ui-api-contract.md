# Phase 01 UI / mock API contract

All runtime responses identify mock=true. Never render content as HTML. API requires an operator Bearer token supplied by the user at runtime; never hardcode a token in assets. UI keeps token in memory only, includes Authorization on every /api request, and can clear it on logout. API is loopback-only; UI never enables real connectors.

- GET /api/health -> {mock:true,mode:"mock",livePilot:"SKIP",realSend:false,accounts:number,queue:{pending:number,limit:number},...}
- GET /api/accounts -> {accounts:AccountView[]}; account states from src/contracts.ts.
- POST /api/accounts -> {account:AccountView}, body {id,label}; max three accounts, synthetic IDs required.
- POST /api/accounts/:id/login -> {account:AccountView}; simulated challenge has label SIMULATED, challengeId, expiresAt.
- POST /api/accounts/:id/connect -> {account:AccountView}; body {challengeId}, explicit simulated confirmation.
- POST /api/accounts/:id/disconnect -> {account:AccountView}; body {reason:"network_loss"}.
- POST /api/accounts/:id/reconnect -> {account:AccountView}; mock session reconnect, no new real login.
- POST /api/accounts/:id/expire -> {account:AccountView}; simulate session expiry -> needs_relogin.
- POST /api/accounts/:id/fixtures -> {accepted:number,duplicates:number}; body {scenario:"standard"|"burst"|"duplicate",count?:number}; only new synthetic events, up to100 per burst.
- GET /api/inbox?accountId=... -> {threads:ThreadView[]}; omit accountId for unified view scoped to operator-authorized accounts.
- GET /api/messages?accountId=...&threadId=... -> {messages:MessageView[]}; both required and server scoped.
- GET /api/gaps?accountId=... -> {gaps:GapView[]}; coverage always unknown for disconnects.
- GET /api/outbox?accountId=... -> {outbox:OutboxView[]}.
- POST /api/outbox -> {item:OutboxView}; body {accountId,threadId,text,intentId,quoteSourceMessageId?}. Draft only.
- POST /api/outbox/:id/confirm -> {item:OutboxView}; body {accountId,threadId,operatorConfirmed:true}. Requires matching account/thread and explicit manual confirmation. Mock-only delivery; uncertain status is never automatically resent.

Error shape: {error:{code,message}}. HTTP401 unauthenticated,403 unauthorized account/origin,404 not found,409 invalid transition/conflicting intent,413 payload >32KiB,429 bounded queue full. No API accepts live=true or connector real. Account IDs are mock-a/mock-b/mock-c (or other mock- prefixed IDs).

Minimal UI: strong MOCK/SIMULATED banner, login token form, account filter and cards, simulated QR state including expiry, connect/disconnect/reconnect/expire controls, fixture buttons, unified thread list with account provenance, thread messages/time/direction/event labels, explicit unknown gap notice, mock composer with draft then separate confirm. Polling can be used instead of SSE; no automatic real or mock sends from AI.
