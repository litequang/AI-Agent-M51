import assert from "node:assert/strict";
import { test } from "node:test";
import { MockConnector } from "../src/connectors/mock.js";
import { makeFixtures } from "../src/fixtures.js";
import { message } from "./helpers.js";

async function connected(connector:MockConnector) {
  const login=await connector.beginLogin();
  assert.equal(login.qr!.label,"SIMULATED");
  await connector.connect(login.qr!.challengeId);
}
test("mock-only capabilities, QR expiry and per-account state transitions",async()=>{
  let now=0;
  const a=new MockConnector("mock-a",{now:()=>now,qrTtlMs:1000}),b=new MockConnector("mock-b");
  assert.equal(a.capabilities().realLogin,false);assert.equal(a.capabilities().realSend,false);
  assert.throws(()=>new MockConnector("actual-account"),{code:"MOCK_ONLY"});
  const login=await a.beginLogin();
  await assert.rejects(a.connect("other-challenge"),{code:"CHALLENGE_MISMATCH"});
  now=1000;
  assert.equal(a.getLoginState().state,"needs_relogin");
  await assert.rejects(a.connect(login.qr!.challengeId),{code:"QR_EXPIRED"});
  await connected(a);
  assert.equal(a.getLoginState().state,"connected");assert.equal(b.getLoginState().state,"disconnected");
  await a.disconnect("network_loss");assert.equal(a.getLoginState().state,"reconnecting");
  await a.reconnect();assert.equal(a.getLoginState().state,"connected");
  a.expireSession();assert.equal(a.getLoginState().state,"needs_relogin");
  await assert.rejects(a.reconnect(),{code:"NEEDS_RELOGIN"});
});
test("single listener, bounded pending work and durable acknowledgement propagation",async()=>{
  const connector=new MockConnector("mock-a",{maxPending:1});
  await connected(connector);
  let release!:(value:any)=>void;
  const unsubscribe=connector.onEvent(async()=>new Promise(resolve=>release=resolve));
  assert.throws(()=>connector.onEvent(async()=>({ingestSequence:2,duplicate:false,persisted:true})),{code:"LISTENER_EXISTS"});
  const pending=connector.emit(message());
  await assert.rejects(connector.emit(message("mock-a","mock-overload")),{code:"BACKPRESSURE"});
  release({ingestSequence:1,duplicate:false,persisted:true});
  assert.equal((await pending).persisted,true);
  unsubscribe();
  connector.onEvent(async()=>{throw new Error("disk-full-test");});
  await assert.rejects(connector.emit(message()),/disk-full-test/);
  await assert.rejects(connector.emit(message("mock-b")),{code:"ACCOUNT_SCOPE"});
});
test("fixtures cover all required forms and duplicate source identity across accounts",()=>{
  const a=makeFixtures("mock-a","standard"),b=makeFixtures("mock-b","standard");
  assert.ok(a.some(e=>e.threadType==="group"&&e.muted));
  assert.ok(a.some(e=>e.direction==="self"));assert.ok(a.some(e=>e.direction==="outbound"));
  for(const kind of ["message","edit","recall","attachment","other"])assert.ok(a.some(e=>e.eventKind===kind));
  assert.equal(a[0]!.sourceMessageId,b[0]!.sourceMessageId);
  const dup=makeFixtures("mock-a","duplicate");assert.deepEqual(dup[0],dup[1]);
  assert.equal(new Set(makeFixtures("mock-a","burst",Date.now(),100).map(e=>e.sourceMessageId)).size,100);
  assert.throws(()=>makeFixtures("mock-a","burst",Date.now(),101),{code:"FIXTURE_LIMIT"});
});
test("mock delivery caches uncertain receipt and never retries a repeated intent",async()=>{
  const connector=new MockConnector("mock-a");await connected(connector);
  connector.setSendOutcome("uncertain");
  const input={accountId:"mock-a",threadId:"mock-thread",text:"Giả lập",intentId:"mock-intent"};
  assert.equal((await connector.sendManual(input)).state,"uncertain");
  connector.setSendOutcome("sent_ack");
  assert.equal((await connector.sendManual(input)).state,"uncertain");
  await assert.rejects(connector.sendManual({...input,text:"Changed"}),{code:"INTENT_CONFLICT"});
});
