import { parentPort, workerData } from "node:worker_threads";
// Composite account/thread + WAL pattern informed by zalo-agent database.ts,
// 4346f295e9dbd787a427993ddf3b083ebb57cf15. New worker/schema/durability design.
// MIT notice retained in ../../third-party/zalo-agent.LICENSE.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AccountState, CanonicalEvent, ManualSendInput } from "./contracts.js";

const options = workerData as { path: string; queueLimit: number };
mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
if (existsSync(options.path) && lstatSync(options.path).isSymbolicLink()) throw Error("Database symlink rejected");
if (!existsSync(options.path)) closeSync(openSync(options.path, "wx", 0o600));
chmodSync(options.path, 0o600);
const db = new DatabaseSync(options.path);
db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000; PRAGMA cache_size=-4096; PRAGMA wal_autocheckpoint=128;");
if(Object.values(db.prepare("PRAGMA journal_mode").get()!)[0]!=="wal" || Object.values(db.prepare("PRAGMA synchronous").get()!)[0]!==2 || Object.values(db.prepare("PRAGMA foreign_keys").get()!)[0]!==1)throw Error("Required SQLite durability settings not effective");
db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts(
 id TEXT PRIMARY KEY, label TEXT NOT NULL, state TEXT NOT NULL, collector_started_at TEXT,
 session_valid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 connector TEXT NOT NULL DEFAULT 'mock' CHECK(connector='mock'));
CREATE TABLE IF NOT EXISTS sessions_metadata(
 account_id TEXT PRIMARY KEY REFERENCES accounts(id), mock INTEGER NOT NULL CHECK(mock=1),
 authenticated_at TEXT NOT NULL, expires_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS threads(
 account_id TEXT NOT NULL REFERENCES accounts(id), thread_id TEXT NOT NULL, thread_type TEXT NOT NULL,
 label TEXT NOT NULL, muted INTEGER NOT NULL DEFAULT 0, last_message_at TEXT,
 PRIMARY KEY(account_id,thread_id));
CREATE TABLE IF NOT EXISTS ingest_events(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id),
 thread_id TEXT NOT NULL, source_message_id TEXT NOT NULL, event_kind TEXT NOT NULL, version INTEGER NOT NULL,
 payload TEXT NOT NULL, received_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','processed')),
 UNIQUE(account_id,thread_id,source_message_id,event_kind,version));
CREATE INDEX IF NOT EXISTS ingest_pending ON ingest_events(state,sequence);
CREATE TABLE IF NOT EXISTS messages(
 account_id TEXT NOT NULL, thread_id TEXT NOT NULL, source_message_id TEXT NOT NULL,
 payload TEXT NOT NULL, version INTEGER NOT NULL, sequence INTEGER NOT NULL REFERENCES ingest_events(sequence),
 recalled INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(account_id,thread_id,source_message_id),
 FOREIGN KEY(account_id,thread_id) REFERENCES threads(account_id,thread_id));
CREATE TABLE IF NOT EXISTS disconnect_gaps(
 id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id),
 started_at TEXT NOT NULL, ended_at TEXT, reason TEXT NOT NULL, coverage TEXT NOT NULL DEFAULT 'unknown');
CREATE TABLE IF NOT EXISTS outbox(
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, thread_id TEXT NOT NULL, intent_id TEXT NOT NULL,
 request TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('draft','user_confirmed','pending','sent_ack','failed','uncertain')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT,
 UNIQUE(account_id,intent_id), FOREIGN KEY(account_id,thread_id) REFERENCES threads(account_id,thread_id));
