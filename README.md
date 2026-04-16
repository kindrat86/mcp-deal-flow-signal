# VC Deal Flow Signal — MCP Server

Search startup engineering acceleration signals directly from your AI assistant.

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

| Tool | Description |
|---|---|
| `get_trending_startups` | Top 20 startups by engineering acceleration |
| `search_startups_by_sector` | Startups ranked within a specific sector |
| `get_startup_signal` | Signal profile for a specific startup |
| `get_signals_summary` | Dataset overview, formats, and links |
| `get_methodology` | How signals are calculated |

## Data

All data is sourced live from [signals.gitdealflow.com](https://signals.gitdealflow.com) public API. No API key required. Updated weekly on Mondays.

## Links

- Website: https://gitdealflow.com
- Dashboard: https://signals.gitdealflow.com
- JSON API: https://signals.gitdealflow.com/api/signals.json
- Twitter/X: https://x.com/data_nerd

## License

MIT
