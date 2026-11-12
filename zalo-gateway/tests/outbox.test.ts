import assert from "node:assert/strict";
import { test } from "node:test";
import { setup,connect,message } from "./helpers.js";

test("mock send requires explicit account/thread confirmation and keeps a durable state trail",async()=>{
  const context=await setup();
  try {
    await connect(context.app);await context.app.ingest(message());await context.app.drain();
    const draft=await context.app.createDraft({accountId:"mock-a",threadId:"mock-thread-shared",text:"Nháp giả lập",intentId:"mock-intent-1",quoteSourceMessageId:"mock-message-1"});
    assert.equal(draft.state,"draft");
    await assert.rejects(context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:false}),{code:"CONFIRMATION_REQUIRED"});
    await assert.rejects(context.app.confirmSend(draft.id,{accountId:"mock-b",threadId:draft.threadId,operatorConfirmed:true}),{code:"SEND_SCOPE"});
    await assert.rejects(context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:"another-thread",operatorConfirmed:true}),{code:"SEND_SCOPE"});
    const sent=await context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:true});
    assert.equal(sent.state,"sent_ack");assert.equal(sent.mock,true);
    const repeated=await context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:true});
    assert.equal(repeated.id,sent.id);assert.equal(repeated.state,"sent_ack");
    const same=await context.app.createDraft({accountId:"mock-a",threadId:draft.threadId,text:"Nháp giả lập",intentId:"mock-intent-1",quoteSourceMessageId:"mock-message-1"});
    assert.equal(same.id,draft.id);
    await assert.rejects(context.app.createDraft({accountId:"mock-a",threadId:draft.threadId,text:"Changed body",intentId:"mock-intent-1"}),{code:"INTENT_CONFLICT"});
  } finally {await context.close();}
});

test("uncertain/failed outcomes never retry automatically; restart converts pending to uncertain",async()=>{
  const context=await setup();
  try {
    await connect(context.app);await context.app.ingest(message());await context.app.drain();
    for(const outcome of ["uncertain","failed"] as const) {
      context.app.connector("mock-a").setSendOutcome(outcome);
      const draft=await context.app.createDraft({accountId:"mock-a",threadId:"mock-thread-shared",text:"Mock send",intentId:"mock-"+outcome});
      const item=await context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:true});
      assert.equal(item.state,outcome);
      await assert.rejects(context.app.confirmSend(draft.id,{accountId:"mock-a",threadId:draft.threadId,operatorConfirmed:true}),{code:"NO_RETRY"});
    }
  } finally {await context.close();}
});

test("quoted message cannot be borrowed from another account/thread",async()=>{
  const context=await setup();
  try {
    await connect(context.app,"mock-a");await connect(context.app,"mock-b");
    await context.app.ingest(message("mock-a","only-a"));await context.app.ingest(message("mock-b","only-b"));await context.app.drain();
    await assert.rejects(context.app.createDraft({accountId:"mock-b",threadId:"mock-thread-shared",text:"No cross-account quote",intentId:"mock-cross-quote",quoteSourceMessageId:"only-a"}),{code:"QUOTE_SCOPE"});
  } finally {await context.close();}
});
