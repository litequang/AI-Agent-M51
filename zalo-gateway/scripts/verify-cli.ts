import assert from "node:assert/strict";
import { mkdtemp,rm,readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn,execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
const exec=promisify(execFile),cwd=fileURLToPath(new URL("../..",import.meta.url));
const dir=await mkdtemp(join(tmpdir(),"m51-cli-check-"));
const probe=createServer();await new Promise<void>(r=>probe.listen(0,"127.0.0.1",r));
const port=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
const env={...process.env,GATEWAY_MODE:"mock",GATEWAY_PORT:String(port),GATEWAY_DATA_DIR:dir,GATEWAY_TOKEN_FILE:join(dir,"operator.key")};
let child:ReturnType<typeof spawn>|undefined;
try {
  const init=await exec(process.execPath,["dist/src/main.js","--init-token"],{cwd,env,timeout:10000});
  const token=await readFile(join(dir,"operator.key"),"utf8");
  assert.ok(!init.stdout.includes(token.trim()));assert.ok(token.trim().length>=32);
  await exec(process.execPath,["dist/src/main.js","--init-token"],{cwd,env,timeout:10000});
  assert.equal(await readFile(join(dir,"operator.key"),"utf8"),token);
  child=spawn(process.execPath,["dist/src/main.js"],{cwd,env,stdio:["ignore","pipe","pipe"]});
  const closed=new Promise<void>(resolve=>child!.once("exit",()=>resolve()));
  await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("CLI readiness timeout")),10000);
    child!.once("error",e=>{clearTimeout(timer);reject(e);});
    child!.once("exit",()=>{clearTimeout(timer);reject(Error("CLI exited before readiness"));});
    child!.stdout!.once("data",data=>{clearTimeout(timer);const ready=JSON.parse(String(data));assert.equal(ready.realSend,false);resolve();});
  });
  const health=await exec(process.execPath,["dist/scripts/operator.js","health"],{cwd,env,timeout:10000});
  assert.equal(JSON.parse(health.stdout).mode,"mock");assert.ok(!health.stdout.includes(token.trim()));
  if(process.platform==="android"||process.platform==="linux")await exec(process.execPath,["dist/scripts/operator.js","stop"],{cwd,env,timeout:10000});
  else child.kill("SIGTERM");
  await Promise.race([closed,new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(Error("CLI stop timeout")),10000);timer.unref();})]);
  console.log(JSON.stringify({status:"PASS",mode:"mock",tokenInitializationIdempotent:true,authenticatedHealth:true,tokenNotPrinted:true,verifiedStopHelper:process.platform==="android"||process.platform==="linux",windowsStoppedOwnChild:process.platform==="win32",persistentServiceEnabled:false}));
} finally {if(child&&child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");await rm(dir,{recursive:true,force:true});}
