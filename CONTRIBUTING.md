# Contributing

This is the public mirror of the `mcp-server/` subfolder of the private parent repo. **Pull requests filed against this mirror cannot be merged directly** — they will be rebased onto the parent and the mirror re-synced.

If you want to contribute, the cleanest path is:

## 1. Open an issue first

Bug? Feature idea? Open an issue using one of the templates. We respond within 48 hours.

## 2. Suggest a patch

If you have a code suggestion, post a unified diff or a fork link in the issue. The author will rebase it onto the private parent and credit you in the commit message.

## 3. Direct contributor agreement

For substantial contributions (a new MCP tool, a major refactor), email signal@gitdealflow.com first to discuss scope. Larger contributions usually deserve a co-author line in the SSRN paper as well.

---

## Local development

```bash
git clone https://github.com/kindrat86/mcp-deal-flow-signal.git
cd mcp-deal-flow-signal
npm install
npm run build
```

The MCP server reads live data from `https://signals.gitdealflow.com` — there is no local data setup required.

## Testing the server

```bash
# Run the built server with a test prompt
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

## Code style

- TypeScript strict mode (see `tsconfig.json`)
- No external dependencies beyond `@modelcontextprotocol/sdk`
- Each tool MUST include `WHEN TO USE` / `DO NOT USE FOR` / `BEHAVIOR` / `PARAMETERS` / `RETURNS` sections in its description (see `share_result` for the canonical pattern)

## What's NOT accepted

- Telemetry that captures anything beyond tool name + duration
- Authentication tokens or stored credentials in client logic (the server is stateless by design)
- Adding new dependencies without a strong justification — every dep increases supply-chain risk for users running the server in their AI client
