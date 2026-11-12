"""LAN-only chat UI. Keep the model credential on the PC, outside browser code."""
import argparse
import ipaddress
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import urllib.error
import urllib.parse
import urllib.request
from access import required

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--host", default=required("PC_LAN_IP"))
parser.add_argument("--port", type=int, default=8787)
parser.add_argument("--upstream", default="http://127.0.0.1:18081")
args = parser.parse_args()
if not ipaddress.ip_address(args.host).is_private or args.host == "0.0.0.0":
    raise SystemExit("Bind to the PC's specific private LAN address")
KEY = (ROOT / "secrets/ai-api.key").read_text().strip()
BASE = args.upstream.rstrip("/")
NETWORK = ipaddress.ip_network(args.host + "/24", strict=False)
SLOTS = threading.BoundedSemaphore(2)
MODEL = None


def upstream(path, payload=None, timeout=20):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *values):
        # No request body, headers, query parameters, auth URL or credential logs.
        print(f"{self.client_address[0]} {self.command} {urllib.parse.urlsplit(self.path).path}", flush=True)

    def allowed(self):
        return ipaddress.ip_address(self.client_address[0]) in NETWORK

    def send_headers(self, status, content_type, length=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
        if length is not None:
            self.send_header("Content-Length", str(length))
        else:
            self.send_header("Connection", "close")
            self.close_connection = True
        self.end_headers()

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_headers(status, "application/json; charset=utf-8", len(body))
        self.wfile.write(body)

    def do_GET(self):
        if not self.allowed():
            return self.reply(403, {"error": "Chỉ dành cho mạng LAN."})
        route = urllib.parse.urlsplit(self.path).path
        if route == "/api/status":
            try:
                ready = upstream("/health", timeout=5).get("status") == "ok"
                return self.reply(200, {"ready": ready})
            except Exception:
                return self.reply(200, {"ready": False})
        files = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"), "/style.css": ("style.css", "text/css")}
        if route not in files:
            return self.reply(404, {"error": "Không tìm thấy."})
        name, kind = files[route]
        body = (ROOT / "web" / name).read_bytes()
        self.send_headers(200, kind + "; charset=utf-8", len(body))
        self.wfile.write(body)

    def do_POST(self):
        global MODEL
        if not self.allowed() or urllib.parse.urlsplit(self.path).path != "/api/chat":
            return self.reply(403, {"error": "Không được phép."})
        origin = self.headers.get("Origin")
        expected = "http://" + self.headers.get("Host", "")
        if origin and origin != expected:
            return self.reply(403, {"error": "Origin không hợp lệ."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 24000 or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.reply(400, {"error": "Yêu cầu không hợp lệ hoặc quá dài."})
            body = json.loads(self.rfile.read(length))
            thinking = body.get("thinking", False) is True
            history = body.get("messages", [])[-8:]
            if not history or history[-1].get("role") != "user":
                raise ValueError("Thiếu câu hỏi.")
            for message in history:
                if message.get("role") not in ("user", "assistant") or not isinstance(message.get("content"), str) or len(message["content"]) > 6000:
                    raise ValueError("Tin nhắn không hợp lệ hoặc quá dài.")
            if not SLOTS.acquire(blocking=False):
                return self.reply(429, {"error": "M51 đang bận. Bạn thử lại sau một chút nhé."})
        except (ValueError, KeyError, TypeError) as exc:
            return self.reply(400, {"error": str(exc)})
        streaming = False
        try:
            if MODEL is None:
                MODEL = upstream("/v1/models")["data"][0]["id"]
            messages = [{"role": "system", "content": "Bạn là trợ lý tiếng Việt. Trả lời rõ ràng, chính xác. Không bịa thông tin. Khi trích xuất công việc, phân biệt người giao việc và người nhận việc."}] + history
            budget = 768 if thinking else 256
            while True:
                rendered = upstream("/apply-template", {"messages": messages, "chat_template_kwargs": {"enable_thinking": thinking}})["prompt"]
                tokens = upstream("/tokenize", {"content": rendered, "add_special": False})["tokens"]
                if len(tokens) <= 2048 - budget - 32:
                    break
                if len(messages) <= 2:
                    return self.reply(400, {"error": "Đoạn tin quá dài cho phiên này. Bạn chia nhỏ nội dung rồi thử lại nhé."})
                del messages[1:min(3, len(messages) - 1)]
            payload = {"model": MODEL, "messages": messages, "max_tokens": budget, "temperature": 0.2, "stream": True, "chat_template_kwargs": {"enable_thinking": thinking}}
            req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(payload, ensure_ascii=False).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
            with urllib.request.urlopen(req, timeout=240) as response:
                self.send_headers(200, "text/event-stream; charset=utf-8")
                streaming = True
                for line in response:
                    self.wfile.write(line)
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            if not streaming:
                self.reply(502, {"error": "Chưa nhận được phản hồi từ M51. Bạn thử lại sau nhé."})
        finally:
            SLOTS.release()


if __name__ == "__main__":
    print(f"M51 chat: http://{args.host}:{args.port}", flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
