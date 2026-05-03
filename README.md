# VC Deal Flow Signal — MCP Server

[![Scout Score](https://signals.gitdealflow.com/api/badge/scout/kindrat86/svg)](https://signals.gitdealflow.com/badge-builder)
[![Commit Momentum](https://signals.gitdealflow.com/api/badge/momentum/mlflow/mlflow/svg)](https://signals.gitdealflow.com/badge-builder)
[![npm](https://img.shields.io/npm/v/@gitdealflow/mcp-signal?label=npm&color=blue)](https://www.npmjs.com/package/@gitdealflow/mcp-signal)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-listed-emerald)](https://registry.modelcontextprotocol.io/v0/servers/io.github.kindrat86%2Fvc-deal-flow-signal)
[![Smithery](https://img.shields.io/badge/Smithery-Verified%2098%2F100-emerald)](https://smithery.ai/servers/kindrat86/vc-deal-flow-signal)
[![Cursor Directory](https://img.shields.io/badge/cursor.directory-listed-sky)](https://cursor.directory/plugins/vc-deal-flow-signal-mcp-1)
[![Goose](https://img.shields.io/badge/Block%20Goose-PR%20%238974-sky)](https://github.com/aaif-goose/goose/pull/8974)
[![Raycast](https://img.shields.io/badge/Raycast%20MCP%20Registry-PR%20%2327618-sky)](https://github.com/raycast/extensions/pull/27618)

Search startup engineering acceleration signals directly from your AI assistant.

![Claude querying VC Deal Flow Signal MCP server](https://gitdealflow.com/mcp-demo.gif)

Tracks commit velocity, contributor growth, and repository expansion across 20 sectors. Built for angels, scouts, and technical operators looking for traction signals before they show up in traditional deal flow.

## Install

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vc-deal-flow-signal": {
      "command": "npx",
      "args": ["-y", "@gitdealflow/mcp-signal"]
    }
  }
}
```

Or for Claude Code (`.mcp.json` in project root):

```json
{
  "mcpServers": {
    "vc-deal-flow-signal": {
      "command": "npx",
      "args": ["-y", "@gitdealflow/mcp-signal"]
    }
  }
}
```

## Use in any agent runtime

The same `npx -y @gitdealflow/mcp-signal` command runs in **seven** popular agent runtimes — copy-paste snippets for each at **[signals.gitdealflow.com/integrations/agent-runtimes](https://signals.gitdealflow.com/integrations/agent-runtimes)**.

| Runtime | Marketplace status | Install path |
|---|---|---|
| **Cursor** | [cursor.directory listing](https://cursor.directory/plugins/vc-deal-flow-signal-mcp-1) (Under review) | Settings → MCP → +Add MCP server → paste JSON |
| **Cline (VS Code)** | [cline/mcp-marketplace#1491](https://github.com/cline/mcp-marketplace/issues/1491) (Submitted) | Cline panel → ⚙ → Edit Config → paste JSON |
| **Block Goose** (43.7k★) | [aaif-goose/goose#8974](https://github.com/aaif-goose/goose/pull/8974) (PR open) | `goose session --with-extension "npx -y @gitdealflow/mcp-signal"` |
| **OpenHands** | No marketplace exists | `~/.openhands/mcp.json` paste-JSON, or Settings → MCP → Add Server |
| **Aider** | No native MCP — bridge via [mcpm-aider](https://github.com/lutzleonhardt/mcpm-aider) | `npx -y mcpm-aider add vc-deal-flow-signal --command "npx -y @gitdealflow/mcp-signal"` |
| **AiderDesk** | Settings → Agent → MCP Servers paste-JSON | Same JSON shape as Claude Desktop |
| **Raycast** (v1.98+) | [raycast/extensions#27618](https://github.com/raycast/extensions/pull/27618) (PR open) | Manage MCP Servers → +Add Server → paste JSON |

Plus: **[Smithery](https://smithery.ai/servers/kindrat86/vc-deal-flow-signal)** (one-click HTTP install, Verified 98/100), **[Mistral Le Chat](https://signals.gitdealflow.com/integrations/mistral)** (Custom MCP Connector), and a **[ChatGPT GPT](https://signals.gitdealflow.com/integrations/chatgpt)** running the same OpenAPI Action.

## Tools

All tools are read-only, idempotent, and fetch live data from the public API (no auth required). Responses include both human-readable text and structured JSON (`structuredContent`) matching each tool's `outputSchema`.

| Tool | Input | Returns |
|---|---|---|
| `get_trending_startups` | — | Top 20 startups ranked by engineering acceleration across all sectors. |
| `search_startups_by_sector` | `sector` (enum of 20 slugs) | All tracked startups in the sector, ranked by acceleration. |
| `get_startup_signal` | `name` (case-insensitive) | Full signal profile for one startup: velocity, contributors, repos, classification. |
| `get_signals_summary` | — | Dataset snapshot — period, counts, refresh date, format URLs, citation. |
| `get_methodology` | — | How signals are sourced, computed, and classified, with known limitations. |

**Supported sectors:** `ai-ml`, `fintech`, `cybersecurity`, `developer-tools`, `healthcare`, `climate-tech`, `enterprise-saas`, `data-infrastructure`, `web3`, `robotics`, `edtech`, `ecommerce-infrastructure`, `supply-chain`, `legal-tech`, `hr-tech`, `proptech`, `agtech`, `gaming`, `space-tech`, `social-community`.

## Data

All data is sourced live from [signals.gitdealflow.com](https://signals.gitdealflow.com) public API. No API key required. Updated weekly on Mondays.

## Complementary: the Scout Game

If you want to put your own eye on the line, there's a prediction game on top of the same dataset at [signals.gitdealflow.com/predict](https://signals.gitdealflow.com/predict). Call which tracked startups raise a round in the next 6 months, earn points when your calls resolve, climb a public rank ladder from Curious to Oracle. Free tier: 3 predictions per month. Paid: 10 per month. Leaderboard: [signals.gitdealflow.com/leaderboard](https://signals.gitdealflow.com/leaderboard).

## Free badges (any GitHub user, any tracked repo)

Drop a live Scout Score in your GitHub profile README, or a Commit Momentum tier on any tracked repo. Auto-updates, free, no signup, same shields.io look as Codecov / WakaTime.

```markdown
[![Scout Score](https://signals.gitdealflow.com/api/badge/scout/YOUR-GITHUB-HANDLE/svg)](https://signals.gitdealflow.com/badge-builder)
[![Commit Momentum](https://signals.gitdealflow.com/api/badge/momentum/ORG/REPO/svg)](https://signals.gitdealflow.com/badge-builder)
```

Generator with copy-paste markdown / HTML / BBCode at [signals.gitdealflow.com/badge-builder](https://signals.gitdealflow.com/badge-builder).

## Links

- Website: https://gitdealflow.com
- Dashboard: https://signals.gitdealflow.com
- Agent runtime install matrix: https://signals.gitdealflow.com/integrations/agent-runtimes
- Scout Game: https://signals.gitdealflow.com/predict
- Leaderboard: https://signals.gitdealflow.com/leaderboard
- Badge builder: https://signals.gitdealflow.com/badge-builder
- JSON API: https://signals.gitdealflow.com/api/signals.json
- Twitter/X: https://x.com/data_nerd

## License

MIT
