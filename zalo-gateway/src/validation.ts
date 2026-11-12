import { GatewayError, type CanonicalEvent, type ManualSendInput } from "./contracts.js";

export function object(value: unknown): Record<string,unknown> {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new GatewayError("INVALID_BODY","Expected an object");
  return value as Record<string,unknown>;
}
export function fields(value:Record<string,unknown>, allowed:string[]) {
  if(Object.keys(value).some(key=>!allowed.includes(key))) throw new GatewayError("UNKNOWN_FIELD","Unsupported request field");
}
export function text(value:unknown,name:string,max=200):string {
  if(typeof value!=="string" || !value.trim() || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))
    throw new GatewayError("INVALID_FIELD","Invalid "+name);
  return value.trim();
}
export function id(value:unknown,name="id"):string {
  const result=text(value,name,100);
  if(!/^[a-zA-Z0-9_.:-]+$/.test(result)) throw new GatewayError("INVALID_ID","Invalid "+name);
  return result;
}
export function accountId(value:unknown) {
  const result=id(value,"accountId");
  if(!/^mock-[a-z0-9-]{1,32}$/.test(result)) throw new GatewayError("MOCK_ONLY","Only synthetic mock- account IDs are allowed",403);
  return result;
}
export function event(input:unknown):CanonicalEvent {
  const e=object(input);
  fields(e,["accountId","threadId","threadType","sourceMessageId","senderId","direction","sourceTimestamp","receivedAt","eventKind","version","contentType","content","sourceRef","traceId","threadLabel","muted","quoteSourceMessageId"]);
  const normalized:CanonicalEvent = {
    accountId:accountId(e.accountId),threadId:id(e.threadId,"threadId"),sourceMessageId:id(e.sourceMessageId,"sourceMessageId"),
    senderId:id(e.senderId,"senderId"),traceId:id(e.traceId,"traceId"),sourceRef:text(e.sourceRef,"sourceRef",300),
    sourceTimestamp:text(e.sourceTimestamp,"sourceTimestamp",40),receivedAt:text(e.receivedAt,"receivedAt",40),
    threadType:e.threadType as CanonicalEvent["threadType"],direction:e.direction as CanonicalEvent["direction"],
    eventKind:e.eventKind as CanonicalEvent["eventKind"],contentType:e.contentType as CanonicalEvent["contentType"],
    content: typeof e.content==="string" && e.content.length<=8000 ? e.content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu,"") : (()=>{throw new GatewayError("CONTENT_LIMIT","Content must be text up to 8000 characters");})(),
    version:Number(e.version),threadLabel:text(e.threadLabel,"threadLabel",200),muted:e.muted===true
  };
  if(!["dm","group"].includes(normalized.threadType)||!["inbound","outbound","self"].includes(normalized.direction)||!["message","edit","recall","attachment","other"].includes(normalized.eventKind)||!["text","attachment","other"].includes(normalized.contentType)||!Number.isSafeInteger(normalized.version)||normalized.version<1||!Number.isFinite(Date.parse(normalized.sourceTimestamp))||!Number.isFinite(Date.parse(normalized.receivedAt))||!normalized.sourceRef.startsWith("mock://"))
    throw new GatewayError("INVALID_EVENT","Unsupported mock event");
  if(e.quoteSourceMessageId!==undefined)normalized.quoteSourceMessageId=id(e.quoteSourceMessageId,"quoteSourceMessageId");
  normalized.sourceTimestamp=new Date(normalized.sourceTimestamp).toISOString();
  normalized.receivedAt=new Date(normalized.receivedAt).toISOString();
  if(normalized.eventKind==="recall")normalized.content="";
  if(Buffer.byteLength(JSON.stringify(normalized))>12288)throw new GatewayError("EVENT_LIMIT","Serialized event exceeds 12 KiB",413);
  return normalized;
}
export function draft(input:unknown):ManualSendInput {
  const value=object(input);
  fields(value,["accountId","threadId","text","intentId","quoteSourceMessageId"]);
  const result:ManualSendInput={accountId:accountId(value.accountId),threadId:id(value.threadId,"threadId"),text:text(value.text,"text",2000),intentId:id(value.intentId,"intentId")};
  if(value.quoteSourceMessageId!==undefined)result.quoteSourceMessageId=id(value.quoteSourceMessageId,"quoteSourceMessageId");
  return result;
}
