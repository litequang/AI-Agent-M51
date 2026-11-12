import assert from "node:assert/strict";
import { test } from "node:test";
import { setup,connect,message } from "./helpers.js";
test("latest-message window follows new events after 200; AI queue and record sizes are bounded",async()=>{
  const c=await setup({autoDrain:false});
  try {
    await connect(c.app);
    for(let n=0;n<205;n++)await c.app.ingest(message("mock-a","mock-window-"+n));
    await c.app.drain();
    const messages=await c.app.store.call("messages",{accountId:"mock-a",threadId:"mock-thread-shared"});
    assert.equal(messages.length,200);
    assert.equal(messages[0].sourceMessageId,"mock-window-5");
    assert.equal(messages[199].sourceMessageId,"mock-window-204");
    for(let n=0;n<16;n++)await c.app.createJob({accountId:"mock-a",threadId:"mock-thread-shared",kind:"summary"});
    await assert.rejects(c.app.createJob({accountId:"mock-a",threadId:"mock-thread-shared",kind:"summary"}),{code:"JOB_LIMIT"});
    await assert.rejects(c.app.ingest({...message(),content:"x".repeat(8001)}));
    await assert.rejects(c.app.createDraft({accountId:"mock-a",threadId:"mock-thread-shared",text:"x".repeat(2001),intentId:"mock-oversized"}));
  } finally {await c.close();}
});
