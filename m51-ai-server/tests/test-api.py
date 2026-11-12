import sys
from common import chat, request, save

result = {"status": "FAIL", "requests": []}
try:
    result["health"], _ = request("/health")
    assert result["health"].get("status") == "ok"
    models, _ = request("/v1/models")
    assert models.get("data"), "No loaded model advertised"
    result["models"] = models
    result["scope"] = "HTTP/model availability and five completed responses; semantic arithmetic probes retained separately"
    for i in range(5):
        item = chat("Hãy viết một lời chào ngắn bằng tiếng Việt.", max_tokens=64)
        item["request_index"] = i + 1
        item["pass"] = bool(item["content"].strip()) and item["finish_reason"] == "stop"
        result["requests"].append(item)
    assert all(item["pass"] for item in result["requests"]), "Repeated request check failed"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("api-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
