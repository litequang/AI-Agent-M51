import sys
from common import chat, fold, save

result = {"status": "FAIL"}
try:
    result["response"] = chat("Thủ đô của Việt Nam là thành phố nào? Trả lời bằng một câu tiếng Việt.", max_tokens=96)
    assert "ha noi" in fold(result["response"]["content"]), "Expected Hà Nội in answer"
    assert result["response"]["finish_reason"] != "length", "Answer was truncated"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("vietnamese-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
