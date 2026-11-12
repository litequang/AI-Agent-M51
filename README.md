# AI Agent M51

Samsung Galaxy M51 running a private Qwen3 AI server in Termux, with a LAN chat UI and private Tailscale + SSH access.

**Active implementation:** [codex/m51-ai-server-20261112](https://github.com/litequang/AI-Agent-M51/tree/codex/m51-ai-server-20261112).

Start with [HANDOFF.md](https://github.com/litequang/AI-Agent-M51/blob/codex/m51-ai-server-20261112/HANDOFF.md), then [deployment-report.md](https://github.com/litequang/AI-Agent-M51/blob/codex/m51-ai-server-20261112/m51-ai-server/docs/deployment-report.md).

```bash
git clone https://github.com/litequang/AI-Agent-M51.git
cd AI-Agent-M51
git switch codex/m51-ai-server-20261112
```

This is a PUBLIC source repository. Live network addresses, device usernames, private credentials and login state are deliberately omitted. The existing operator has private access details locally; a new operator must obtain authorized access separately.

Copy `m51-ai-server/config/connection.example.json` to the ignored `connection.local.json` and fill the deployment values before using PC setup scripts. See `AGENTS.md` and `HANDOFF.md` for measured status, recovery and remaining work.

No private SSH key, API credential, Tailscale state, raw runtime log, model binary or real Zalo data belongs here.
