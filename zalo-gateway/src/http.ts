import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Gateway } from "./gateway.js";
import { GatewayError, type AccountView } from "./contracts.js";
import { safeEqual } from "./vendor/session-compare.js";
import * as validate from "./validation.js";

export interface Principal { token:string; accountIds:string[]|null }
export interface HttpOptions { principals:Principal[]; allowedHosts?:string[]; webRoot?:string }
function reply(response:ServerResponse,status:number,body:unknown) {
  const data=Buffer.from(JSON.stringify(body));
  response.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Content-Length":data.length});
  response.end(data);
}
function readBody(request:IncomingMessage):Promise<Record<string,unknown>> {
  if(request.headers["content-type"]?.split(";")[0]!=="application/json")throw new GatewayError("CONTENT_TYPE","Expected application/json",415);
  const declared=request.headers["content-length"];
  if(declared && (!/^\d+$/.test(declared)||Number(declared)>32768))throw new GatewayError("BODY_LIMIT","Request exceeds 32 KiB",413);
  return new Promise((resolve,reject)=>{
    let size=0,over=false;
    const chunks:Buffer[]=[];
    request.on("data",(chunk:Buffer)=>{
      size+=chunk.length;
      if(size>32768) {if(!over){over=true;reject(new GatewayError("BODY_LIMIT","Request exceeds 32 KiB",413));}return;}
      chunks.push(chunk);
    });
    request.on("end",()=>{
      if(over)return;
      try {resolve(validate.object(JSON.parse(Buffer.concat(chunks).toString("utf8"))));}
      catch {reject(new GatewayError("INVALID_JSON","Malformed JSON object"));}
    });
    request.on("error",()=>reject(new GatewayError("REQUEST_ABORTED","Request interrupted",400)));
  });
}
export function createGatewayServer(gateway:Gateway,options:HttpOptions) {
  if(!options.principals.length||options.principals.some(item=>item.token.length<32||item.token.length>256))throw new Error("Configure a separate gateway operator token of 32-256 characters");
  const webRoot=options.webRoot??fileURLToPath(new URL("../../web/",import.meta.url));
  const server=createServer((request,response)=>{
    response.setHeader("Cache-Control","no-store");
    response.setHeader("X-Content-Type-Options","nosniff");
    response.setHeader("Referrer-Policy","no-referrer");
    response.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    void (async()=>{
      const remote=request.socket.remoteAddress??"";
      if(!["127.0.0.1","::ffff:127.0.0.1","::1"].includes(remote))throw new GatewayError("LOOPBACK_ONLY","Gateway accepts loopback connections only",403);
      const host=request.headers.host??"";
      const port=request.socket.localPort;
      const allowed=["127.0.0.1:"+port,"localhost:"+port,...(options.allowedHosts??[])];
      if(!allowed.includes(host))throw new GatewayError("HOST_REJECTED","Unrecognized host",403);
      const url=new URL(request.url??"/","http://"+host);
      if(request.method==="GET" && ["/","/app.js","/style.css"].includes(url.pathname)) {
        const asset=url.pathname==="/"?"index.html":url.pathname.slice(1);
        const data=await readFile(join(webRoot,asset));
        response.writeHead(200,{"Content-Type":asset.endsWith(".html")?"text/html; charset=utf-8":asset.endsWith(".js")?"text/javascript; charset=utf-8":"text/css; charset=utf-8","Content-Length":data.length});
        response.end(data);return;
      }
      if(!url.pathname.startsWith("/api/"))throw new GatewayError("NOT_FOUND","Route not found",404);
      const header=request.headers.authorization??"";
      const token=header.startsWith("Bearer ")?header.slice(7):"";
      const principal=options.principals.find(item=>safeEqual(item.token,token));
      if(!principal)throw new GatewayError("AUTH_REQUIRED","Operator authentication required",401);
      const origin=request.headers.origin;
      if(origin && origin!=="http://"+host)throw new GatewayError("ORIGIN_REJECTED","Cross-origin request rejected",403);
      const scope=(input:unknown)=>{
        const id=validate.accountId(input);
        if(principal.accountIds!==null&&!principal.accountIds.includes(id))throw new GatewayError("ACCOUNT_SCOPE","Account not authorized",403);
        return id;
      };
      const scopedIds=async(query:string|null)=>{
        if(query)return [scope(query)];
        const accounts=await gateway.accounts();
        return accounts.filter(a=>principal.accountIds===null||principal.accountIds.includes(a.id)).map(a=>a.id);
      };
      if(request.method==="GET") {
        if(url.pathname==="/api/health") {
          const health=await gateway.health();
          reply(response,200,principal.accountIds===null?health:{mock:true,mode:"mock",livePilot:"SKIP",realSend:false,accounts:(await scopedIds(null)).length,queue:{pending:null,limit:512}});return;
        }
        if(url.pathname==="/api/accounts") {
          reply(response,200,{accounts:(await gateway.accounts()).filter(a=>principal.accountIds===null||principal.accountIds.includes(a.id))});return;
        }
        if(url.pathname==="/api/inbox") {reply(response,200,{threads:await gateway.store.call("inbox",{accountIds:await scopedIds(url.searchParams.get("accountId"))})});return;}
        if(url.pathname==="/api/messages") {
          const accountId=scope(url.searchParams.get("accountId")),threadId=validate.id(url.searchParams.get("threadId"),"threadId");
          reply(response,200,{messages:await gateway.store.call("messages",{accountId,threadId})});return;
        }
        if(url.pathname==="/api/gaps") {reply(response,200,{gaps:await gateway.store.call("gaps",{accountIds:await scopedIds(url.searchParams.get("accountId"))})});return;}
        if(url.pathname==="/api/outbox") {reply(response,200,{outbox:await gateway.store.call("listOutbox",{accountIds:await scopedIds(url.searchParams.get("accountId"))})});return;}
      } else if(request.method==="POST") {
        const body=await readBody(request);
        if(url.pathname==="/api/accounts") {
          if(principal.accountIds!==null)throw new GatewayError("ADMIN_REQUIRED","Only the operator admin can add synthetic accounts",403);
          reply(response,201,{account:await gateway.createAccount(body)});return;
        }
        const accountRoute=url.pathname.match(/^\/api\/accounts\/([^/]+)\/([a-z]+)$/);
        if(accountRoute) {
          const id=scope(decodeURIComponent(accountRoute[1]!)),action=accountRoute[2]!;
          if(action==="fixtures")reply(response,200,await gateway.fixtures(id,body));
          else reply(response,200,{account:await gateway.accountAction(id,action,body)});
          return;
        }
        if(url.pathname==="/api/outbox") {scope(body.accountId);reply(response,201,{item:await gateway.createDraft(body)});return;}
        const confirmation=url.pathname.match(/^\/api\/outbox\/([^/]+)\/confirm$/);
        if(confirmation) {
          scope(body.accountId);
          const id=validate.id(confirmation[1],"outboxId");
          const item=await gateway.store.call("outbox",{id});
          scope(item.accountId);
          reply(response,200,{item:await gateway.confirmSend(id,body)});return;
        }
        if(url.pathname==="/api/jobs") {scope(body.accountId);reply(response,202,{job:await gateway.createJob(body)});return;}
      }
      throw new GatewayError("NOT_FOUND","Route not found",404);
    })().catch((error:unknown)=>{
      if(response.headersSent){response.end();return;}
      const e=error instanceof GatewayError?error:new GatewayError("INTERNAL_ERROR","Gateway operation failed",500);
      reply(response,e.status,{error:{code:e.code,message:e.message}});
    });
  });
  // Reject non-loopback bind even if a future caller passes another address.
  const listen=server.listen.bind(server);
  server.listen=((...args:any[])=>{
    const first=args[0];
    const host=typeof first==="object"&&first!==null?first.host:args[1];
    if(host!=="127.0.0.1")throw new GatewayError("LOOPBACK_ONLY","Bind explicitly to 127.0.0.1",403);
    return (listen as (...items:any[])=>typeof server)(...args);
  }) as typeof server.listen;
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;
  return server;
}
