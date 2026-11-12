import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { Gateway } from "../src/gateway.js";
import type { CanonicalEvent } from "../src/contracts.js";

const directory=await mkdtemp(join(tmpdir(),"m51-gateway-budget-"));
const app=new Gateway({databasePath:join(directory,"gateway.db")});
const delay=monitorEventLoopDelay({resolution:10});
const result:Record<string,unknown>={status:"FAIL",node:process.version,platform:process.platform,arch:process.arch,mode:"mock",realLogin:false,realSend:false,persistentServiceEnabled:false,aiInferenceInvoked:false};
try {
  await app.initialize();delay.enable();
  for(const id of ["mock-a","mock-b","mock-c"]) {
    await app.createAccount({id,label:"Synthetic resource account"});
    const pending=await app.accountAction(id,"login");
    await app.accountAction(id,"connect",{challengeId:pending.qr!.challengeId});
  }
  const started=performance.now(),cpu=process.cpuUsage();
  const latencies:number[]=[];
  for(let index=0;index<600;index++) {
    const stamp=new Date().toISOString(),accountId=["mock-a","mock-b","mock-c"][index%3]!;
    const input:CanonicalEvent={accountId,threadId:"mock-resource-thread",threadType:"group",sourceMessageId:"mock-resource-"+index,senderId:"mock-resource-peer",direction:index%5===0?"self":"inbound",sourceTimestamp:stamp,receivedAt:stamp,eventKind:"message",version:1,contentType:"text",content:"Tin nhắn giả lập để đo tài nguyên "+index,sourceRef:"mock://resource/"+index,traceId:"mock-resource-trace-"+index,threadLabel:"Nhóm giả lập",muted:index%2===0};
    const t=performance.now();await app.ingest(input);latencies.push(performance.now()-t);
  }
  await app.drain();
  const elapsed=performance.now()-started,used=process.cpuUsage(cpu),stats=await app.health();
  latencies.sort((a,b)=>a-b);
  const rssMiB=process.memoryUsage().rss/1024**2;
  const idleStart=performance.now(),idleCpu=process.cpuUsage();
  await new Promise(resolve=>setTimeout(resolve,1000));
  const idleUsage=process.cpuUsage(idleCpu);
  const idleCpuPercent=(idleUsage.user+idleUsage.system)/1000/(performance.now()-idleStart)*100;
  let bytes=0;
  for(const name of await readdir(directory))bytes+=(await stat(join(directory,name))).size;
  result.measurements={events:stats.events,messages:stats.messages,durationMs:elapsed,eventsPerSecond:600/elapsed*1000,ingestP95Ms:latencies[Math.floor(latencies.length*0.95)],mainEventLoopP99Ms:delay.percentile(99)/1e6,rssMiB,cpuMilliseconds:(used.user+used.system)/1000,idleCpuPercentOneCore:idleCpuPercent,databaseAndWalBytes:bytes,threeAccounts:true};
  result.budgets={rssMiB:192,mainEventLoopP99Ms:250,ingestP95Ms:500,persistentService:"disabled",samples:"600 synthetic events plus 1 second idle; not endurance"};
  result.status=stats.messages===600&&stats.events===600&&rssMiB<192&&delay.percentile(99)/1e6<250&&latencies[Math.floor(latencies.length*.95)]!<500?"PASS":"FAIL";
} catch(error) {result.error=error instanceof Error?error.message:"Resource check failed";}
finally {delay.disable();await app.close();await rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify(result,null,2));
if(result.status!=="PASS")process.exitCode=1;
