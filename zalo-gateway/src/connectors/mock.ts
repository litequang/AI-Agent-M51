// Mock lifecycle/receipt scaffold drafted by Luna Medium; integrated and hardened
// against the shared contract (single listener, bounded mailbox, explicit expiry).
import { randomUUID } from "node:crypto";
import { GatewayError, type AccountState, type CanonicalEvent, type Connector, type ConnectorCapabilities, type EventReceipt, type LoginState, type ManualSendInput, type MockQr, type MockSendOutcome, type SendReceipt } from "../contracts.js";

export class MockConnector implements Connector {
  readonly accountId:string;
  private state:AccountState="disconnected";
  private qr:MockQr|undefined;
  private hasSession=false;
  private handler:((event:CanonicalEvent)=>Promise<EventReceipt>)|undefined;
  private pending=0;
  private outcome:MockSendOutcome="sent_ack";
  private sends=new Map<string,{fingerprint:string;receipt:SendReceipt}>();
  private readonly now:()=>number;
  private readonly qrTtlMs:number;
  private readonly maxPending:number;
  constructor(accountId:string,options:{now?:()=>number;qrTtlMs?:number;maxPending?:number}={}) {
    if(!/^mock-[a-z0-9-]{1,32}$/.test(accountId))throw new GatewayError("MOCK_ONLY","Only synthetic account IDs are accepted",403);
    this.accountId=accountId;this.now=options.now??Date.now;this.qrTtlMs=options.qrTtlMs??60000;this.maxPending=options.maxPending??64;
    if(!Number.isSafeInteger(this.qrTtlMs)||this.qrTtlMs<1||!Number.isSafeInteger(this.maxPending)||this.maxPending<1)throw new GatewayError("INVALID_LIMIT","Invalid mock limit");
  }
  capabilities():ConnectorCapabilities {
    return {mock:true,realLogin:false,realSend:false,historyBackfill:false,newMessages:true,dm:true,groups:true,selfMessages:true,mutedGroups:"fixture-only-not-verified"};
  }
  async beginLogin():Promise<LoginState> {
    if(["connected","authenticating","reconnecting"].includes(this.state))throw new GatewayError("INVALID_TRANSITION","Disconnect or expire the active session first",409);
    this.hasSession=false;this.state="qr_pending";
    this.qr={label:"SIMULATED",challengeId:randomUUID(),expiresAt:new Date(this.now()+this.qrTtlMs).toISOString()};
    return this.getLoginState();
  }
  getLoginState():LoginState {
    if(this.qr && this.now()>=Date.parse(this.qr.expiresAt)){this.qr=undefined;this.state="needs_relogin";this.hasSession=false;}
    return {accountId:this.accountId,state:this.state,mock:true,...(this.qr?{qr:{...this.qr}}:{})};
  }
  async connect(challengeId:string):Promise<LoginState> {
    this.getLoginState();
    if(this.state!=="qr_pending"||!this.qr)throw new GatewayError("QR_EXPIRED","No active simulated login challenge",409);
    if(challengeId!==this.qr.challengeId)throw new GatewayError("CHALLENGE_MISMATCH","Challenge does not match this account",403);
    this.state="authenticating";this.hasSession=true;this.qr=undefined;
    this.state="connected";return this.getLoginState();
  }
  async disconnect(reason="manual"):Promise<LoginState> {
    this.qr=undefined;
    if(reason==="network_loss"&&this.hasSession)this.state="reconnecting";
    else {this.state="disconnected";this.hasSession=false;}
    return this.getLoginState();
  }
  async reconnect():Promise<LoginState> {
    if(!this.hasSession||!["reconnecting","degraded"].includes(this.state))throw new GatewayError("NEEDS_RELOGIN","No active mock session to reconnect",409);
    this.state="connected";return this.getLoginState();
  }
  restoreSession() {this.hasSession=true;this.state="reconnecting";}
  expireSession() {this.hasSession=false;this.qr=undefined;this.state="needs_relogin";return this.getLoginState();}
  onEvent(handler:(event:CanonicalEvent)=>Promise<EventReceipt>) {
    if(this.handler)throw new GatewayError("LISTENER_EXISTS","One listener per account is allowed",409);
    this.handler=handler;
    return ()=>{if(this.handler===handler)this.handler=undefined;};
  }
  async emit(event:CanonicalEvent):Promise<EventReceipt> {
    if(event.accountId!==this.accountId)throw new GatewayError("ACCOUNT_SCOPE","Event belongs to a different account",403);
    if(this.getLoginState().state!=="connected")throw new GatewayError("NOT_CONNECTED","Mock account is not connected",409);
    if(!this.handler)throw new GatewayError("NO_LISTENER","No collector is active",409);
    if(this.pending>=this.maxPending)throw new GatewayError("BACKPRESSURE","Connector mailbox is full; event not acknowledged",429);
    this.pending++;
    try {
      const receipt=await this.handler({...event});
      if(receipt.persisted!==true)throw new GatewayError("NOT_DURABLE","Collector did not provide a durable receipt",503);
      return {...receipt};
    } finally {this.pending--;}
  }
  setSendOutcome(outcome:MockSendOutcome) {this.outcome=outcome;}
  async sendManual(input:ManualSendInput):Promise<SendReceipt> {
    if(input.accountId!==this.accountId)throw new GatewayError("ACCOUNT_SCOPE","Wrong send account",403);
    if(this.state!=="connected")throw new GatewayError("NOT_CONNECTED","Mock session is not connected",409);
    const fingerprint=JSON.stringify([input.accountId,input.threadId,input.text,input.quoteSourceMessageId??null]);
    const previous=this.sends.get(input.intentId);
    if(previous){if(previous.fingerprint!==fingerprint)throw new GatewayError("INTENT_CONFLICT","Intent content changed",409);return {...previous.receipt};}
    if(this.sends.size>=1000)throw new GatewayError("SEND_LIMIT","Mock receipt cap reached",429);
    const receipt:SendReceipt={state:this.outcome,mock:true,...(this.outcome==="sent_ack"?{sourceMessageId:"mock-sent-"+randomUUID()}:{})};
    this.sends.set(input.intentId,{fingerprint,receipt});
    return {...receipt};
  }
  getHealth(){return {accountId:this.accountId,state:this.getLoginState().state,mock:true as const,listenerCount:this.handler?1:0};}
}
