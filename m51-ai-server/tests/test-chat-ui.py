import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import sys
from common import ROOT, save
sys.path.insert(0, str(ROOT / "scripts"))
from access import required

URL = os.environ.get("M51_CHAT_URL") or "http://" + required("PC_LAN_IP") + ":8787"
result = {"status": "FAIL", "url": URL, "browser_visual_qa": "SKIP: browser/native control host unavailable"}
try:
    secret = (ROOT / "secrets/ai-api.key").read_bytes().strip()
    for path in ("/", "/style.css", "/app.js"):
        with urllib.request.urlopen(URL + path, timeout=10) as response:
            body = response.read()
            assert response.status == 200
            assert secret not in body, "Credential exposed in browser asset"
    with urllib.request.urlopen(URL + "/api/status", timeout=10) as response:
        assert json.load(response)["ready"] is True
    try:
        urllib.request.urlopen(URL + "/secrets/ai-api.key", timeout=10)
        raise AssertionError("Secret file is publicly readable")
    except urllib.error.HTTPError as exc:
        assert exc.code == 404
    payload = json.dumps({"messages": [{"role": "user", "content": "Chào bạn! Hãy chào lại bằng một câu tiếng Việt ngắn."}], "thinking": False}).encode()
    req = urllib.request.Request(URL + "/api/chat", data=payload, headers={"Content-Type": "application/json", "Origin": URL})
    content = ""
    with urllib.request.urlopen(req, timeout=180) as response:
        assert response.headers.get_content_type() == "text/event-stream"
        for line in response:
            if line.startswith(b"data: ") and line.strip() != b"data: [DONE]":
                data = json.loads(line[6:])
                for choice in data.get("choices", []):
                    content += choice.get("delta", {}).get("content") or ""
    assert content.strip(), "No streamed answer"
    result["synthetic_response"] = content
    blocked = urllib.request.Request(URL + "/api/chat", data=payload, headers={"Content-Type": "application/json", "Origin": "http://untrusted.invalid"})
    try:
        urllib.request.urlopen(blocked, timeout=10)
        raise AssertionError("Cross-origin request accepted")
    except urllib.error.HTTPError as exc:
        assert exc.code == 403
    result.update(status="PASS", assets=True, streamed_chat=True, credential_not_in_browser_assets=True, cross_origin_blocked=True)
except Exception as exc:
    result["error"] = str(exc)
save("chat-ui-results", result)
raise SystemExit(0 if result["status"] == "PASS" else 1)
