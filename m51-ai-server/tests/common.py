"""Only synthetic data; standard library HTTP client, no paid AI APIs."""
import datetime
import json
import os
from pathlib import Path
import time
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("M51_API_BASE", "http://127.0.0.1:8080").rstrip("/")
MODEL = None


def request(path, payload=None, timeout=240):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    headers = {"Content-Type": "application/json"}
    key = ROOT / "secrets/ai-api.key"
    if key.is_file():
        headers["Authorization"] = "Bearer " + key.read_text().strip()
    req = urllib.request.Request(BASE + path, data=data, headers=headers)
    start = time.monotonic()
    with urllib.request.urlopen(req, timeout=timeout) as response:
        result = json.load(response)
    return result, time.monotonic() - start


def chat(prompt, schema=None, max_tokens=256, thinking=False):
    global MODEL
    if MODEL is None:
        models, _ = request("/v1/models")
        MODEL = os.environ.get("M51_MODEL", models["data"][0]["id"])
    payload = {"model": MODEL, "messages": [{"role": "system", "content": "Bạn là trợ lý tiếng Việt. Chỉ dùng dữ liệu được cung cấp. Phân biệt người giao việc với người nhận việc. Trả lời chính xác, không suy diễn."}, {"role": "user", "content": prompt}], "temperature": 0, "seed": 42, "max_tokens": max_tokens, "chat_template_kwargs": {"enable_thinking": thinking}}
    if schema:
        payload["response_format"] = {"type": "json_schema", "json_schema": {"name": "result", "strict": True, "schema": schema}}
    if thinking:
        payload["reasoning_budget_tokens"] = 256
    result, elapsed = request("/v1/chat/completions", payload)
    content = result["choices"][0]["message"]["content"]
    tokens = result.get("usage", {}).get("completion_tokens", 0)
    return {"content": content, "seconds": elapsed, "completion_tokens": tokens, "end_to_end_tokens_per_second": tokens / elapsed if elapsed else 0, "timings": result.get("timings", {}), "finish_reason": result["choices"][0].get("finish_reason")}


def fold(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn").replace("đ", "d")


def save(name, result):
    result["timestamp"] = datetime.datetime.now().astimezone().isoformat()
    result["base_url"] = BASE
    dest = ROOT / "docs" / (os.environ.get("M51_RESULT_PREFIX", "") + name + ".json")
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
