# Third-party notices

The source audit and exact source pins are in ../docs/zalo-gateway/reuse-audit.md.
Distribute this file and third-party/*.LICENSE with compiled artifacts.

- **zalo-personal-mcp**, MIT, copyright 2026 Khoa Tran, commit e91ecfe0c17d29bb50fa2adc22759407604c9b92:
  src/vendor/session-compare.ts extracts safeEqual from src/session.ts.
  src/vendor/message-envelope.ts adapts shapeMessage from src/message-log.ts;
  global configuration, disk logging, historical messages and SDK imports were removed.
  Full notice: third-party/zalo-personal-mcp.LICENSE.
- **zalo-agent**, MIT, copyright 2026 Vu Van Hai, commit 4346f295e9dbd787a427993ddf3b083ebb57cf15:
  account/thread composite schema and SQLite WAL bootstrap informed the newly written
  store-worker.ts. FULL, foreign keys, worker ownership and durable journal replace the
  original runtime. Full notice: third-party/zalo-agent.LICENSE.
- **zca-js**, MIT, copyright 2024–2025 RFS-ADRENO, truong9c2208, JustKemForFun,
  commit 2a7e360257dfe98e2eb48dc46bbf389834be7e0b:
  DTO/thread type reference only; no SDK code import or installed dependency.
  Full reference notice retained conservatively: third-party/zca-js.LICENSE.

No whole upstream application, npm runtime graph, MCP server, auto-reply engine,
updater, file/media tool or real Zalo connector is included.
Node and development tools retain their own distribution licenses.
