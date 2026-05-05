# Changelog

All notable changes to `@gitdealflow/mcp-signal` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] — 2026-05-05

### Added

- **`share_result` tool** — generates ready-to-share social-media posts (Twitter, Bluesky, Mastodon, LinkedIn, Telegram) about a result the agent just produced from another tool. Returns post bodies, character counts per platform, and one-click intent URLs to compose the post in each network. Built for agents that want to surface their findings without leaving the chat.

### Changed

- Bumped `SERVER_VERSION` constant to `1.6.0`

### Notes

- 7 tools total: `get_trending_startups`, `search_startups_by_sector`, `get_startup_signal`, `get_signals_summary`, `get_scout_receipts`, `get_deep_signal`, `get_methodology`, `share_result` (new)

## [1.5.4] — 2026-05-02

### Changed

- Documentation polish on tool descriptions
- Methodology link consistency

## [1.5.0] — 2026-04-30

### Added

- `get_deep_signal` — paid per-request tier (€0.19/call, 100 credits = €19), credit ledger on Stripe customer metadata, HMAC API key embeds customer ID

## [1.4.0] — 2026-04-22

### Added

- `get_scout_receipts` — public per-user signal-prediction track records

## [1.3.0] — 2026-04-15

### Changed

- 5-tool baseline established: `get_trending_startups`, `search_startups_by_sector`, `get_startup_signal`, `get_signals_summary`, `get_methodology`
- Glama A-tier scoring achieved across all tools

## [1.0.0] — 2026-04-08

### Added

- Initial MCP server release with `get_trending_startups`, `search_startups_by_sector`, and `get_methodology`

[1.6.0]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.6.0
[1.5.4]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.5.4
[1.5.0]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.5.0
[1.4.0]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.4.0
[1.3.0]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.3.0
[1.0.0]: https://github.com/kindrat86/mcp-deal-flow-signal/releases/tag/v1.0.0
