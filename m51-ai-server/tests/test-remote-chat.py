"""Probe private PC chat from Termux's userspace tailnet (not a cellular test)."""
import argparse
import ipaddress
import json
import subprocess
import sys
import threading
from common import ROOT, save

parser = argparse.ArgumentParser()
parser.add_argument("target", help="PC Tailscale IPv4, supplied privately")
args = parser.parse_args()
if ipaddress.ip_address(args.target) not in ipaddress.ip_network("100.64.0.0/10"):
    raise SystemExit("Expected a Tailscale IPv4")
url = "http://" + args.target + ":8787"
result = {"status": "FAIL", "url": url, "actual_cellular_path": "SKIP: phone and PC currently share LAN"}

def request(path, payload=None):
    body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    header = ("GET" if payload is None else "POST") + " " + path + " HTTP/1.1\r\n"
    header += "Host: " + args.target + ":8787\r\nConnection: close\r\n"
    if payload is not None:
        header += "Origin: " + url + "\r\nContent-Type: application/json\r\nContent-Length: " + str(len(body)) + "\r\n"
    child = subprocess.Popen([str(ROOT/"tailscale/tailscale"), "--socket="+str(ROOT/"run/tailscaled.sock"), "nc", args.target, "8787"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    timer = threading.Timer(240, child.kill)
    timer.start()
    try:
        # nc exits on stdin EOF; keep stdin open until the HTTP server closes.
        child.stdin.write(header.encode()+b"\r\n"+body)
        child.stdin.flush()
        raw = child.stdout.read()
        child.wait(timeout=5)
        assert child.returncode == 0, "Tailnet nc failed"
    finally:
        timer.cancel()
        child.stdin.close()
        if child.poll() is None:
            child.kill()
            child.wait()
    head, content = raw.split(b"\r\n\r\n", 1)
    assert b" 200 " in head.split(b"\r\n")[0], head.split(b"\r\n")[0].decode()
    return content

try:
    assert b'id="model"' in request("/")
    catalog = json.loads(request("/api/models"))
    assert {item["id"] for item in catalog["models"]} == {"qwen3.5-2b", "qwen3-1.7b"}
    assert json.loads(request("/api/status"))["ready"] is True
    stream = request("/api/chat", {"model": "qwen3.5-2b", "thinking": False, "messages": [{"role": "user", "content": "Thủ đô Việt Nam là thành phố nào? Trả lời ngắn."}]})
    content, models = "", set()
    for line in stream.splitlines():
        if not line.startswith(b"data: ") or line.strip() == b"data: [DONE]":
            continue
        item = json.loads(line[6:])
        if item.get("model"):
            models.add(item["model"])
        for choice in item.get("choices", []):
            content += choice.get("delta", {}).get("content") or ""
    assert b"data: [DONE]" in stream and "Hà Nội" in content and models == {"qwen3.5-2b"}
    result.update(status="PASS", assets=True, catalog=True, streamed_chat=True, response=content, reported_models=sorted(models))
except Exception as exc:
    result["error"] = str(exc)
save("remote-chat-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