CREATE TABLE IF NOT EXISTS outbox_transitions(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, outbox_id TEXT NOT NULL REFERENCES outbox(id),
 state TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, thread_id TEXT NOT NULL, kind TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', snapshot TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL,
 FOREIGN KEY(account_id,thread_id) REFERENCES threads(account_id,thread_id));
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
`);
type Row = Record<string, any>;
const now = () => new Date().toISOString();
const one = (sql: string, ...args: any[]) => db.prepare(sql).get(...args) as Row | undefined;
const all = (sql: string, ...args: any[]) => db.prepare(sql).all(...args) as Row[];
function fail(code: string, message: string, status = 400): never { throw Object.assign(new Error(message), { code, status }); }
function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const result = fn(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function account(id: string) {
  const row = one("SELECT * FROM accounts WHERE id=?", id);
  if (!row) fail("NOT_FOUND", "Account not found", 404);
  return { id: row.id, label: row.label, state: row.state, mock: true, collectorStartedAt: row.collector_started_at };
}
function outbox(id: string) {
  const row = one("SELECT * FROM outbox WHERE id=?", id);
  if (!row) fail("NOT_FOUND", "Outbox item not found", 404);
  return { ...JSON.parse(row.request), id: row.id, state: row.state, createdAt: row.created_at, updatedAt: row.updated_at, mock: true, confirmationRequired: true, ...(row.error ? { error: row.error } : {}) };
}
function transition(id: string, state: string, error: string | null = null) {
  db.prepare("UPDATE outbox SET state=?,updated_at=?,error=? WHERE id=?").run(state, now(), error, id);
  db.prepare("INSERT INTO outbox_transitions(outbox_id,state,created_at) VALUES(?,?,?)").run(id, state, now());
}
function requireThread(accountId: string, threadId: string) {
  if (!one("SELECT 1 FROM threads WHERE account_id=? AND thread_id=?", accountId, threadId)) fail("NOT_FOUND", "Thread not found in selected account", 404);
}
function storageBudget() {
  const bytes=[options.path,options.path+"-wal"].reduce((sum,path)=>sum+(existsSync(path)?statSync(path).size:0),0);
  if(bytes>=64*1024*1024)fail("STORAGE_BUDGET","Mock storage reached 64 MiB; no new action accepted",429);
}
function openGap(accountId:string,stamp:string,reason:string) {
  if(one("SELECT 1 FROM disconnect_gaps WHERE account_id=? AND ended_at IS NULL",accountId))return;
  const rows=all("SELECT id FROM disconnect_gaps WHERE account_id=? ORDER BY id DESC",accountId);
  if(rows.length>=128) {
    // Conservatively merge unknown intervals rather than pretending coverage.
    db.prepare("UPDATE disconnect_gaps SET ended_at=NULL,reason='budget_merged_unknown_intervals' WHERE id=?").run(rows[0]!.id);
  } else db.prepare("INSERT INTO disconnect_gaps(account_id,started_at,reason) VALUES(?,?,?)").run(accountId,stamp,reason);
}
const operations: Record<string, (input: any) => any> = {
  createAccount(input: { id: string; label: string }) {
    if (one("SELECT 1 FROM accounts WHERE id=?", input.id)) fail("ACCOUNT_EXISTS", "Account already exists", 409);
    if (Number(one("SELECT count(*) n FROM accounts")!.n) >= 3) fail("ACCOUNT_LIMIT", "Mock limit: three accounts", 429);
    const stamp = now();
    db.prepare("INSERT INTO accounts(id,label,state,created_at,updated_at) VALUES(?,?,'disconnected',?,?)").run(input.id, input.label, stamp, stamp);
    return account(input.id);
  },
  accounts() { return all("SELECT id FROM accounts ORDER BY id").map(row => account(row.id)); },
  account(input: { id: string }) { return account(input.id); },
  session(input: { id: string }) { return one("SELECT * FROM sessions_metadata WHERE account_id=?", input.id) ?? null; },
  setState(input: { id: string; state: AccountState; reason?: string }) {
    return transaction(() => {
      const previous = account(input.id), stamp = now();
      if (previous.state === "connected" && input.state !== "connected" && previous.collectorStartedAt) {
        openGap(input.id,stamp,input.reason??input.state);
      }
      if (input.state === "connected") {
        db.prepare("UPDATE accounts SET collector_started_at=COALESCE(collector_started_at,?),session_valid=1 WHERE id=?").run(stamp, input.id);
        db.prepare("UPDATE disconnect_gaps SET ended_at=? WHERE account_id=? AND ended_at IS NULL").run(stamp, input.id);
        db.prepare("INSERT INTO sessions_metadata(account_id,mock,authenticated_at,expires_at) VALUES(?,1,?,?) ON CONFLICT(account_id) DO UPDATE SET authenticated_at=excluded.authenticated_at,expires_at=excluded.expires_at,version=version+1").run(input.id, stamp, new Date(Date.now()+3600_000).toISOString());
      } else if (input.state === "needs_relogin" || input.state === "qr_pending") {
        db.prepare("UPDATE accounts SET session_valid=0 WHERE id=?").run(input.id);
        db.prepare("DELETE FROM sessions_metadata WHERE account_id=?").run(input.id);
      }
      db.prepare("UPDATE accounts SET state=?,updated_at=? WHERE id=?").run(input.state, stamp, input.id);
      return account(input.id);
    });
  },
  recover() {
    return transaction(() => {
      for (const row of all("SELECT id,updated_at FROM accounts WHERE state='connected'")) {
        openGap(row.id,row.updated_at,"process_restart");
        db.prepare("UPDATE accounts SET state='reconnecting' WHERE id=?").run(row.id);
      }
      for (const row of all("SELECT id FROM outbox WHERE state IN('pending','user_confirmed')")) transition(row.id, "uncertain", "Process restarted during delivery; do not resend");
      db.prepare("UPDATE jobs SET state='failed',result='Interrupted; explicit operator retry required' WHERE state='running'").run();
      return operations.accounts!(null);
    });
  },
  ingest(event: CanonicalEvent) {
    return transaction(() => {
      const a = account(event.accountId);
      const existing = one("SELECT sequence FROM ingest_events WHERE account_id=? AND thread_id=? AND source_message_id=? AND event_kind=? AND version=?", event.accountId, event.threadId, event.sourceMessageId, event.eventKind, event.version);
      if (existing) return { ingestSequence: Number(existing.sequence), duplicate: true, persisted: true };
      storageBudget();
      if(!one("SELECT 1 FROM ingest_events WHERE account_id=? AND thread_id=? LIMIT 1",event.accountId,event.threadId) && Number(one("SELECT count(DISTINCT thread_id) n FROM ingest_events WHERE account_id=?",event.accountId)!.n)>=100)fail("THREAD_LIMIT","Mock account thread cap reached; event not acknowledged",429);
      if (a.state !== "connected" || !a.collectorStartedAt) fail("NOT_CONNECTED", "Collector is not active", 409);
      if (Date.parse(event.sourceTimestamp) < Date.parse(a.collectorStartedAt)) fail("HISTORY_DISABLED", "Only new events after collector activation are accepted", 409);
      if (Number(one("SELECT count(*) n FROM ingest_events WHERE state='pending'")!.n) >= options.queueLimit) fail("BACKPRESSURE", "Durable ingest queue is full; event not acknowledged", 429);
      if (Number(one("SELECT count(*) n FROM ingest_events")!.n) >= 10000) fail("RETENTION_LIMIT", "Mock storage cap reached; explicit retention review needed", 429);
      const result = db.prepare("INSERT INTO ingest_events(account_id,thread_id,source_message_id,event_kind,version,payload,received_at) VALUES(?,?,?,?,?,?,?)").run(event.accountId,event.threadId,event.sourceMessageId,event.eventKind,event.version,JSON.stringify(event),event.receivedAt);
      return { ingestSequence: Number(result.lastInsertRowid), duplicate: false, persisted: true };
    });
  },
  drain(input: { limit?: number }) {
    return transaction(() => {
      const events = all("SELECT sequence,payload FROM ingest_events WHERE state='pending' ORDER BY sequence LIMIT ?", Math.min(input.limit ?? 32, 64));
      for (const row of events) {
        const e = JSON.parse(row.payload) as CanonicalEvent;
        db.prepare("INSERT INTO threads(account_id,thread_id,thread_type,label,muted,last_message_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,thread_id) DO UPDATE SET label=excluded.label,muted=excluded.muted,last_message_at=MAX(threads.last_message_at,excluded.last_message_at)").run(e.accountId,e.threadId,e.threadType,e.threadLabel,Number(e.muted),e.sourceTimestamp);
        db.prepare("INSERT INTO messages(account_id,thread_id,source_message_id,payload,version,sequence,recalled) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id,thread_id,source_message_id) DO UPDATE SET payload=excluded.payload,version=excluded.version,sequence=excluded.sequence,recalled=excluded.recalled WHERE (excluded.version>messages.version OR (excluded.version=messages.version AND excluded.sequence>messages.sequence)) AND (messages.recalled=0 OR excluded.recalled=1)").run(e.accountId,e.threadId,e.sourceMessageId,JSON.stringify(e),e.version,row.sequence,Number(e.eventKind==="recall"));
        db.prepare("UPDATE ingest_events SET state='processed' WHERE sequence=?").run(row.sequence);
      }
      return { processed: events.length };
    });
  },
  stats() {
    return { accounts: Number(one("SELECT count(*) n FROM accounts")!.n),
      queue: { pending: Number(one("SELECT count(*) n FROM ingest_events WHERE state='pending'")!.n), limit: options.queueLimit },
      events: Number(one("SELECT count(*) n FROM ingest_events")!.n), messages: Number(one("SELECT count(*) n FROM messages")!.n),
      jobs: Number(one("SELECT count(*) n FROM jobs WHERE state='pending'")!.n),
      journalMode: Object.values(one("PRAGMA journal_mode")!)[0], synchronous: Object.values(one("PRAGMA synchronous")!)[0], schemaVersion: 1 };
  },
  inbox(input: { accountIds: string[] }) {
    if (!input.accountIds.length) return [];
    return all("SELECT t.*, (SELECT count(*) FROM messages m WHERE m.account_id=t.account_id AND m.thread_id=t.thread_id) message_count FROM threads t WHERE t.account_id IN("+input.accountIds.map(() => "?").join(",")+") ORDER BY t.last_message_at DESC,t.account_id,t.thread_id", ...input.accountIds).map(row => ({ accountId: row.account_id,threadId: row.thread_id,threadType: row.thread_type,label: row.label,muted: Boolean(row.muted),messageCount: Number(row.message_count),lastMessageAt: row.last_message_at }));
  },
  messages(input: { accountId: string; threadId: string }) {
    requireThread(input.accountId,input.threadId);
    return all("SELECT * FROM (SELECT payload,sequence,recalled FROM messages WHERE account_id=? AND thread_id=? ORDER BY sequence DESC LIMIT 200) ORDER BY sequence",input.accountId,input.threadId).map(row => ({ ...JSON.parse(row.payload),ingestSequence:Number(row.sequence),recalled:Boolean(row.recalled) }));
  },
  gaps(input: { accountIds: string[] }) {
    if (!input.accountIds.length) return [];
    return all("SELECT * FROM disconnect_gaps WHERE account_id IN("+input.accountIds.map(()=>"?").join(",")+") ORDER BY id DESC LIMIT 100",...input.accountIds).map(row => ({id:Number(row.id),accountId:row.account_id,startedAt:row.started_at,endedAt:row.ended_at,reason:row.reason,coverage:"unknown"}));
  },
  createDraft(input: ManualSendInput) {
    return transaction(() => {
      requireThread(input.accountId,input.threadId);
      if (input.quoteSourceMessageId && !one("SELECT 1 FROM messages WHERE account_id=? AND thread_id=? AND source_message_id=?", input.accountId,input.threadId,input.quoteSourceMessageId)) fail("QUOTE_SCOPE","Quoted message is not in selected account/thread",403);
      const previous = one("SELECT id,request FROM outbox WHERE account_id=? AND intent_id=?",input.accountId,input.intentId);
      if (previous) {
        if (previous.request !== JSON.stringify(input)) fail("INTENT_CONFLICT","Intent already exists with different content/thread",409);
        return outbox(previous.id);
      }
      storageBudget();
      if(Number(one("SELECT count(*) n FROM outbox")!.n)>=1000)fail("OUTBOX_LIMIT","Mock outbox cap reached",429);
      const id = randomUUID(), stamp = now();
      db.prepare("INSERT INTO outbox(id,account_id,thread_id,intent_id,request,state,created_at,updated_at) VALUES(?,?,?,?,?,'draft',?,?)").run(id,input.accountId,input.threadId,input.intentId,JSON.stringify(input),stamp,stamp);
      db.prepare("INSERT INTO outbox_transitions(outbox_id,state,created_at) VALUES(?,'draft',?)").run(id,stamp);
      return outbox(id);
    });
  },
  outbox(input: { id: string }) { return outbox(input.id); },
  listOutbox(input: { accountIds: string[] }) {
    if (!input.accountIds.length) return [];
    return all("SELECT id FROM outbox WHERE account_id IN("+input.accountIds.map(()=>"?").join(",")+") ORDER BY created_at DESC LIMIT 100",...input.accountIds).map(row=>outbox(row.id));
  },
  claimSend(input: { id: string; accountId: string; threadId: string; operatorConfirmed: boolean }) {
    return transaction(() => {
      const item = outbox(input.id);
      if (!input.operatorConfirmed) fail("CONFIRMATION_REQUIRED","Explicit operator confirmation required",403);
      if (item.accountId !== input.accountId || item.threadId !== input.threadId) fail("SEND_SCOPE","Selected account/thread does not match draft",403);
      if (item.state === "sent_ack") return { claimed:false,item };
      if (item.state !== "draft") fail("NO_RETRY","This state cannot be resent; inspect delivery evidence",409);
      if (account(item.accountId).state !== "connected") fail("NOT_CONNECTED","Selected account is not connected",409);
      transition(item.id,"user_confirmed"); transition(item.id,"pending");
      return {claimed:true,item:outbox(item.id)};
    });
  },
  finishSend(input: { id: string; state: string; error?: string }) {
    return transaction(() => {
      if (!["sent_ack","failed","uncertain"].includes(input.state)) fail("INVALID_STATE","Invalid delivery state");
      if (outbox(input.id).state !== "pending") fail("INVALID_STATE","Delivery is not pending",409);
      transition(input.id,input.state,input.error ?? null);
      return outbox(input.id);
    });
  },
  createJob(input: { accountId: string; threadId: string; kind: string }) {
    requireThread(input.accountId,input.threadId);
    if (Number(one("SELECT count(*) n FROM jobs WHERE state IN('pending','running')")!.n) >= 16) fail("JOB_LIMIT","AI job queue full",429);
    storageBudget();
    if(Number(one("SELECT count(*) n FROM jobs")!.n)>=256)fail("JOB_LIMIT","Mock job retention cap reached",429);
    const id=randomUUID(), stamp=now(), snapshot=operations.messages!({accountId:input.accountId,threadId:input.threadId}).slice(-32).map((row:any)=>({...row,content:row.content.slice(0,256)}));
    while(Buffer.byteLength(JSON.stringify(snapshot))>16384)snapshot.shift();
    db.prepare("INSERT INTO jobs(id,account_id,thread_id,kind,snapshot,created_at) VALUES(?,?,?,?,?,?)").run(id,input.accountId,input.threadId,input.kind,JSON.stringify(snapshot),stamp);
    return { id, accountId:input.accountId,threadId:input.threadId,kind:input.kind,state:"pending",mock:true };
  },
  claimJob() {
    return transaction(() => {
      const row=one("SELECT * FROM jobs WHERE state='pending' ORDER BY created_at LIMIT 1");
      if (!row) return null;
      db.prepare("UPDATE jobs SET state='running' WHERE id=?").run(row.id);
      return {id:row.id,accountId:row.account_id,threadId:row.thread_id,kind:row.kind,messages:JSON.parse(row.snapshot)};
    });
  },
  finishJob(input: {id:string; result:string; failed?:boolean}) {
    db.prepare("UPDATE jobs SET state=?,result=? WHERE id=? AND state='running'").run(input.failed?"failed":"done",input.result.slice(0,8000),input.id);
    return {id:input.id};
  }
};
parentPort!.on("message", (message: { id: number; operation: string; input: unknown }) => {
  try {
    if (message.operation === "close") { db.close(); parentPort!.postMessage({id:message.id,result:true}); parentPort!.close(); return; }
    const operation = operations[message.operation];
    if (!operation) fail("UNKNOWN_OPERATION","Unknown storage operation");
    parentPort!.postMessage({id:message.id,result:operation(message.input)});
  } catch (error) {
    const e=error as Error & {code?:string;status?:number};
    parentPort!.postMessage({id:message.id,error:{code:e.code??"STORAGE_ERROR",message:e.status?e.message:"Storage operation failed",status:e.status??500}});
  }
});
parentPort!.postMessage({ready:true});
