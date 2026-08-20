# VC Deal Flow Signal — MCP Server

Search startup engineering acceleration signals directly from your AI assistant.

[![Glama A-Tier](https://glama.ai/mcp/servers/@kindrat86/vc-deal-flow-signal/badge)](https://glama.ai/mcp/servers/@kindrat86/vc-deal-flow-signal)

> Glama A-Tier (4.9 / 5.0). 13 tools — 10 free, no API key. One-line install for Claude Desktop, Claude Code, Cursor, Cline, and Continue via `npx -y @gitdealflow/mcp-signal`.

![Claude querying VC Deal Flow Signal MCP server](https://gitdealflow.com/mcp-demo.gif)

Tracks commit velocity, contributor growth, and repository expansion across 15 sectors and 350+ startups. Built for angels, scouts, and technical operators looking for traction signals before they show up in traditional deal flow.

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

**Free tools (10) — no API key, no account:**

| Tool | Input | Returns |
|---|---|---|
| `get_trending_startups` | — | Top 20 startups ranked by engineering acceleration across all sectors. |
| `search_startups_by_sector` | `sector` (enum of 15 slugs) | All tracked startups in the sector, ranked by acceleration. |
| `get_startup_signal` | `name` (case-insensitive) | Full signal profile for one startup: velocity, contributors, repos, classification. |
| `get_signals_summary` | — | Dataset snapshot — period, counts, refresh date, format URLs, citation. |
| `get_methodology` | — | How signals are sourced, computed, and classified, with known limitations. |
| `shortlist_signals` | filters (sector, stage, geography, signal type) | Ranked shortlist of the strongest engineering-acceleration signals matching your filters. |
| `compare_signals` | 2–5 startup names | Side-by-side acceleration scores, evidence, and raise-likelihood for the named startups. |
| `predict_funding` | `name` | Transparent, scored funding-likelihood claim with the full evidence chain, citable. |
| `get_diligence_dossier` | company/entity name | Public-source diligence dossier in one cited object — M&A history, funding, key facts. |
| `get_scout_receipts` | GitHub username | Scout Score (0–100) computed from public starring history, cross-referenced against tracked startups. |

**Paid agent tools (3) — €0.10 per call, credits at [signals.gitdealflow.com/agents/credits](https://signals.gitdealflow.com/agents/credits):**

| Tool | Returns |
|---|---|
| `research_company` | Enriched dossier for one tracked startup: full signal row, sector rank, top-5 sector peers, citation. |
| `compose_thesis` | Structured investment thesis: snapshot, signal type, sector rank, data-derived strengths, peer comparables. |
| `deep_dive_scan` | Multi-cohort sector scan: tracked/breakout/cooling counts, top-10 by velocity, breakout and cold lists. |

The hosted remote endpoint (`https://signals.gitdealflow.com/api/mcp/rpc`, streamable-http) additionally exposes `share_result` (free) and `get_deep_signal` (€0.19/call).

**Supported sectors:** `healthcare`, `edtech`, `ecommerce-infrastructure`, `supply-chain`, `web3`, `enterprise-saas`, `data-infrastructure`, `robotics`, `legal-tech`, `hr-tech`, `proptech`, `agtech`, `gaming`, `space-tech`, `social-community`.

## Data

All data is sourced live from [the deal flow data API](https://signals.gitdealflow.com) public API. No API key required. Updated weekly on Mondays.

- Live CSV: https://signals.gitdealflow.com/api/signals.csv
- Live JSON: https://signals.gitdealflow.com/api/signals.json
- Stable CC BY 4.0 research snapshot: https://huggingface.co/datasets/the-data-nerd/vc-deal-flow-signal
- DOI-stamped release: https://doi.org/10.5281/zenodo.19650920

## Complementary: the Scout Game

If you want to put your own eye on the line, there's a prediction game on top of the same dataset at [signals.gitdealflow.com/predict](https://signals.gitdealflow.com/predict). Call which tracked startups raise a round in the next 6 months, earn points when your calls resolve, climb a public rank ladder from Curious to Oracle. Free tier: 3 predictions per month. Paid: 10 per month. Leaderboard: [signals.gitdealflow.com/leaderboard](https://signals.gitdealflow.com/leaderboard).

## Complementary: two Chrome extensions

Same dataset, different surfaces. Install one or both:

- **[VC Deal Flow Signal — Crunchbase + Wellfound badge](https://chromewebstore.google.com/detail/hehkgipiamajnnlpkfhpeoeaoaogmknn)**: a green "Accelerating" engineering-acceleration badge appears inline on any Crunchbase or Wellfound startup profile where the GitHub data is interesting. For investors who research deals in browser tabs.
- **[VC GitHub Lookup — Startup Signals on Hover](https://chromewebstore.google.com/detail/vc-github-lookup-%E2%80%94-startu/plgngijmloeljfkenecdkhiblcfcbblm)** (NEW, May 2026): hover any GitHub repo or org link to see commit velocity (14d), velocity change vs prior period, contributor count and growth, signal type, and stage estimate. Chip injected on direct repo and org page loads. Toolbar opens a manual lookup form for any GitHub URL. For developer-investors who live on GitHub.

Both are free in perpetuity. Manifest V3, no analytics, no account.

## Links

- Website: https://gitdealflow.com
- Dashboard: https://signals.gitdealflow.com
- Scout Game: https://signals.gitdealflow.com/predict
- Leaderboard: https://signals.gitdealflow.com/leaderboard
- Chrome extension #1 (Crunchbase + Wellfound badge): https://chromewebstore.google.com/detail/hehkgipiamajnnlpkfhpeoeaoaogmknn
- Chrome extension #2 (VC GitHub Lookup — hover): https://chromewebstore.google.com/detail/vc-github-lookup-%E2%80%94-startu/plgngijmloeljfkenecdkhiblcfcbblm
- JSON API: https://signals.gitdealflow.com/api/signals.json
- Twitter/X: https://x.com/data_nerd

## License

MIT
