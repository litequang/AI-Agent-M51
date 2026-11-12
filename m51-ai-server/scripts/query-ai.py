"""Minimal API client; credential is read from a file, never command arguments."""
import argparse
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("prompt")
parser.add_argument("--base", default="http://127.0.0.1:18080" if os.name == "nt" else "http://127.0.0.1:8080")
parser.add_argument("--key-file", type=Path, default=ROOT / "secrets/ai-api.key")
parser.add_argument("--think", action="store_true", help="Enable thinking for structured extraction or reasoning; slower")
parser.add_argument("--model", default="qwen3.5-2b", choices=["qwen3.5-2b", "qwen3-1.7b"])
args = parser.parse_args()
headers = {"Authorization": "Bearer " + args.key_file.read_text().strip(), "Content-Type": "application/json"}
req = urllib.request.Request(args.base.rstrip("/") + "/v1/models", headers=headers)
with urllib.request.urlopen(req, timeout=20) as response:
    models = {item["id"] for item in json.load(response)["data"]}
    if args.model not in models:
        raise SystemExit("Requested model is not installed")
    model = args.model
payload = {"model": model, "messages": [{"role": "user", "content": args.prompt}], "max_tokens": 768 if args.think else 256, "temperature": 0.2, "chat_template_kwargs": {"enable_thinking": args.think}}
if args.think:
    payload["reasoning_budget_tokens"] = 256
req = urllib.request.Request(args.base.rstrip("/") + "/v1/chat/completions", data=json.dumps(payload, ensure_ascii=False).encode(), headers=headers)
with urllib.request.urlopen(req, timeout=240) as response:
    print(json.load(response)["choices"][0]["message"]["content"])
