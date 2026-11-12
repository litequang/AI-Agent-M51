"""Real LAN streaming, model switching and validation. Synthetic prompts only."""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from common import ROOT, save
sys.path.insert(0, str(ROOT / "scripts"))
from access import required

URL = os.environ.get("M51_CHAT_URL") or "http://" + required("PC_LAN_IP") + ":8787"
report = {"status": "FAIL", "url": URL, "checks": [], "browser_visual_qa": "SKIP: browser/native control host unavailable"}

def stream(model, prompt):
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "thinking": False}
    req = urllib.request.Request(URL + "/api/chat", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Origin": URL})
    start = time.monotonic()
    content, reported, first = "", set(), None
    with urllib.request.urlopen(req, timeout=300) as response:
        assert response.headers.get_content_type() == "text/event-stream"
        for line in response:
            if not line.startswith(b"data: ") or line.strip() == b"data: [DONE]":
                continue
            item = json.loads(line[6:])
            if item.get("model"):
                reported.add(item["model"])
            for choice in item.get("choices", []):
                text = choice.get("delta", {}).get("content") or ""
                if text and first is None:
                    first = time.monotonic() - start
                content += text
    assert content.strip(), "No answer"
    assert reported == {model}, f"Wrong model: {reported}"
    return {"model": model, "reported_models": sorted(reported), "response": content, "seconds": time.monotonic() - start, "first_content_seconds": first}

try:
    with urllib.request.urlopen(URL + "/api/models", timeout=20) as response:
        catalog = json.load(response)
    assert {item["id"] for item in catalog["models"]} == {"qwen3.5-2b", "qwen3-1.7b"}
    assert catalog["default"] == "qwen3.5-2b"
    report["catalog"] = catalog
    for model in ("qwen3.5-2b", "qwen3-1.7b", "qwen3.5-2b"):
        check = stream(model, "Chào bạn. Thủ đô Việt Nam là thành phố nào? Trả lời một câu ngắn bằng tiếng Việt.")
        assert "Hà Nội" in check["response"] or "Hà nội" in check["response"], check
        report["checks"].append(check)
        print(json.dumps(check, ensure_ascii=False), flush=True)
    for model in ("unknown-model", "../../secrets/ai-api.key"):
        try:
            stream(model, "Xin chào")
            raise AssertionError("Invalid model accepted")
        except urllib.error.HTTPError as exc:
            assert exc.code == 400
    report.update(status="PASS", invalid_models_blocked=True, actual_switches=2)
except Exception as exc:
    report["error"] = str(exc)
save("model-selection-results", report)
raise SystemExit(0 if report["status"] == "PASS" else 1)
