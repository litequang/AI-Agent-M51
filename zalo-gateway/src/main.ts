import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Gateway } from "./gateway.js";
import { createGatewayServer } from "./http.js";

process.umask(0o077);
const dataDir=resolve(process.env.GATEWAY_DATA_DIR??"var");
const tokenFile=resolve(process.env.GATEWAY_TOKEN_FILE??resolve(dataDir,"operator.key"));
if(process.argv.includes("--init-token")) {
  mkdirSync(dirname(tokenFile),{recursive:true,mode:0o700});
  if(!existsSync(tokenFile))writeFileSync(tokenFile,randomBytes(32).toString("base64url")+"\n",{mode:0o600,flag:"wx"});
  console.log("Gateway operator token file initialized; value is not printed.");
  process.exit(0);
}
if(!existsSync(tokenFile)||lstatSync(tokenFile).isSymbolicLink())throw new Error("Create a separate operator token file with --init-token");
chmodSync(tokenFile,0o600);
const mode=process.env.GATEWAY_MODE??"mock";
const port=Number(process.env.GATEWAY_PORT??"8790");
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("Invalid gateway port");
const gateway=new Gateway({databasePath:resolve(dataDir,"gateway.db"),mode});
await gateway.initialize();
const server=createGatewayServer(gateway,{principals:[{token:readFileSync(tokenFile,"utf8").trim(),accountIds:null}]});
server.on("error",()=>{console.error("Gateway listener failed; no network configuration was changed.");void gateway.close().finally(()=>{process.exitCode=1;});});
server.listen(port,"127.0.0.1",()=>console.log(JSON.stringify({service:"zalo-gateway",mode:"mock",port,realLogin:false,realSend:false})));
let stopping=false;
const stop=async()=>{
  if(stopping)return;
  stopping=true;
  server.close();
  server.closeIdleConnections();
  await new Promise<void>(resolve=>server.once("close",()=>resolve()));
  await gateway.close();
};
process.on("SIGTERM",()=>void stop().catch(()=>process.exitCode=1));
process.on("SIGINT",()=>void stop().catch(()=>process.exitCode=1));
