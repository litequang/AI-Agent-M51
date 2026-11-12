// Representative plans adapted from Luna Medium draft; timestamps, IDs and burst
// semantics corrected for the new-only collector and account-scoping tests.
import { randomUUID } from "node:crypto";
import { GatewayError, type CanonicalEvent } from "./contracts.js";

export function makeFixtures(accountId:string,scenario:"standard"|"burst"|"duplicate",now=Date.now(),count=30):CanonicalEvent[] {
  if(!/^mock-[a-z0-9-]{1,32}$/.test(accountId))throw new GatewayError("MOCK_ONLY","Synthetic account required",403);
  if(!["standard","burst","duplicate"].includes(scenario)||!Number.isInteger(count)||count<1||count>100)throw new GatewayError("FIXTURE_LIMIT","Invalid fixture batch");
  const stamp=new Date(now).toISOString();
  const base:CanonicalEvent={accountId,threadId:"mock-dm-shared",threadType:"dm",sourceMessageId:"mock-shared-id",senderId:"mock-peer",direction:"inbound",sourceTimestamp:stamp,receivedAt:stamp,eventKind:"message",version:1,contentType:"text",content:"Chào bạn, đây là hội thoại giả lập mới.",sourceRef:"mock://standard/dm",traceId:"mock-trace-"+randomUUID(),threadLabel:"Khách hàng giả lập",muted:false};
  if(scenario==="duplicate")return [{...base},{...base}];
  if(scenario==="burst")return Array.from({length:count},(_,i)=>({...base,threadId:i%2?"mock-group-shared":"mock-dm-shared",threadType:i%2?"group":"dm",sourceMessageId:"mock-burst-"+randomUUID(),content:"Tin giả lập liên tiếp "+(i+1),sourceRef:"mock://burst/"+i,traceId:"mock-trace-"+randomUUID()}));
  return [
    base,
    {...base,threadId:"mock-group-shared",threadType:"group",threadLabel:"Nhóm dự án giả lập",content:"Nhóm có tin nhắn mới.",sourceRef:"mock://standard/group"},
    {...base,threadId:"mock-group-muted",threadType:"group",threadLabel:"Nhóm tắt thông báo (fixture)",muted:true,content:"Muted là metadata kiểm thử, chưa xác minh nguồn thật.",sourceRef:"mock://standard/muted"},
    {...base,sourceMessageId:"mock-self",senderId:"mock-self",direction:"self",content:"Ghi chú của chủ tài khoản giả lập.",sourceRef:"mock://standard/self"},
    {...base,sourceMessageId:"mock-outgoing",senderId:"mock-self",direction:"outbound",content:"Tin đi giả lập.",sourceRef:"mock://standard/outgoing"},
    {...base,eventKind:"edit",version:2,content:"Nội dung giả lập đã chỉnh sửa.",sourceRef:"mock://standard/edit"},
    {...base,sourceMessageId:"mock-attachment",eventKind:"attachment",contentType:"attachment",content:"Tệp giả lập — không tải tệp từ Internet.",sourceRef:"mock://standard/attachment"},
    {...base,sourceMessageId:"mock-recalled",content:"Tin giả lập sẽ được thu hồi.",sourceRef:"mock://standard/recall-base"},
    {...base,sourceMessageId:"mock-recalled",eventKind:"recall",version:2,content:"",sourceRef:"mock://standard/recall"},
    {...base,sourceMessageId:"mock-other",eventKind:"other",contentType:"other",content:"Sự kiện giả lập khác.",sourceRef:"mock://standard/other"}
  ];
}
