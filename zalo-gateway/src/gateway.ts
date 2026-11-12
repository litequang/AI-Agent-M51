import { Store } from "./store.js";
import { GatewayError, type AccountView, type CanonicalEvent, type EventReceipt, type OutboxView } from "./contracts.js";
import { MockConnector } from "./connectors/mock.js";
import { makeFixtures } from "./fixtures.js";
import * as validate from "./validation.js";
import { normalizeMockWireFixture } from "./normalizer.js";

export interface GatewayOptions { databasePath:string; queueLimit?:number; autoDrain?:boolean; mode?:string }
export class Gateway {
  readonly store:Store;
  private connectors=new Map<string,MockConnector>();
  private drainPromise:Promise<void>|undefined;
  private drainRequested=false;
  private drainScheduled=false;
  private stopped=false;
  private aiRunning=false;
  private readonly autoDrain:boolean;
  constructor(options:GatewayOptions) {
    if((options.mode??"mock")!=="mock")throw new GatewayError("LIVE_GATE_CLOSED","Real connectors are not enabled in Phase 01",403);
    this.store=new Store(options.databasePath,128,options.queueLimit??512);
    this.autoDrain=options.autoDrain!==false;
  }
  async initialize() {
    const accounts=await this.store.call<AccountView[]>("recover");
    for(const account of accounts) {
      const connector=this.attach(account.id);
      const session=await this.store.call("session",{id:account.id});
      if(session && Date.parse(session.expires_at)>Date.now()) {
        connector.restoreSession();
        // Explicitly recorded startup gap; only mock metadata can be restored.
        if(account.state==="reconnecting" || account.state==="connected") {
          await connector.reconnect();
          await this.sync(account.id,"process_restart");
        }
      } else if(account.collectorStartedAt) {
        connector.expireSession();
        await this.sync(account.id,"session_expired");
      }
    }
    if(this.autoDrain)await this.drain();
  }
  private attach(id:string) {
    const connector=new MockConnector(id);
    connector.onEvent(async(input)=>this.ingest(input,id));
    this.connectors.set(id,connector);
    return connector;
  }
  connector(id:string) {
    const found=this.connectors.get(id);
    if(!found)throw new GatewayError("NOT_FOUND","Account not found",404);
    return found;
  }
  async createAccount(input:unknown) {
    const value=validate.object(input);
    validate.fields(value,["id","label"]);
    const account=await this.store.call<AccountView>("createAccount",{id:validate.accountId(value.id),label:validate.text(value.label,"label",80)});
    this.attach(account.id);
    return account;
  }
  async accounts() {
    const accounts=await this.store.call<AccountView[]>("accounts");
    const result:AccountView[]=[];
    for(const account of accounts) {
      const connector=this.connector(account.id),state=connector.getLoginState();
      if(account.state!==state.state)await this.sync(account.id,"qr_or_session_expired");
      const current=await this.store.call<AccountView>("account",{id:account.id});
      result.push({...current,...(state.qr?{qr:state.qr}:{})});
    }
    return result;
  }
  private async sync(id:string,reason:string) {
    return this.store.call<AccountView>("setState",{id,state:this.connector(id).getLoginState().state,reason});
  }
  async accountAction(id:string,action:string,input:unknown={}) {
    const connector=this.connector(id),body=validate.object(input);
    if(action==="login") {validate.fields(body,[]);await connector.beginLogin();}
    else if(action==="connect") {validate.fields(body,["challengeId"]);await connector.connect(validate.text(body.challengeId,"challengeId",100));}
    else if(action==="disconnect") {validate.fields(body,["reason"]);await connector.disconnect("network_loss");}
    else if(action==="reconnect") {validate.fields(body,[]);await connector.reconnect();}
    else if(action==="expire") {validate.fields(body,[]);connector.expireSession();}
    else throw new GatewayError("NOT_FOUND","Unknown account action",404);
    await this.sync(id,action==="disconnect"?"network_loss":action);
    return (await this.accounts()).find(account=>account.id===id)!;
  }
  async ingest(input:unknown,boundAccountId?:string):Promise<EventReceipt> {
    const normalized=validate.event(input);
    if(boundAccountId!==undefined && normalized.accountId!==boundAccountId)throw new GatewayError("ACCOUNT_SCOPE","Connector event does not belong to its bound account",403);
    const result=await this.store.call<EventReceipt>("ingest",normalized);
    // A receipt means SQLite WAL has durably committed. Projection is asynchronous.
    if(this.autoDrain)this.scheduleDrain();
    return result;
  }
  private scheduleDrain() {
    if(this.drainScheduled||this.stopped)return;
    this.drainScheduled=true;
    setImmediate(()=>{this.drainScheduled=false;void this.drain().catch(()=>{/* Journal remains pending for retry/restart. */});});
  }
  drain():Promise<void> {
    if(this.drainPromise){this.drainRequested=true;return this.drainPromise;}
    this.drainPromise=(async()=>{
      for(;;) {
        this.drainRequested=false;
        const result=await this.store.call<{processed:number}>("drain",{limit:32});
        if(result.processed<32&&!this.drainRequested)break;
        await new Promise<void>(resolve=>setImmediate(resolve));
      }
    })().finally(()=>{this.drainPromise=undefined;if(this.drainRequested&&!this.stopped)this.scheduleDrain();});
    return this.drainPromise;
  }
  async fixtures(id:string,input:unknown) {
    const body=validate.object(input);
    validate.fields(body,["scenario","count"]);
    if(!["standard","burst","duplicate"].includes(String(body.scenario)))throw new GatewayError("INVALID_FIXTURE","Unknown fixture scenario");
    const count=body.count===undefined?30:Number(body.count);
    if(!Number.isInteger(count)||count<1||count>100)throw new GatewayError("FIXTURE_LIMIT","Fixture burst count must be 1-100");
    const events=makeFixtures(id,body.scenario as "standard"|"burst"|"duplicate",Date.now(),count);
    let accepted=0,duplicates=0;
    for(const event of events) {
      const receipt=await this.connector(id).emit(normalizeMockWireFixture(event));
      if(receipt.duplicate)duplicates++;else accepted++;
    }
    await this.drain();
    return {accepted,duplicates,mock:true};
  }
  async createDraft(input:unknown) {return this.store.call<OutboxView>("createDraft",validate.draft(input));}
  async confirmSend(id:string,input:unknown) {
    const body=validate.object(input);
    validate.fields(body,["accountId","threadId","operatorConfirmed"]);
    const scope={id,accountId:validate.accountId(body.accountId),threadId:validate.id(body.threadId,"threadId"),operatorConfirmed:body.operatorConfirmed===true};
    const claim=await this.store.call<{claimed:boolean;item:OutboxView}>("claimSend",scope);
    if(!claim.claimed)return claim.item;
    try {
      const result=await this.connector(scope.accountId).sendManual(claim.item);
      return this.store.call<OutboxView>("finishSend",{id,state:result.state});
    } catch {
      return this.store.call<OutboxView>("finishSend",{id,state:"uncertain",error:"Delivery outcome unknown; do not retry automatically"});
    }
  }
  async createJob(input:unknown) {
    const body=validate.object(input);
    validate.fields(body,["accountId","threadId","kind"]);
    if(!["summary","draft"].includes(String(body.kind)))throw new GatewayError("INVALID_JOB","Unsupported job kind");
    return this.store.call("createJob",{accountId:validate.accountId(body.accountId),threadId:validate.id(body.threadId,"threadId"),kind:body.kind});
  }
  async runNextAiJob(provider:(job:{id:string;accountId:string;threadId:string;messages:CanonicalEvent[]})=>Promise<string>) {
    if(this.aiRunning)throw new GatewayError("AI_BUSY","Only one bounded AI job at a time",429);
    this.aiRunning=true;
    try {
      const job=await this.store.call("claimJob");
      if(!job)return false;
      try {const result=await provider(job);await this.store.call("finishJob",{id:job.id,result});}
      catch {await this.store.call("finishJob",{id:job.id,result:"AI job failed; no send was attempted",failed:true});}
      return true;
    } finally {this.aiRunning=false;}
  }
  async health() {
    return {mock:true,mode:"mock",livePilot:"SKIP",realLogin:false,realSend:false,autoReply:false,aiExecutionEnabled:false,...await this.store.call("stats")};
  }
  async close() {
    this.stopped=true;
    // Stop callbacks first; active durable writes are allowed to finish.
    for(const connector of this.connectors.values())await connector.disconnect("shutdown");
    await this.drain();
    await this.store.close();
  }
}
