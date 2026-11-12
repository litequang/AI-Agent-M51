# Chat model selection

The chat header selects Qwen3.5 2B (default) or Qwen3 1.7B for the next reply. Conversation is retained; each reply carries its model label. The browser remembers the selection locally.

Native llama.cpp router uses --models-max 1, CPU only, context 2048, four threads and one inference slot. Requests carry the chosen model through template, tokenize and completion calls. The PC proxy admits one chat request at a time and rejects unsupported IDs.

| Model | API ID | Quantization |
|---|---|---|
| Qwen3.5 2B | qwen3.5-2b | Q4_K_M |
| Qwen3 1.7B | qwen3-1.7b | Q4_K_M |

## Actual results

- Model select/switch/stream: **PASS**; requested and reported model IDs matched.
- qwen3.5-2b: 9.59s total, first content 7.72s, including model loading and prompt processing.
- qwen3-1.7b: 12.37s total, first content 10.91s, including model loading and prompt processing.
- qwen3.5-2b: 11.89s total, first content 10.02s, including model loading and prompt processing.
- Post-change soak: **PASS**, 300.00s, 3 successful requests, 0 failures.
- Router plus loaded model total RSS: 1406.7-1543.6 MiB.
- Router crash recovery including generation: **PASS**, 5.53s. Both old processes exited.
- Runtime/loopback/authentication: **PASS**.
- Sequential LAN UI HTTP/stream/security checks: **PASS**.
- Qwen3.5 bounded-thinking extraction sample: **PASS**; semantic checks are in qwen35-summary-results.json.
- Extraction: 154.43s, 402 tokens, finish reason stop.

## Limits and retained failures

The initial Qwen3.5 extraction consumed all 768 tokens in reasoning and returned no final content after 196.39 seconds. This FAIL remains in qwen35-summary-unbounded-results.json. Thinking requests now set reasoning_budget_tokens=256 within a total budget of 768, reserving output space. A successful sample is not a general accuracy guarantee.

A greeting queued behind direct API thinking exceeded its 180-second deadline; chat-ui-concurrent-load-results.json retains this FAIL. The sequential UI retest passed. Direct API clients bypass the PC UI semaphore and can queue jobs ahead of chat.

The original 30-minute soak, speeds and semantic results apply to Qwen3-1.7B before router mode. Browser visual QA, actual off-LAN 4G/5G, reboot survival and 24-72h endurance remain SKIP.

## Reproducible build and sources

The pinned upstream commit is in llama-commit.txt. The actual build adds LLAMA_SUBPROCESS=ON and the Android override recorded in android-subprocess.patch. patch-android-subprocess.py accepts only the expected reversible patch. SUBPROCESS_HAVE_CWD=0 is set in common/subproc.h under Android only. Router children inherit CWD; callers requesting a different CWD receive ENOSYS.

- [Official Qwen3.5 2B model card](https://huggingface.co/Qwen/Qwen3.5-2B)
- [Downloaded artifact and SHA256](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/blob/main/Qwen3.5-2B-Q4_K_M.gguf)
- [Official llama.cpp router documentation](https://github.com/ggml-org/llama.cpp/blob/827466b9efa0574806bad7732bcd78bfb6d9311d/tools/server/README.md#using-multiple-models)

The new GGUF is 1,280,835,840 bytes, SHA256 aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223. No vision projector is installed; this rollout serves text chat.
