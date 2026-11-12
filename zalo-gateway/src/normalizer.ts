import type { CanonicalEvent } from "./contracts.js";
import { shapeMessage } from "./vendor/message-envelope.js";
import { event as validateEvent } from "./validation.js";

/** Exercise the audited protocol-envelope mapping using synthetic DTOs only. */
export function normalizeMockWireFixture(fixture:CanonicalEvent):CanonicalEvent {
  const shaped=shapeMessage({
    type:fixture.threadType==="group"?1:0,threadId:fixture.threadId,isSelf:fixture.direction!=="inbound",
    data:{uidFrom:fixture.senderId,dName:fixture.senderId,ts:String(Date.parse(fixture.sourceTimestamp)),msgId:fixture.sourceMessageId,cliMsgId:fixture.sourceMessageId,content:fixture.content,msgType:fixture.contentType}
  },Date.parse(fixture.receivedAt));
  return validateEvent({...fixture,threadId:shaped.threadId,threadType:shaped.threadType,sourceMessageId:shaped.msgId,senderId:shaped.fromId,sourceTimestamp:new Date(Number(shaped.ts)).toISOString(),content:shaped.content});
}
