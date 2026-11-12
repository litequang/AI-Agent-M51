import { Worker } from "node:worker_threads";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { GatewayError } from "./contracts.js";

export class Store {
  private worker:Worker;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>();
  private serial=0;
  private stopped=false;
  private ready:Promise<void>;
  private lockPath:string;
  private lockOwner=randomUUID();
  constructor(path:string,private maxPending=128,queueLimit=512,private operationTimeoutMs=15000) {
    this.lockPath=path+".owner.lock";
    mkdirSync(dirname(path),{recursive:true,mode:0o700});
    if(existsSync(this.lockPath)) {
      if(lstatSync(this.lockPath).isSymbolicLink())throw new GatewayError("LOCK_INVALID","Database lock symlink rejected",503);
      const lock=JSON.parse(readFileSync(this.lockPath,"utf8")) as {pid:number};
      if(!Number.isSafeInteger(lock.pid)||lock.pid<1)throw new GatewayError("LOCK_INVALID","Invalid database ownership file",503);
      let alive=true;
      try {process.kill(lock.pid,0);} catch(error) {if((error as NodeJS.ErrnoException).code==="ESRCH")alive=false;else throw error;}
      if(alive)throw new GatewayError("DATABASE_IN_USE","Another gateway owns this database; do not start a second listener",409);
      unlinkSync(this.lockPath);
    }
    const descriptor=openSync(this.lockPath,"wx",0o600);
    writeFileSync(descriptor,JSON.stringify({pid:process.pid,owner:this.lockOwner}));
    closeSync(descriptor);
    try {this.worker=new Worker(new URL("./store-worker.js",import.meta.url),{workerData:{path,queueLimit}});}
    catch(error) {this.releaseLock();throw error;}
    this.ready=new Promise((resolve,reject)=>{
      let ready=false;
      const timer=setTimeout(()=>{const error=new GatewayError("STORE_START_TIMEOUT","Storage worker startup timed out",503);reject(error);this.abort(error);void this.worker.terminate();},10000);
      this.worker.on("message",(message)=>{
        if(message.ready) {ready=true;clearTimeout(timer);resolve();return;}
        const task=this.pending.get(message.id);
        if(!task)return;
        clearTimeout(task.timer);this.pending.delete(message.id);
        if(message.error)task.reject(new GatewayError(message.error.code,message.error.message,message.error.status));
        else task.resolve(message.result);
      });
      this.worker.on("error",()=>{
        clearTimeout(timer);
        const error=new GatewayError("STORE_FAILURE","Storage worker failed",503);
        if(!ready)reject(error);
        this.abort(error);
      });
      this.worker.on("exit",()=>{
        clearTimeout(timer);
        const error=new GatewayError("STORE_EXITED","Storage worker exited",503);
        if(!ready)reject(error);
        if(!this.stopped)this.abort(error);
        this.releaseLock();
      });
    });
    void this.ready.catch(()=>{});
  }
  private releaseLock() {
    if(!existsSync(this.lockPath))return;
    try {
      const stored=JSON.parse(readFileSync(this.lockPath,"utf8")) as {owner:string};
      if(stored.owner===this.lockOwner)unlinkSync(this.lockPath);
    } catch {/* Unknown ownership is never removed. */}
  }
  private abort(error:Error) {
    this.stopped=true;
    for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(error);}
    this.pending.clear();
  }
  async call<T=any>(operation:string,input:unknown={}):Promise<T> {
    await this.ready;
    if(this.stopped)throw new GatewayError("STORE_CLOSED","Storage unavailable",503);
    if(this.pending.size>=this.maxPending)throw new GatewayError("BACKPRESSURE","Storage mailbox full; retry without acknowledging",429);
    const id=++this.serial;
    return new Promise<T>((resolve,reject)=>{
      const timer=setTimeout(()=>{
        const error=new GatewayError("STORE_TIMEOUT","Storage operation timed out; outcome unknown, retry idempotently",503);
        this.abort(error);void this.worker.terminate();
      },this.operationTimeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try {this.worker.postMessage({id,operation,input});}
      catch {clearTimeout(timer);this.pending.delete(id);reject(new GatewayError("INVALID_STORAGE_INPUT","Storage input cannot be cloned"));}
    });
  }
  async close() {
    if(this.stopped){await this.worker.terminate();this.releaseLock();return;}
    await this.call("close");
    this.stopped=true;
    await this.worker.terminate();
    this.releaseLock();
  }
  async terminateForTest(){await this.worker.terminate();}
}
