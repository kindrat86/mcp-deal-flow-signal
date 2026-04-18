# VC Deal Flow Signal — MCP Server

Search startup engineering acceleration signals directly from your AI assistant.

![Claude querying VC Deal Flow Signal MCP server](https://gitdealflow.com/mcp-demo.gif)

Tracks commit velocity, contributor growth, and repository expansion across 20 sectors. Built for seed/Series A investors looking for traction signals before they show up in traditional deal flow.

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

## Links

- Website: https://gitdealflow.com
- Dashboard: https://signals.gitdealflow.com
- JSON API: https://signals.gitdealflow.com/api/signals.json
- Twitter/X: https://x.com/data_nerd

## License

MIT
