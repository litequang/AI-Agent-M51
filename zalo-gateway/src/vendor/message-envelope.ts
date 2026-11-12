// Narrow adaptation of shapeMessage from zalo-personal-mcp src/message-log.ts,
// e91ecfe0c17d29bb50fa2adc22759407604c9b92. MIT (c) 2026 Khoa Tran.
// Preserves the envelope/quote field mapping, removes global config, logging,
// filesystem access, backlog support, arbitrary attachment objects and SDK import.
// ThreadType values refer to zca-js src/models/Enum.ts at 2a7e360257dfe98e2eb48dc46bbf389834be7e0b.
// Complete notices: ../../third-party/{zalo-personal-mcp,zca-js}.LICENSE.
export interface MockWireMessage {
  type: 0 | 1; threadId: string; isSelf: boolean;
  data: {uidFrom:string; dName:string; ts:string; msgId:string; cliMsgId:string; content:string;msgType:string};
}
export function shapeMessage(msg: MockWireMessage, loggedAt: number) {
  const d = msg.data;
  return {
    loggedAt, source: "live" as const,
    threadType: msg.type === 1 ? "group" as const : "dm" as const,
    threadId: msg.threadId, isSelf: !!msg.isSelf,
    fromId: d.uidFrom, fromName: d.dName, ts: d.ts,
    msgId: d.msgId, cliMsgId: d.cliMsgId, content: d.content,
    quote: {content:d.content,msgType:d.msgType,uidFrom:d.uidFrom,msgId:d.msgId,cliMsgId:d.cliMsgId,ts:d.ts}
  };
}
