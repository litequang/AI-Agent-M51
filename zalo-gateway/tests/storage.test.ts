import assert from "node:assert/strict";
import { test } from "node:test";
import { Gateway } from "../src/gateway.js";
import { setup,connect,message } from "./helpers.js";

test("three accounts share source/thread IDs without crossover; duplicates are no-op",async()=>{
  const context=await setup();
  try {
    for(const id of ["mock-a","mock-b","mock-c"]) {
      await connect(context.app,id);
      const event={...message(id),content:"Synthetic content of "+id};
      const first=await context.app.ingest(event),duplicate=await context.app.ingest(event);
      assert.equal(first.persisted,true);assert.equal(duplicate.duplicate,true);
      assert.equal(first.ingestSequence,duplicate.ingestSequence);
    }
    await context.app.drain();
    const stats=await context.app.health();
    assert.equal(stats.events,3);assert.equal(stats.messages,3);assert.equal(stats.journalMode,"wal");assert.equal(stats.synchronous,2);
    for(const id of ["mock-a","mock-b","mock-c"]) {
      const rows=await context.app.store.call("messages",{accountId:id,threadId:"mock-thread-shared"});
      assert.equal(rows.length,1);assert.equal(rows[0].accountId,id);assert.equal(rows[0].content,"Synthetic content of "+id);
    }
    const threads=await context.app.store.call("inbox",{accountIds:["mock-a"]});
    assert.deepEqual(threads.map((row:any)=>row.accountId),["mock-a"]);
    await assert.rejects(context.app.createAccount({id:"mock-d",label:"Fourth account"}),{code:"ACCOUNT_LIMIT"});
  } finally {await context.close();}
});

test("durable queue applies backpressure without losing an unacknowledged event",async()=>{
  const context=await setup({autoDrain:false,queueLimit:2});
  try {
    await connect(context.app);
    const one=message("mock-a","mock-one"),two=message("mock-a","mock-two"),three=message("mock-a","mock-three");
    await context.app.ingest(one);await context.app.ingest(two);
    await assert.rejects(context.app.ingest(three),{code:"BACKPRESSURE"});
    const duplicate=await context.app.ingest(one);assert.equal(duplicate.duplicate,true);
    await context.app.drain();
    assert.equal((await context.app.ingest(three)).persisted,true);
    await context.app.drain();
    assert.equal((await context.app.health()).messages,3);
  } finally {await context.close();}
});

test("new-only collector rejects old history; disconnected interval remains unknown",async()=>{
  const context=await setup();
  try {
    await connect(context.app);
    await assert.rejects(context.app.ingest({...message(),sourceTimestamp:"2000-01-01T00:00:00.000Z"}),{code:"HISTORY_DISABLED"});
    await context.app.accountAction("mock-a","disconnect",{reason:"network_loss"});
    await assert.rejects(context.app.connector("mock-a").emit(message()),/connect|active|session/i);
    let gaps=await context.app.store.call("gaps",{accountIds:["mock-a"]});
    assert.equal(gaps.length,1);assert.equal(gaps[0].coverage,"unknown");assert.equal(gaps[0].endedAt,null);
    await context.app.accountAction("mock-a","reconnect");
    gaps=await context.app.store.call("gaps",{accountIds:["mock-a"]});
    assert.ok(gaps[0].endedAt);assert.equal(gaps[0].coverage,"unknown");
    await context.app.ingest(message());
    await context.app.drain();
    assert.equal((await context.app.health()).messages,1);
  } finally {await context.close();}
});

test("pending journal survives store restart and is replayed idempotently",async()=>{
  const context=await setup({autoDrain:false});
  try {
    await connect(context.app);
    const event=message();
    await context.app.ingest(event);
    assert.equal((await context.app.health()).queue.pending,1);
    await context.app.store.close();
    const recovered=new Gateway({databasePath:context.dir+"/gateway.db"});
    try {
      await recovered.initialize();
      assert.equal((await recovered.health()).messages,1);
      assert.equal((await recovered.ingest(event)).duplicate,true);
      const gaps=await recovered.store.call("gaps",{accountIds:["mock-a"]});
      assert.equal(gaps[0].reason,"process_restart");assert.equal(gaps[0].coverage,"unknown");
    } finally {await recovered.close();}
  } finally {await context.close();}
});

test("one slow AI job does not block capture and receives only its own account/thread",async()=>{
  const context=await setup();
  let finish:(value:string)=>void=()=>{};
  try {
    await connect(context.app,"mock-a");await connect(context.app,"mock-b");
    await context.app.ingest(message("mock-a"));await context.app.ingest(message("mock-b"));await context.app.drain();
    await context.app.createJob({accountId:"mock-a",threadId:"mock-thread-shared",kind:"draft"});
    let started!:()=>void;const providerStarted=new Promise<void>(resolve=>started=resolve);
    const job=context.app.runNextAiJob(async(input)=>{
      assert.ok(input.messages.every(item=>item.accountId==="mock-a"&&item.threadId==="mock-thread-shared"));
      started();return new Promise<string>(resolve=>finish=resolve);
    });
    await providerStarted;
    const receipt=await context.app.ingest(message("mock-b","mock-during-ai"));
    assert.equal(receipt.persisted,true);
    await context.app.drain();
    assert.equal((await context.app.health()).messages,3);
    assert.equal((await context.app.store.call("listOutbox",{accountIds:["mock-a","mock-b"]})).length,0);
    finish("Synthetic draft only, no send.");await job;
  } finally {finish("cancel");await context.close();}
});

test("invalid real connector, credential fields and malformed source events are rejected",async()=>{
  assert.throws(()=>new Gateway({databasePath:"unused.db",mode:"zalo"}),{code:"LIVE_GATE_CLOSED"});
  const context=await setup();
  try {
    await assert.rejects(context.app.createAccount({id:"personal-1",label:"Not mock"}),{code:"MOCK_ONLY"});
    await assert.rejects(context.app.createAccount({id:"mock-a",label:"Mock",cookie:"must not persist"}),{code:"UNKNOWN_FIELD"});
    await connect(context.app);
    await assert.rejects(context.app.ingest({...message(),sourceRef:"https://example.invalid/real"}),{code:"INVALID_EVENT"});
    await assert.rejects(context.app.ingest({...message(),cookie:"must not persist"}),{code:"UNKNOWN_FIELD"});
  } finally {await context.close();}
});
