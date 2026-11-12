PUBLIC COPY: live addresses/usernames have been replaced with placeholders. Refer to the operator's private LOCAL_ACCESS.md and connection.local.json for authorized access.

PHASE01 GATEWAY UPDATE: Branch feature/zalo-gateway-p1-mock-20261112 implements
an isolated mock gateway in zalo-gateway/. Read
[the implementation handoff](docs/zalo-gateway/implementation-handoff.md) for source
map, reuse audit, PC/M51 tests, resource sample and next approval gates. Existing
AI/chat/Tailscale services are preserved. No persistent gateway, real Zalo login/send,
main merge or production release was enabled.

CURRENT ARCHITECTURE UPDATE (supersedes PC-hosted chat instructions below): Chat is now hosted entirely on M51 as runit service m51-chat, loopback 8787 -> phone AI loopback 8080. Phone Tailscale Serve8787 provides http://<REDACTED_NETWORK_ADDRESS>:8787; SSH8022 remains. PC chat, API tunnels18080/18081 and PC Serve8787 were stopped. Actual direct phone chat/model switching/security and PC listener-zero checks passed. Chat crash recovery1.11s and60s observation passed. Physical PC power-off, actual4G, reboot and endurance are still untested. See docs/phone-chat.md and phone-*.json. Cloudflare DNS ownership confirmed by user; custom domain/Tunnel/Access only discussed, not configured.

# Bàn giao AI Agent M51

Cập nhật ngày 12/11/2026, múi giờ Asia/Bangkok. Đọc tài liệu này trước khi thao tác.

## 1. Trạng thái hiện tại

- Termux đã được người dùng cài lại trước khi thiết lập. Lỗi OpenSSL/libcurl cũ hiện không còn; `dpkg --audit` sạch.
- SSH Ed25519 từ Windows sang M51 đã PASS. Không thay đổi hoặc tắt đăng nhập bằng mật khẩu.
- llama.cpp đã build và load đúng Qwen3-1.7B Q4_K_M trên Android ARM64, không root, không Debian.
- API, tiếng Việt, JSON, trích người phụ trách với thinking, khôi phục crash, stop/start, log rotation và idle CPU đã kiểm thử thật.
- Bài soak đủ 30 phút đã hoàn thành với `soak_exit=0`; xem `docs/stability-results.json` để lấy thời lượng và số mẫu chính xác.
- Tailscale PC và M51 đã đăng nhập cùng tailnet. SSH qua địa chỉ Tailscale và sinh phản hồi API qua tunnel đã PASS.
- UI chat LAN đã chạy, truy cập từ M51 được HTTP 200; streaming đã PASS. Kiểm tra giao diện bằng trình duyệt tự động là SKIP vì browser/native control host không khả dụng.
- Chưa đổi sang mạng 4G/5G thực tế, chưa reboot máy, chưa xác minh battery exemption, chưa chạy endurance 24–72 giờ. Không gộp các mục này vào PASS.

## 2. Bản đồ môi trường

| Thành phần | Địa chỉ / đường dẫn |
|---|---|
| GitHub | https://github.com/litequang/AI-Agent-M51 |
| Nhánh triển khai | `codex/m51-ai-server-20261112` |
| Workspace trên PC hiện tại | `<LOCAL_WORKSPACE>` |
| Code và artefact PC | `<LOCAL_WORKSPACE>\m51-ai-server` |
| M51 | Samsung SM-M515F, Android 12, Termux 0.118.3 F-Droid |
| SSH user | `<TERMUX_USER>`, port `8022` |
| M51 LAN | `<M51_LAN_IP>`, alias `m51-ai` |
| M51 Tailscale | `<REDACTED_NETWORK_ADDRESS>`, alias `m51-ai-remote` |
| Windows LAN | `<PC_LAN_IP>` |
| Windows Tailscale | `<REDACTED_NETWORK_ADDRESS>` |
| Deployment đang chạy trên M51 | `/data/data/com.termux/files/home/m51-ai-server` |
| llama API trên M51 | `127.0.0.1:8080` |
| PC API qua LAN SSH | `http://127.0.0.1:18080/v1` |
| PC API qua Tailscale SSH | `http://127.0.0.1:18081/v1` |
| UI chat cho máy cùng LAN | `http://<PC_LAN_IP>:8787` |

UI/tunnel nằm trên PC, vì vậy PC phải đang bật. Engine AI và runit trên M51 hoạt động độc lập.
Nếu IP LAN PC thay đổi do DHCP, cập nhật bind của UI và rule firewall; không đoán IP hoặc quét cả mạng.

## 3. Tiếp quản trên chính PC hiện tại

