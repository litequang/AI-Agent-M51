import { readFile, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
const root=resolve(process.env.GATEWAY_DATA_DIR??"var");
const action=process.argv[2];
if(action==="health") {
  const token=await readFile(resolve(process.env.GATEWAY_TOKEN_FILE??join(root,"operator.key")),"utf8");
  const port=Number(process.env.GATEWAY_PORT??"8790");
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid port");
  const response=await fetch("http://127.0.0.1:"+port+"/api/health",{headers:{Authorization:"Bearer "+token.trim()},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error("Gateway health failed: HTTP "+response.status);
  console.log(JSON.stringify(await response.json(),null,2));
} else if(action==="stop") {
  if(process.platform!=="android"&&process.platform!=="linux")throw Error("Termux stop helper requires /proc; use Ctrl+C on Windows");
  const lock=JSON.parse(await readFile(join(root,"gateway.db.owner.lock"),"utf8")) as {pid:number};
  if(!Number.isSafeInteger(lock.pid)||lock.pid<2)throw Error("Invalid owner PID");
  const command=(await readFile("/proc/"+lock.pid+"/cmdline","utf8")).split("\0").filter(Boolean);
  const cwd=await realpath("/proc/"+lock.pid+"/cwd");
  const target=command.find(item=>item.endsWith("/dist/src/main.js")||item==="dist/src/main.js");
  if(!target||resolve(cwd,target)!==resolve("dist/src/main.js")||cwd!==process.cwd())throw Error("Owner is not this gateway main process; refusing to signal");
  process.kill(lock.pid,"SIGTERM");
  console.log("Sent SIGTERM to the verified gateway only.");
} else throw Error("Use health or stop");
