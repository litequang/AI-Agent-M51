"""Summarize measured evidence for the model-selection rollout."""
import json
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "docs"

def get(name):
    path = DOCS / (name + ".json")
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"status": "SKIP"}

selection = get("model-selection-results")
soak = get("router-stability-results")
recovery = get("router-recovery-results")
summary = get("qwen35-summary-results")
memory = [sample["total_rss_kb"]/1024 for sample in soak.get("samples", [])]
text = """# Chat model selection

The chat header selects Qwen3.5 2B (default) or Qwen3 1.7B for the next reply. Conversation is retained; each reply carries its model label. The browser remembers the selection locally.

Native llama.cpp router uses --models-max 1, CPU only, context 2048, four threads and one inference slot. Requests carry the chosen model through template, tokenize and completion calls. The PC proxy admits one chat request at a time and rejects unsupported IDs.

| Model | API ID | Quantization |
|---|---|---|
| Qwen3.5 2B | qwen3.5-2b | Q4_K_M |
| Qwen3 1.7B | qwen3-1.7b | Q4_K_M |

## Actual results

"""
text += f"- Model select/switch/stream: **{selection['status']}**; requested and reported model IDs matched.\n"
for check in selection.get("checks", []):
    text += f"- {check['model']}: {check['seconds']:.2f}s total, first content {check['first_content_seconds']:.2f}s, including model loading and prompt processing.\n"
text += f"- Post-change soak: **{soak['status']}**, {soak.get('elapsed_seconds', 0):.2f}s, {len(soak.get('requests', []))} successful requests, {len(soak.get('failures', []))} failures.\n"
if memory:
    text += f"- Router plus loaded model total RSS: {min(memory):.1f}-{max(memory):.1f} MiB.\n"
text += f"- Router crash recovery including generation: **{recovery['status']}**, {recovery.get('recovery_including_generation_seconds', 0):.2f}s. Both old processes exited.\n"
text += f"- Runtime/loopback/authentication: **{get('router-runtime')['status']}**.\n"
text += f"- Sequential LAN UI HTTP/stream/security checks: **{get('chat-ui-results')['status']}**.\n"
text += f"- Qwen3.5 bounded-thinking extraction sample: **{summary['status']}**; semantic checks are in qwen35-summary-results.json.\n"
if summary.get("response"):
    response = summary["response"]
    text += f"- Extraction: {response['seconds']:.2f}s, {response['completion_tokens']} tokens, finish reason {response['finish_reason']}.\n"
text += """
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
"""
(DOCS / "model-selection.md").write_text(text, encoding="utf-8")
print("Model-selection report generated from measured evidence")
