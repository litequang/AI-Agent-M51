"""Verify bearer auth and that project logs contain no project secrets."""
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
from common import BASE, ROOT, request, save

result = {"status": "FAIL"}
try:
    keyfile = ROOT / "secrets/ai-api.key"
    secret = keyfile.read_bytes().strip()
    assert len(secret) >= 32, "Missing API credential"
    try:
        urllib.request.urlopen(BASE + "/v1/models", timeout=10)
        raise AssertionError("Unauthenticated models request succeeded")
    except urllib.error.HTTPError as exc:
        assert exc.code in (401, 403), f"Unexpected unauthenticated HTTP {exc.code}"
        result["unauthenticated_http"] = exc.code
    models, _ = request("/v1/models")
    assert models.get("data"), "Authenticated API request failed"
    checked = 0
    private_url = ROOT / "secrets/tailscale-login.url"
    secrets = [secret]
    if private_url.exists():
        secrets.append(private_url.read_bytes().strip())
    for path in (ROOT / "logs").rglob("*"):
        if path.is_file() and path.stat().st_size < 32 * 1024**2:
            data = path.read_bytes()
            assert not any(value and value in data for value in secrets), f"Secret detected in project log {path.name}"
            checked += 1
    result.update(status="PASS", logs_checked=checked, authenticated_models=True, secret_values="never included in results")
except Exception as exc:
    result["error"] = str(exc)
save("security-results", result)
sys.exit(0 if result["status"] == "PASS" else 1)
