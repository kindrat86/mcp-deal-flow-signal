# Security Policy

## Supported versions

Only the latest minor release of `@gitdealflow/mcp-signal` is actively patched.

| Version | Status | Patches |
|---------|--------|---------|
| 1.6.x   | Current — actively patched | All security fixes backported |
| 1.5.x   | Maintenance — critical only | High/Critical CVE patches only |
| < 1.5   | Unsupported | No further updates |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Email **signal@gitdealflow.com** with subject prefix `[security]`.

Include:
- A description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- Affected versions
- Impact assessment in your own words

You will receive an acknowledgement within **48 hours**. We aim to confirm-or-reject within 7 days and ship a fix within 30 days for critical issues.

## Scope

In scope:
- The published `@gitdealflow/mcp-signal` npm package
- The mirrored source at `github.com/kindrat86/mcp-deal-flow-signal`
- The HTTPS API at `signals.gitdealflow.com/api/*` that the MCP server calls

Out of scope:
- Vulnerabilities in MCP clients themselves (Claude Desktop, Cursor, etc.) — please report those to the respective vendors
- Social engineering, physical attacks, denial-of-service against the gitdealflow.com data backend
- Issues that require an attacker to already control the user's machine (the MCP server runs in the user's local Node.js process by design)

## Coordinated disclosure

We follow standard 90-day coordinated disclosure. If a fix lands sooner, we will publish the advisory at that time. Severe issues with active exploitation may receive a shorter window.

## Cryptographic notes

This server does not handle authentication, secrets, or PII. It calls the public read-only API at `signals.gitdealflow.com`. There are no API keys, tokens, or credentials stored locally — except an anonymous installation UUID at `~/.gitdealflow-mcp/id` (used solely for usage telemetry, disable with `GITDEALFLOW_MCP_TELEMETRY=0` or `DO_NOT_TRACK=1`).
