import assert from "node:assert/strict";
import { test } from "node:test";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { createGatewayServer } from "../src/http.js";
import { setup } from "./helpers.js";

const ADMIN="mock-test-admin-token-not-a-real-credential-001";
const SCOPED="mock-test-scoped-token-not-a-real-credential-002";
async function start() {
  const context=await setup();
  const server=createGatewayServer(context.app,{principals:[{token:ADMIN,accountIds:null},{token:SCOPED,accountIds:["mock-a"]}]});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url="http://127.0.0.1:"+(server.address() as AddressInfo).port;
  const call=async(path:string,body?:unknown,token=ADMIN,extra:Record<string,string>={})=>{
    const response=await fetch(url+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json() as any};
  };
  return {...context,server,url,call,close:async()=>{
    server.closeIdleConnections();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await context.close();
  }};
}

test("synthetic HTTP E2E: three simulated QR accounts, inbox, gaps, draft/confirm and restart-safe API",async()=>{
  const c=await start();
  try {
    assert.equal((await c.call("/api/health")).body.realSend,false);
    for(const id of ["mock-a","mock-b","mock-c"]) {
      const created=await c.call("/api/accounts",{id,label:"Giả lập "+id});assert.equal(created.status,201);
      const login=await c.call("/api/accounts/"+id+"/login",{});
      assert.equal(login.body.account.qr.label,"SIMULATED");
      const connected=await c.call("/api/accounts/"+id+"/connect",{challengeId:login.body.account.qr.challengeId});
      assert.equal(connected.body.account.state,"connected");
      const fixtures=await c.call("/api/accounts/"+id+"/fixtures",{scenario:"standard"});
      assert.equal(fixtures.status,200);assert.ok(fixtures.body.accepted>=5);
    }
    const threads=(await c.call("/api/inbox")).body.threads;
    assert.equal(new Set(threads.map((item:any)=>item.accountId)).size,3);
    assert.ok(threads.some((item:any)=>item.muted));assert.ok(threads.some((item:any)=>item.threadType==="group"));
    const selected=threads.find((item:any)=>item.accountId==="mock-a");
    const messages=(await c.call("/api/messages?accountId=mock-a&threadId="+encodeURIComponent(selected.threadId))).body.messages;
    assert.ok(messages.length>0);assert.ok(messages.every((item:any)=>item.accountId==="mock-a"));
    const draft=await c.call("/api/outbox",{accountId:"mock-a",threadId:selected.threadId,text:"Gửi giả lập đã xác nhận",intentId:"mock-e2e-manual-intent"});
    assert.equal(draft.body.item.state,"draft");
    const blocked=await c.call("/api/outbox/"+draft.body.item.id+"/confirm",{accountId:"mock-a",threadId:selected.threadId,operatorConfirmed:false});
    assert.equal(blocked.status,403);
    const sent=await c.call("/api/outbox/"+draft.body.item.id+"/confirm",{accountId:"mock-a",threadId:selected.threadId,operatorConfirmed:true});
    assert.equal(sent.body.item.state,"sent_ack");assert.equal(sent.body.item.mock,true);
    await c.call("/api/accounts/mock-a/disconnect",{reason:"network_loss"});
    assert.equal((await c.call("/api/gaps?accountId=mock-a")).body.gaps[0].coverage,"unknown");
    await c.call("/api/accounts/mock-a/reconnect",{});
    assert.ok((await c.call("/api/gaps?accountId=mock-a")).body.gaps[0].endedAt);
    const expired=await c.call("/api/accounts/mock-a/expire",{});
    assert.equal(expired.body.account.state,"needs_relogin");
  } finally {await c.close();}
});

test("Bearer authentication, origin/host allowlist and account-scoped read/write restrictions",async()=>{
  const c=await start();
  try {
    assert.equal((await c.call("/api/accounts",undefined,"")).status,401);
    for(const id of ["mock-a","mock-b"]) {
      await c.call("/api/accounts",{id,label:"Synthetic"});
      const login=await c.call("/api/accounts/"+id+"/login",{});
      await c.call("/api/accounts/"+id+"/connect",{challengeId:login.body.account.qr.challengeId});
      await c.call("/api/accounts/"+id+"/fixtures",{scenario:"standard"});
    }
    const restricted=await c.call("/api/accounts",undefined,SCOPED);
    assert.deepEqual(restricted.body.accounts.map((a:any)=>a.id),["mock-a"]);
    for(const route of ["/api/inbox?accountId=mock-b","/api/messages?accountId=mock-b&threadId=mock-thread-shared","/api/gaps?accountId=mock-b","/api/outbox?accountId=mock-b"])
      assert.equal((await c.call(route,undefined,SCOPED)).status,403);
    assert.equal((await c.call("/api/accounts/mock-b/disconnect",{},SCOPED)).status,403);
    assert.equal((await c.call("/api/outbox",{accountId:"mock-b",threadId:"mock-thread-shared",text:"Forbidden",intentId:"mock-no"},SCOPED)).status,403);
    assert.equal((await c.call("/api/accounts",{id:"mock-c",label:"Forbidden"},SCOPED)).status,403);
    assert.equal((await c.call("/api/accounts/mock-a/disconnect",{},ADMIN,{Origin:"https://untrusted.invalid"})).status,403);
    const hostStatus=await new Promise<number>((resolve,reject)=>{
      const req=httpRequest(c.url+"/api/health",{headers:{Host:"untrusted.invalid",Authorization:"Bearer "+ADMIN}},res=>{res.resume();resolve(res.statusCode!);});
      req.on("error",reject);req.end();
    });
    assert.equal(hostStatus,403);
    assert.throws(()=>c.server.listen(0,"0.0.0.0"),/127\.0\.0\.1/);
  } finally {await c.close();}
});

test("browser assets contain no operator token; unsafe routes/payloads are rejected",async()=>{
  const c=await start();
  try {
    for(const path of ["/","/app.js","/style.css"]) {
      const response=await fetch(c.url+path),body=await response.text();
      assert.equal(response.status,200);
      assert.ok(!body.includes(ADMIN)&&!body.includes(SCOPED));
      assert.match(response.headers.get("content-security-policy")!,/default-src 'self'/);
      if(path==="/app.js")assert.ok(!body.includes("innerHTML"),"No untrusted HTML sinks");
    }
    assert.equal((await fetch(c.url+"/var/operator.key")).status,404);
    assert.equal((await c.call("/api/accounts",{id:"mock-a",label:"Synthetic",connector:"zca-js",real:true})).status,400);
    assert.equal((await c.call("/api/live/login",{})).status,404);
    assert.equal((await c.call("/api/accounts",{id:"mock-a",label:"x".repeat(40000)})).status,413);
    const malformed=await fetch(c.url+"/api/accounts",{method:"POST",headers:{Authorization:"Bearer "+ADMIN,"Content-Type":"application/json"},body:"{"});
    assert.equal(malformed.status,400);
  } finally {await c.close();}
});
