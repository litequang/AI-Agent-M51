import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Gateway, type GatewayOptions } from "../src/gateway.js";
import type { CanonicalEvent } from "../src/contracts.js";

export async function setup(options:Partial<GatewayOptions>={}) {
  const dir=await mkdtemp(join(tmpdir(),"m51-gateway-test-"));
  const app=new Gateway({databasePath:join(dir,"gateway.db"),...options});
  await app.initialize();
  return {app,dir,close:async()=>{try{await app.close();}catch(error){if((error as {code?:string}).code!=="STORE_CLOSED")throw error;}finally{await rm(dir,{recursive:true,force:true});}}};
}
export async function connect(app:Gateway,id="mock-a") {
  await app.createAccount({id,label:"Synthetic "+id});
  const state=await app.accountAction(id,"login");
  await app.accountAction(id,"connect",{challengeId:state.qr!.challengeId});
}
export function message(accountId="mock-a",sourceMessageId="mock-message-1",threadId="mock-thread-shared",version=1):CanonicalEvent {
  const stamp=new Date().toISOString();
  return {accountId,threadId,threadType:"dm",sourceMessageId,senderId:"mock-peer",direction:"inbound",
    sourceTimestamp:stamp,receivedAt:stamp,eventKind:"message",version,contentType:"text",content:"Hội thoại giả lập",
    sourceRef:"mock://fixture/"+sourceMessageId,traceId:"mock-trace-"+sourceMessageId,threadLabel:"Hội thoại giả lập",muted:false};
}
