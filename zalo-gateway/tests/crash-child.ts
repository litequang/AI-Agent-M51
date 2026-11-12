import { Gateway } from "../src/gateway.js";
import { message,connect } from "./helpers.js";
const path=process.argv[2];
if(!path)throw new Error("Private test database path required");
const app=new Gateway({databasePath:path,autoDrain:false});
await app.initialize();
await connect(app);
await app.ingest(message("mock-a","mock-base"));await app.drain();
const draft=await app.createDraft({accountId:"mock-a",threadId:"mock-thread-shared",text:"Mock pending delivery",intentId:"mock-crash-intent"});
await app.store.call("claimSend",{id:draft.id,accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:true});
const receipt=await app.ingest(message("mock-a","mock-before-sigkill"));
process.send!({ready:true,persisted:receipt.persisted,outboxId:draft.id});
// Remain alive until the test process kills this isolated synthetic child.
setInterval(()=>{},1000);
