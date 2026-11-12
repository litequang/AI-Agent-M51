import json
import sys
from common import chat, fold, save

SCHEMA = {"type": "object", "properties": {"summary": {"type": "string"}, "tasks": {"type": "array", "items": {"type": "object", "properties": {"owner": {"type": "string"}, "task": {"type": "string"}, "deadline": {"type": "string"}}, "required": ["owner", "task", "deadline"], "additionalProperties": False}}, "urgent": {"type": "boolean"}, "urgent_evidence": {"type": "string"}}, "required": ["summary", "tasks", "urgent", "urgent_evidence"], "additionalProperties": False}
PROMPT = """Đây là hội thoại GIẢ LẬP để kiểm thử, không phải tin nhắn Zalo thật:
Lan: Minh gửi báo giá cho khách An trước 15:00 hôm nay nhé.
Minh: Tôi nhận việc gửi báo giá trước 15:00 hôm nay.
An: KHẨN CẤP! Máy in đang bốc khói. Ngắt điện ngay và gọi người phụ trách an toàn!
Lan: Đã rõ, ưu tiên xử lý nguy cơ cháy trước.
Xuất JSON theo schema, theo các quy tắc sau:
- summary: hai câu tiếng Việt, bao quát cả công việc thông thường lẫn sự cố cần xử lý, không bỏ sự cố.
- tasks: CHỈ liệt kê công việc đã có người nhận việc xác nhận rõ ràng. Việc chưa có người nhận xác nhận thì không đưa vào tasks. Không gán hạn của việc này cho việc khác.
- urgent: có nguy hiểm hoặc yêu cầu xử lý ngay thì true.
- urgent_evidence: chép nguyên văn TOÀN BỘ tin nhắn chứa tình huống nguy hiểm, gồm lý do và hành động cần làm, không chỉ chép nhãn khẩn cấp.
Không tạo thêm người, công việc hoặc thời hạn. Không ghi giải thích ngoài JSON."""

result = {"status": "FAIL", "checks": {}}
try:
    result["inference_mode"] = "thinking enabled per request for structured extraction; server default remains non-thinking"
    result["response"] = chat(PROMPT, schema=SCHEMA, max_tokens=768, thinking=True)
    data = json.loads(result["response"]["content"])
    result["parsed"] = data
    checks = result["checks"]
    checks["json_schema_keys"] = set(data) == set(SCHEMA["required"])
    checks["summary_quotation"] = "bao gia" in fold(data["summary"])
    checks["summary_hazard"] = any(word in fold(data["summary"]) for word in ("khoi", "chay", "ngat dien"))
    checks["owner_task_deadline"] = any(fold(t["owner"]) == "minh" and "bao gia" in fold(t["task"]) and "15" in t["deadline"] for t in data["tasks"])
    checks["no_unconfirmed_owner_or_deadline"] = all(fold(t["owner"]) == "minh" and "bao gia" in fold(t["task"]) and "15" in t["deadline"] for t in data["tasks"])
    checks["urgent_positive"] = data["urgent"] is True and any(word in fold(data["urgent_evidence"]) for word in ("khoi", "chay", "ngat dien"))
    checks["not_truncated"] = result["response"]["finish_reason"] != "length"
    negative_schema = {"type": "object", "properties": {"urgent": {"type": "boolean"}}, "required": ["urgent"], "additionalProperties": False}
    result["nonurgent_response"] = chat('Hội thoại GIẢ LẬP: Nam: "Chúc mọi người cuối tuần vui vẻ." Có tình huống khẩn cấp cần xử lý ngay không? Chỉ trả JSON.', schema=negative_schema, max_tokens=64)
    checks["urgent_negative"] = json.loads(result["nonurgent_response"]["content"])["urgent"] is False
    assert all(checks.values()), "One or more semantic acceptance checks failed"
    result["status"] = "PASS"
except Exception as exc:
    result["error"] = str(exc)
save("summary-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
