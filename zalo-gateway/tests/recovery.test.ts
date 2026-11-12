import assert from "node:assert/strict";
import { test } from "node:test";
import { fork } from "node:child_process";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Gateway } from "../src/gateway.js";
import { Store } from "../src/store.js";
import { setup,connect,message } from "./helpers.js";

test("SIGKILL after durable receipt recovers journal and marks in-flight send uncertain without retry",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"m51-gateway-crash-"));
  const child=fork(fileURLToPath(new URL("./crash-child.js",import.meta.url)),[join(dir,"gateway.db")],{stdio:["ignore","ignore","pipe","ipc"]});
  let recovered:Gateway|undefined;
  try {
    const ready=await new Promise<{ready:boolean;persisted:boolean;outboxId:string}>((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill();reject(new Error("Isolated child startup timed out"));},15000);
      child.once("message",data=>{clearTimeout(timer);resolve(data as any);});
      child.once("error",error=>{clearTimeout(timer);reject(error);});
      child.once("exit",code=>{clearTimeout(timer);if(code!==null)reject(new Error("Child exited before test receipt"));});
    });
    assert.equal(ready.persisted,true);
    const exited=new Promise<void>(resolve=>child.once("exit",()=>resolve()));
    child.kill("SIGKILL");await exited;
    recovered=new Gateway({databasePath:join(dir,"gateway.db")});await recovered.initialize();
    const stats=await recovered.health();assert.equal(stats.events,2);assert.equal(stats.messages,2);
    const item=await recovered.store.call("outbox",{id:ready.outboxId});assert.equal(item.state,"uncertain");
    await assert.rejects(recovered.confirmSend(item.id,{accountId:"mock-a",threadId:item.threadId,operatorConfirmed:true}),{code:"NO_RETRY"});
    const gaps=await recovered.store.call("gaps",{accountIds:["mock-a"]});assert.equal(gaps[0].coverage,"unknown");
  } finally {if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");await recovered?.close();await rm(dir,{recursive:true,force:true});}
});

test("stale edits cannot resurrect recall tombstones; boundary rejects mislabeled account",async()=>{
  const context=await setup({autoDrain:false});
  try {
    await connect(context.app,"mock-a");await connect(context.app,"mock-b");
    const base=message("mock-a","mock-out-of-order");
    await context.app.ingest({...base,eventKind:"recall",version:3,content:""});
    await context.app.ingest({...base,eventKind:"edit",version:2,content:"Delayed stale edit"});
    await context.app.ingest({...base,eventKind:"message",version:1,content:"Delayed old message"});
    await context.app.ingest({...base,eventKind:"edit",version:4,content:"Must not undo recall"});
    await context.app.drain();
    const rows=await context.app.store.call("messages",{accountId:"mock-a",threadId:base.threadId});
    assert.equal(rows[0].recalled,true);assert.equal(rows[0].content,"");assert.equal(rows[0].eventKind,"recall");
    assert.equal((await context.app.health()).events,4);
    await assert.rejects(context.app.ingest(message("mock-b","mock-wrong-account"),"mock-a"),{code:"ACCOUNT_SCOPE"});
  } finally {await context.close();}
});

test("one database owner prevents duplicate account listeners; worker failures and clone errors fail closed",async()=>{
  const context=await setup();
  try {
    assert.throws(()=>new Store(join(context.dir,"gateway.db")),{code:"DATABASE_IN_USE"});
    await assert.rejects(context.app.store.call("stats",()=>{}),{code:"INVALID_STORAGE_INPUT"});
    assert.equal((await context.app.health()).mode,"mock");
    const other=new Store(join(context.dir,"early-exit.db"));
    const pending=other.call("stats");
    const rejected=assert.rejects(pending,/worker|Storage/i);
    await other.terminateForTest();
    await rejected;
    await other.close();
  } finally {await context.close();}
});