```powershell
cd <LOCAL_WORKSPACE>
git status --short
ssh -o BatchMode=yes m51-ai-remote 'uname -a && whoami'
ssh m51-ai-remote 'bash ~/m51-ai-server/scripts/status-ai.sh'
python -X utf8 .\m51-ai-server\scripts\query-ai.py --base http://127.0.0.1:18081 "Thủ đô Việt Nam ở đâu?"
```

Không tạo tunnel trùng cổng nếu tunnel hiện tại còn chạy. PID nằm trong `m51-ai-server/run/` trên PC.
Để tạo tunnel mới ở một cửa sổ riêng khi cần:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18081:127.0.0.1:8080 m51-ai-remote
```

Khởi động UI nếu chưa chạy:

```powershell
powershell -NoProfile -File .\m51-ai-server\scripts\start-chat-ui.ps1
```

Trên máy/agent khác, clone repo KHÔNG cung cấp quyền SSH hay API key. Cần người dùng xác thực Tailscale và cấp key SSH riêng cho thiết bị mới. Không sao chép private key vào repo để “tiện tiếp quản”.

## 4. Thao tác dịch vụ M51

```powershell
ssh m51-ai-remote 'bash ~/m51-ai-server/scripts/start-ai.sh'
ssh m51-ai-remote 'bash ~/m51-ai-server/scripts/stop-ai.sh'
ssh m51-ai-remote 'bash ~/m51-ai-server/scripts/status-ai.sh'
ssh m51-ai-remote 'bash ~/m51-ai-server/scripts/healthcheck.sh'
```

Runit services ở `$PREFIX/var/service/m51-ai`, `m51-ai-watch`, `m51-tailscale`.
Log runtime xoay vòng ở `~/m51-ai-server/logs/`. Không upload log thô lên GitHub.
Termux shell/Boot hooks đã cài. Termux:Boot có sẵn, nhưng chưa kiểm tra reboot thật để tránh mất truy cập từ xa.

Cấu hình: context 2048, threads 4, GPU layers 0, batch/ubatch 128, 1 slot, polling 0.
API key được tạo ở file `secrets/ai-api.key`, chỉ truyền qua Authorization header trong process.
UI không đưa key xuống HTML/JavaScript. UI chỉ phục vụ LAN, không có đăng nhập riêng cho các máy được phép trong subnet.

## 5. Nguồn và bằng chứng

- Source llama.cpp: https://github.com/ggml-org/llama.cpp
- Commit build: `827466b9efa0574806bad7732bcd78bfb6d9311d`, version `0.9.0-dev`, Clang 21.1.8 Android aarch64.
- Model: `unsloth/Qwen3-1.7B-GGUF`, revision `d7f544eead698dbd1f15126ef60b45a1e1933222`.
- File: `Qwen3-1.7B-Q4_K_M.gguf`, **1,107,409,472 bytes**.
- SHA256: `b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897`.
- Tailscale: 1.104.6, official ARM64 static tarball kiểm checksum; Windows cài bằng winget gói chính thức.
- Xem `m51-ai-server/docs/deployment-report.md`, `benchmark-report.md` và các JSON cùng thư mục.

Tốc độ đo được khoảng 4–6 token/giây sinh; idle CPU 0% trong phép đo 20 giây, RSS khoảng 1.3–1.5 GiB khi đã load/đang suy luận.
Tóm tắt cấu trúc đúng mẫu mất khoảng **118 giây** khi bật thinking. Các phép toán và phân vai ở chế độ nhanh đã có lỗi; giữ các file `api-initial-results.json`, `arithmetic-thinking-results.json`, `summary-initial-results.json`, `summary-nonthinking-retest-results.json`.

## 6. Lỗi tương thích đã xử lý

Tailscale Linux binary đăng nhập được nhưng sau đó crash SIGSYS khi Go dò helper Linux trong PATH, liên quan syscall `faccessat2` bị Android seccomp chặn.
`scripts/tailscale-daemon.py` đặt PATH riêng trỏ tới thư mục helper rỗng, vì daemon userspace không cần system helpers; bổ sung `--statedir` riêng. Không tắt seccomp, không root. Sau sửa, daemon đã lên Running và SSH/API qua tailnet đã PASS.
Không bỏ workaround này nếu chưa thay bằng build Android native đã kiểm thử.

## 7. Việc còn lại, theo thứ tự

1. Người dùng test UI LAN và phản hồi trải nghiệm; browser visual QA tự động chưa thực hiện được.
2. Test truy cập từ một client thật sự ngoài LAN/4G/5G bằng `m51-ai-remote`; cùng Wi-Fi qua Tailscale chưa chứng minh cellular path.
3. Xác minh bộ cấp nguồn ổn định: M51 đang Discharging trong đợt cài đặt. Kiểm tra Android background/battery exemption bằng quyền phù hợp, không tự yêu cầu root.
4. Kiểm tra Termux:Boot/reboot trong cửa sổ có phương án khôi phục và người dùng sẵn sàng nếu SSH chưa lên.
5. Endurance 24–72 giờ: request giả lập mỗi 2–5 phút, ghi RAM/nhiệt độ/pin/lỗi HTTP, thử tắt màn hình/thay đổi mạng có kiểm soát. Không tắt bảo vệ nhiệt.
6. Chỉ sau khi hạ tầng và độ chính xác đủ tốt mới thiết kế phần tích hợp Zalo; hiện chưa truy cập dữ liệu Zalo thật.

Chưa có PR merge hoặc release. Không ghi PASS cho hạng mục chưa được kiểm chứng.


## Model selection update and public source mapping

The user authorized Qwen3.5-2B Q4_K_M alongside Qwen3-1.7B. The chat header selects the model for the next message while retaining the conversation. Default: `qwen3.5-2b`; alternative: `qwen3-1.7b`. Each reply displays its model label. The proxy passes the selected model through template, tokenize and completion calls, and accepts one concurrent chat request (others receive 429).

Runtime uses the native llama.cpp router with `--models-max 1`, generated `config/models.ini`, and Qwen3.5 loaded on startup. The build needs `-DLLAMA_SUBPROCESS=ON`. The earlier build lacked it; initial failure evidence remains in model-selection-initial-results.json. CPU/context/key-file constraints are unchanged. Thinking is controlled by chat_template_kwargs.enable_thinking without prompt suffixes.

Qwen3.5 source: unsloth/Qwen3.5-2B-GGUF, revision f6d5376be1edb4d416d56da11e5397a961aca8ae, file Qwen3.5-2B-Q4_K_M.gguf, 1,280,835,840 bytes, SHA256 aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223. No vision projector is installed; the current scope is text chat.

The original benchmarks and 30-minute soak describe Qwen3-1.7B before router mode. New evidence: model-selection-results.json, router-stability-results.json, router-runtime.json, qwen35-summary-results.json, and model-selection.md. Do not attribute the old model's speed/accuracy to the new model.

The Android SDK lacks posix_spawn_file_actions_addchdir_np. patch-android-subprocess.py sets the vendor-supported SUBPROCESS_HAVE_CWD=0 in common/subproc.h only under __ANDROID__. The router inherits its CWD; other callers asking to change it receive ENOSYS. The pinned upstream commit plus docs/android-subprocess.patch is the actual source state, not an unmodified upstream build.

Public GitHub branch: codex/m51-ai-server-20261112. No merge/release. The sanitized source checkout is the AI-Agent-M51 subdirectory; the original workspace remains the live operator deployment with private connection.local.json, LOCAL_ACCESS.md, credentials and logs. A public clone does not grant phone access. Use authorized M51_CONNECTION_CONFIG or a private connection.local.json for that checkout. Synchronize changes into the live deployment before restart, retain measured reports, and export a sanitized source copy before pushing.

The UI streaming parser was corrected to split actual newline-delimited SSE rather than literal backslash-n. Browser visual QA is still SKIP; HTTP tests exercise the real backend and streams.

Post-change checks: two actual model switches PASS; both listeners use loopback and parent rejects unauthenticated requests; router plus one model total RSS 1406.7-1543.6 MiB over 300.0 seconds, three successful requests, zero soak failures. Router SIGKILL recovery including generation PASS in 5.53 seconds, both old PIDs gone. A simultaneous UI greeting timed out while the direct API ran long thinking; chat-ui-concurrent-load-results.json retains this FAIL, while the sequential UI retest passed. Direct API clients can queue work outside the PC UI semaphore. Qwen3.5 unbounded thinking exhausted 768 tokens without a final answer in 196.39 seconds. UI/client/tests now cap reasoning_budget_tokens at 256 (total 768) when thinking is selected. Consult qwen35-summary-results.json for the bounded retest; never infer semantic PASS from a successful HTTP request.

Remote chat enabled at http://<REDACTED_NETWORK_ADDRESS>:8787 on user request. PC Tailscale Serve maps private tailnet TCP8787 to the existing LAN chat listener. It runs in the background and does not enable Funnel. Clients must sign into the same authorized tailnet. PC, M51, chat process and SSH tunnel must remain online. M51 userspace tailscale nc verified assets, both-model catalog and an actual Qwen3.5 streamed answer (remote-chat-results.json PASS); both peers still share LAN, actual cellular test remains SKIP. Restore with scripts/enable-remote-chat.ps1; disable only this mapping using tailscale serve --tcp=8787 off.
