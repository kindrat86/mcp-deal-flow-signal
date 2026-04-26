#!/usr/bin/env node
/**
 * VC Deal Flow Signal — MCP Server
 *
 * Exposes startup engineering acceleration data for AI agents.
 * Data sourced live from signals.gitdealflow.com public API.
 *
 * Install: npx @gitdealflow/mcp-signal
 * Or add to claude_desktop_config.json / .mcp.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SERVER_VERSION = "1.4.0";
const BASE_URL = "https://signals.gitdealflow.com";
const UA = `gitdealflow-mcp/${SERVER_VERSION}`;
const FOOTER = "— Powered by gitdealflow.com";

const TELEMETRY_DISABLED =
  process.env.GITDEALFLOW_MCP_TELEMETRY === "0" ||
  process.env.DO_NOT_TRACK === "1";
const POSTHOG_KEY = "phc_lyZCgvTpicjLzAO3rY2GhxuX5WUc5jQjP8ZVwwJqauX";
const POSTHOG_HOST = "https://eu.i.posthog.com";

function loadOrCreateDistinctId(): string {
  const dir = join(homedir(), ".gitdealflow-mcp");
  const file = join(dir, "id");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    const id = randomUUID();
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, id, "utf8");
    } catch {
      // best-effort; if FS is read-only, generate ephemeral id per session
    }
    return id;
  }
}

const DISTINCT_ID = TELEMETRY_DISABLED ? "" : loadOrCreateDistinctId();

function captureEvent(event: string, properties: Record<string, unknown>): void {
  if (TELEMETRY_DISABLED) return;
  // Fire-and-forget; never block tool response on telemetry
  fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: DISTINCT_ID,
      properties: { ...properties, server_version: SERVER_VERSION },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // swallow — telemetry must never break the server
  });
}

if (!TELEMETRY_DISABLED) {
  process.stderr.write(
    `[gitdealflow-mcp] anonymous usage telemetry enabled (tool name + duration only, no input/output data). Disable with GITDEALFLOW_MCP_TELEMETRY=0 or DO_NOT_TRACK=1.\n`
  );
}

async function fetchJSON(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path}`);
  return res.text();
}

interface Startup {
  name: string;
  description: string;
  stage: string;
  geography: string;
  commitVelocity14d: number;
  commitVelocityChange: string;
  contributors: number;
  contributorGrowth: string;
  newRepos: number;
  signalType: string;
  githubUrl: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  profileUrl?: string;
}

interface Sector {
  slug: string;
  name: string;
  description: string;
  startupCount: number;
  startups: Startup[];
  url: string;
}

interface SignalsData {
  meta: { period: { name: string }; citation: string };
  trending: Startup[];
  sectors: Sector[];
}

interface ChangelogData {
  currentPeriod: {
    name: string;
    sectorsActive: number;
    startupsTracked: number;
    lastDataRefresh: string;
  };
}

const SECTOR_SLUGS = [
  "ai-ml",
  "fintech",
  "cybersecurity",
  "developer-tools",
  "healthcare",
  "climate-tech",
  "enterprise-saas",
  "data-infrastructure",
  "web3",
  "robotics",
  "edtech",
  "ecommerce-infrastructure",
  "supply-chain",
  "legal-tech",
  "hr-tech",
  "proptech",
  "agtech",
  "gaming",
  "space-tech",
  "social-community",
] as const;

const STARTUP_ITEM_SCHEMA = {
  type: "object" as const,
  description:
    "A single startup ranked by engineering acceleration, as derived from public GitHub activity.",
  properties: {
    rank: { type: "integer", description: "1-indexed rank within this result set." },
    name: { type: "string", description: "Startup or GitHub org name." },
    sector: { type: "string", description: "Sector the startup is classified into." },
    stage: {
      type: "string",
      description: "Funding stage if known (e.g. 'Seed', 'Series A', 'Unknown').",
    },
    geography: { type: "string", description: "Headquarters region if known." },
    commitVelocity14d: {
      type: "number",
      description: "Commits across tracked repos in the trailing 14 days.",
    },
    commitVelocityChange: {
      type: "string",
      description:
        "Percentage change in commit velocity vs. the prior 14-day window, e.g. '+142%'.",
    },
    contributors: {
      type: "integer",
      description: "Distinct contributors active in the last 30 days.",
    },
    contributorGrowth: {
      type: "string",
      description: "Percentage change in contributor count vs. the prior 30-day window.",
    },
    newRepos: {
      type: "integer",
      description: "New public repositories created in the last 30 days.",
    },
    signalType: {
      type: "string",
      description:
        "Classification label. Common values: 'breakout' (sudden surge), 'acceleration' (sustained growth), 'steady' (healthy baseline), 'cooling' (declining).",
    },
    description: { type: "string", description: "One-line summary of the startup." },
    githubUrl: { type: "string", format: "uri", description: "Primary GitHub org URL." },
    websiteUrl: {
      type: "string",
      format: "uri",
      description:
        "Official company homepage, harvested from the GitHub org `blog` field when the org exposes one. Absent for roughly 10% of records where the org has no `blog` value.",
    },
    linkedinUrl: {
      type: "string",
      format: "uri",
      description:
        "LinkedIn company page URL, when known. Populated opportunistically — often absent.",
    },
    profileUrl: {
      type: "string",
      format: "uri",
      description: "Public profile page on gitdealflow.com, when available.",
    },
  },
  required: [
    "rank",
    "name",
    "commitVelocityChange",
    "contributors",
    "signalType",
    "githubUrl",
  ],
};

const TOOLS = [
  {
    name: "get_trending_startups",
    title: "Get Trending Startups",
    description: [
      "Return the top 20 startups ranked by engineering acceleration across all 20 sectors for the current reporting period. Each row includes commit velocity, contributor count, signal classification, and GitHub URL.",
      "",
      "WHEN TO USE:",
      "- A VC, scout, or analyst asks 'who's trending this week', 'what's hot right now', 'who should I look at', or 'what to watch'.",
      "- You need a fresh cross-sector shortlist for a deal-flow meeting or weekly watchlist.",
      "- You want to surface breakout companies before they appear in Crunchbase / PitchBook / press.",
      "",
      "DO NOT USE FOR:",
      "- Narrowing to one vertical — call `search_startups_by_sector` instead.",
      "- Looking up a named company — call `get_startup_signal` with the company name.",
      "- Explaining the ranking methodology — call `get_methodology`.",
      "- Discovering what sectors exist or how fresh the data is — call `get_signals_summary`.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent, no side effects. Safe to call repeatedly.",
      "- Deterministic within a 7-day window: the dataset refreshes every Monday ~09:00 UTC, so identical calls within the same week return identical results.",
      "- No authentication required. No rate limit enforced by this server; the upstream CDN absorbs typical agent traffic.",
      "- Returns exactly 20 rows when the dataset is healthy; fewer only if the upstream feed is degraded.",
      "- On upstream failure: returns `isError: true` with the HTTP status in the text block — retry once after a short delay before escalating to the user.",
      "- Open-world: the tracked universe (~400 companies) evolves week to week as new orgs qualify or drop out.",
      "",
      "PARAMETERS: None.",
      "",
      "RETURNS: `{ period, startups[20], citation, source }`. Each startup row contains rank, name, sector, stage, geography, commitVelocity14d, commitVelocityChange, contributors, contributorGrowth, newRepos, signalType ('breakout' | 'acceleration' | 'steady' | 'cooling'), description, githubUrl, websiteUrl (when known, ~90% coverage), linkedinUrl (when known, partial coverage), profileUrl.",
      "",
      "TYPICAL WORKFLOW: `get_trending_startups` → pick a name → `get_startup_signal(name)` for the deep-dive → `get_methodology` if the user questions the ranking.",
      "",
      "LIMITATIONS: Only covers startups with a meaningful open-source footprint. Does not include funding, revenue, headcount, or stealth companies — pair with Crunchbase for cap-table and round data. No historical series — each call is the latest weekly snapshot only.",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string",
          description: "Reporting period label, e.g. 'Q2 2026'.",
        },
        startups: {
          type: "array",
          description: "Top 20 startups ranked by engineering acceleration.",
          items: STARTUP_ITEM_SCHEMA,
        },
        citation: {
          type: "string",
          description: "Suggested citation string for reports.",
        },
        source: { type: "string", format: "uri" },
      },
      required: ["period", "startups", "citation", "source"],
    },
    annotations: {
      title: "Get Trending Startups",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "search_startups_by_sector",
    title: "Search Startups by Sector",
    description: [
      "Return every tracked startup within one of 20 supported sectors, ranked by engineering acceleration for the current reporting period.",
      "",
      "WHEN TO USE:",
      "- The user names a specific vertical: 'show me AI/ML startups', 'who's moving in fintech?', 'cybersecurity deal flow', 'climate-tech picks'.",
      "- You need a focused list for a thesis-driven investor or a sector report.",
      "- You're comparing momentum inside a defined market before a sourcing cycle.",
      "",
      "DO NOT USE FOR:",
      "- Cross-sector discovery — call `get_trending_startups` for the top-20 across all sectors.",
      "- Looking up a named company — call `get_startup_signal(name)`.",
      "- Discovering which sectors exist or how many startups are tracked overall — call `get_signals_summary` (it returns live counts and URLs).",
      "- Multi-sector filtering — the tool accepts exactly one slug per call; issue parallel calls if you need several.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent, no side effects.",
      "- Deterministic within a 7-day window: dataset refreshes every Monday ~09:00 UTC.",
      "- No authentication required. No rate limit enforced by this server.",
      "- Returns between 5 and 30 startups per sector depending on open-source density. Dense: ai-ml, developer-tools, data-infrastructure. Sparse: legal-tech, proptech, agtech.",
      "- On unknown sector slug: returns `isError: true` with the full list of valid slugs in `structuredContent.availableSectors` so the agent can retry with a correct value.",
      "- On upstream failure: returns `isError: true` with the HTTP status.",
      "- Open-world: the tracked universe changes week to week.",
      "",
      "PARAMETERS:",
      "- `sector` (required, string) — MUST be one of the 20 enumerated slugs in `inputSchema.properties.sector.enum`. Map fuzzy user input BEFORE calling: 'AI' / 'artificial intelligence' / 'ML' → 'ai-ml'; 'crypto' / 'blockchain' → 'web3'; 'cyber' / 'infosec' / 'security' → 'cybersecurity'; 'SaaS' → 'enterprise-saas'; 'devtools' / 'developer experience' → 'developer-tools'; 'climate' / 'clean energy' / 'cleantech' → 'climate-tech'; 'biotech' / 'health' / 'medtech' → 'healthcare'; 'data' / 'databases' → 'data-infrastructure'; 'real estate' → 'proptech'; 'agriculture' → 'agtech'; 'space' → 'space-tech'; 'games' → 'gaming'; 'community' / 'social' → 'social-community'; 'logistics' → 'supply-chain'; 'law' / 'legal' → 'legal-tech'; 'recruiting' / 'HR' → 'hr-tech'; 'learning' / 'education' → 'edtech'; 'commerce' / 'retail infra' → 'ecommerce-infrastructure'; 'hardware' / 'drones' → 'robotics'. If no mapping is clear, call `get_signals_summary` and ask the user to pick.",
      "",
      "RETURNS: `{ sector: {slug, name, description, url}, period, startupCount, startups[], citation }`. Each startup row contains rank, name, sector, stage, geography, commitVelocity14d, commitVelocityChange, contributors, contributorGrowth, newRepos, signalType, description, githubUrl, websiteUrl (when known), linkedinUrl (when known), profileUrl.",
      "",
      "TYPICAL WORKFLOW: `search_startups_by_sector('fintech')` → pick a name → `get_startup_signal(name)` → `get_methodology` if the user asks what the signal type means.",
      "",
      "LIMITATIONS: One sector slug per call; no free-text sector search. For cross-sector views use `get_trending_startups`. No historical series — each call is the latest weekly snapshot only.",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {
        sector: {
          type: "string",
          description:
            "Sector slug. Must be one of the 20 supported values. Map fuzzy user input to the closest slug (e.g. 'AI' → 'ai-ml', 'crypto' → 'web3', 'cyber' → 'cybersecurity', 'SaaS' → 'enterprise-saas').",
          enum: [...SECTOR_SLUGS],
          examples: ["ai-ml", "fintech", "cybersecurity", "developer-tools"],
        },
      },
      required: ["sector"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        sector: {
          type: "object",
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            url: { type: "string", format: "uri" },
          },
          required: ["slug", "name"],
        },
        period: { type: "string" },
        startupCount: { type: "integer" },
        startups: {
          type: "array",
          description: "Startups within the sector, ranked by engineering acceleration.",
          items: STARTUP_ITEM_SCHEMA,
        },
        citation: { type: "string" },
      },
      required: ["sector", "period", "startupCount", "startups", "citation"],
    },
    annotations: {
      title: "Search Startups by Sector",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_startup_signal",
    title: "Get Startup Signal Profile",
    description: [
      "Return the full engineering-acceleration profile for a single tracked startup: commit velocity, velocity change, contributor count and growth, new-repo count, signal classification, sector, stage, geography, and GitHub URL.",
      "",
      "WHEN TO USE:",
      "- The user names a specific company: 'tell me about Roboflow', 'what's Supabase's signal?', 'is Modular trending?', 'lookup SkyPilot'.",
      "- Preparing a deal memo, one-pager, or investor update about a named startup.",
      "- Verifying whether a startup is in the tracked universe before writing analysis.",
      "",
      "DO NOT USE FOR:",
      "- Discovering unknown companies or fuzzy exploration ('any good AI startups?') — call `get_trending_startups` or `search_startups_by_sector` first, then drill in here.",
      "- Listing candidates in a sector — call `search_startups_by_sector`.",
      "- Explaining what the signalType means — call `get_methodology`.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent, no side effects.",
      "- Deterministic within a 7-day window: dataset refreshes every Monday ~09:00 UTC.",
      "- No authentication required.",
      "- Matching is case-insensitive and normalization-tolerant: whitespace, punctuation, and capitalization are stripped before comparison. 'Sky Pilot', 'skypilot', and 'SkyPilot' all resolve to the same entry. Accepts either the display name or the GitHub org slug.",
      "- On no match: returns `structuredContent: { found: false, suggestion: ... }`. This is an EXPECTED outcome (the startup is not in the tracked universe), NOT an error — do not retry, do not flag as failure. Instead surface the suggestion to the user and offer to run `get_trending_startups` or `search_startups_by_sector`.",
      "- On upstream failure: returns `isError: true` with HTTP status.",
      "- Open-world: only ~400 companies are tracked. This tool cannot add new ones — direct the user to the website submission form if needed.",
      "",
      "PARAMETERS:",
      "- `name` (required, string, 1–100 chars) — Startup display name OR GitHub org name. Case-insensitive; punctuation and whitespace are ignored during matching.",
      "",
      "RETURNS: `{ found: boolean, startup?: {...}, suggestion?: string, citation }`. When `found=true`, `startup` contains rank, name, sector, stage, geography, commitVelocity14d, commitVelocityChange, contributors, contributorGrowth, newRepos, signalType, description, githubUrl, profileUrl. When `found=false`, `suggestion` explains how to discover the correct name.",
      "",
      "TYPICAL WORKFLOW: `get_trending_startups` or `search_startups_by_sector` (discover) → pick a name → `get_startup_signal(name)` (deep-dive) → `get_methodology` (explain signal classification in the response).",
      "",
      "LIMITATIONS: Only returns data for currently-tracked startups. No historical series — each call is the latest weekly snapshot only. No relationship data (investors, cap table, team) — pair with Crunchbase for those facets.",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Startup name or GitHub org name. Case-insensitive; punctuation and whitespace are ignored during matching.",
          minLength: 1,
          maxLength: 100,
          examples: ["roboflow", "SkyPilot", "Supabase", "Hugging Face"],
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        found: { type: "boolean" },
        startup: STARTUP_ITEM_SCHEMA,
        suggestion: {
          type: "string",
          description:
            "When found=false, a hint on how to discover the correct name or alternative tools to call.",
        },
        citation: { type: "string" },
      },
      required: ["found"],
    },
    annotations: {
      title: "Get Startup Signal Profile",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_signals_summary",
    title: "Get Dataset Summary",
    description: [
      "Return a high-level snapshot of the VC Deal Flow Signal dataset: current reporting period, number of active sectors, total startups tracked, last-refresh timestamp, update frequency, citation string, and direct URLs to every data format (JSON, CSV, RSS, OpenAPI, llms.txt, full context, AI policy).",
      "",
      "WHEN TO USE:",
      "- Starting a research session and you want to know what data exists and how fresh it is.",
      "- Verifying freshness ('is this data from this week?') before including the numbers in an investor memo.",
      "- The user asks 'what is this service?', 'how do I cite your data?', or 'where can I download the CSV?'.",
      "- You need a bulk-download URL (CSV) or a feed URL (RSS) to pipe into another tool.",
      "- You need to show the user the full list of supported sectors before calling `search_startups_by_sector`.",
      "",
      "DO NOT USE FOR:",
      "- Fetching the actual startup rows — use `get_trending_startups` or `search_startups_by_sector`.",
      "- Explaining HOW signals are computed — use `get_methodology`.",
      "- Looking up a single startup — use `get_startup_signal`.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent, no side effects.",
      "- Deterministic within a 7-day window: dataset metadata refreshes every Monday ~09:00 UTC alongside the rest of the feed.",
      "- No authentication required.",
      "- Hits `/api/changelog.json` only — the lightest endpoint in the suite. Safe to call once at the start of every session.",
      "- On upstream failure: returns `isError: true` with HTTP status.",
      "",
      "PARAMETERS: None.",
      "",
      "RETURNS: `{ period, sectorsActive, startupsTracked, lastDataRefresh (ISO 8601), updateFrequency, formats: { json, csv, rss, openapi, llmsTxt, llmsFullTxt, aiPolicy }, website, dashboard, citation }`.",
      "",
      "TYPICAL WORKFLOW: `get_signals_summary` (orient, check freshness) → `get_trending_startups` or `search_startups_by_sector` (explore) → `get_startup_signal(name)` (deep-dive) → `get_methodology` (explain).",
      "",
      "LIMITATIONS: Current-period snapshot only — no historical period metadata. For reproducing past weeks, download the CSV at `formats.csv` and archive it yourself (it's overwritten each Monday).",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        period: { type: "string" },
        sectorsActive: { type: "integer" },
        startupsTracked: { type: "integer" },
        lastDataRefresh: { type: "string", description: "ISO 8601 date." },
        updateFrequency: { type: "string" },
        formats: {
          type: "object",
          properties: {
            json: { type: "string", format: "uri" },
            csv: { type: "string", format: "uri" },
            rss: { type: "string", format: "uri" },
            openapi: { type: "string", format: "uri" },
            llmsTxt: { type: "string", format: "uri" },
            llmsFullTxt: { type: "string", format: "uri" },
            aiPolicy: { type: "string", format: "uri" },
          },
        },
        website: { type: "string", format: "uri" },
        dashboard: { type: "string", format: "uri" },
        citation: { type: "string" },
      },
      required: [
        "period",
        "sectorsActive",
        "startupsTracked",
        "lastDataRefresh",
        "formats",
        "citation",
      ],
    },
    annotations: {
      title: "Get Dataset Summary",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_scout_receipts",
    title: "Get GitHub Scout Receipts",
    description: [
      "Compute a Scout Score (0-100) for a GitHub user from their public starring history. Cross-references the user's starred repos against a curated database of ~75 validated unicorns (Series A+, $1B+ valuations, acquisitions, 25K+ stars in last 5 years) and grades how many they starred *before* the validation event.",
      "",
      "WHEN TO USE:",
      "- The user wants to evaluate a developer's investment taste retroactively (e.g. 'how good is @sindresorhus at spotting unicorns?').",
      "- Vetting a potential angel investor or scout based on their public OSS taste.",
      "- Comparing two developers' early-call track records.",
      "- Generating shareable proof-of-taste content for a developer profile.",
      "",
      "DO NOT USE FOR:",
      "- Fetching live trending startups — use `get_trending_startups`.",
      "- Forward-looking predictions on whether a startup will raise — direct the user to https://signals.gitdealflow.com/predict (browser-only, not yet a tool).",
      "- Looking up a startup's signal score — use `get_startup_signal`.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent within a 24h window.",
      "- Hits `/api/receipts/{username}` which fetches public starring data from GitHub then scores against the validated-wins database.",
      "- 24-hour CDN cache; same username re-queried within 24h is served from cache.",
      "- No authentication required from the MCP client. Server-side uses a fine-grained PAT for elevated GitHub rate limits.",
      "- On user not found: returns `isError: true` with HTTP 404.",
      "- On GitHub rate limit: returns `isError: true` with HTTP 503.",
      "",
      "PARAMETERS: `github_username` (required) — GitHub username, 1-39 chars, alphanumeric + hyphens.",
      "",
      "RETURNS: `{ username, score, rank ('curious'|'scout'|'sharp'|'elite'|'oracle'), total_stars, matched_count, early_count, top_wins[], personality, share_url, og_image_url }`. `top_wins` lists up to 8 entries with org, name, event, starred_at, months_early, weight, points. `personality` is a one-paragraph templated commentary on the user's taste pattern.",
      "",
      "TYPICAL WORKFLOW: User asks 'is @X a good scout?' → `get_scout_receipts({ github_username: 'X' })` → quote the score, top wins, and personality, link the share_url for them to post.",
      "",
      "LIMITATIONS: The validated-wins database is biased toward developer-tools, AI, and data/ops companies with public GitHub presence. Closed-source unicorns are not represented — false negatives possible. Score reflects backwards-looking taste only; not a predictor of future calls.",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {
        github_username: {
          type: "string",
          description:
            "GitHub username to compute Receipts for. Must match the public GitHub username format: 1-39 chars, alphanumeric + single hyphens, no leading/trailing hyphen.",
          minLength: 1,
          maxLength: 39,
          pattern: "^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$",
        },
      },
      required: ["github_username"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" },
        score: { type: "integer", minimum: 0, maximum: 100 },
        rank: { type: "string", enum: ["curious", "scout", "sharp", "elite", "oracle"] },
        total_stars: { type: "integer" },
        matched_count: { type: "integer" },
        early_count: { type: "integer" },
        top_wins: {
          type: "array",
          items: {
            type: "object",
            properties: {
              org: { type: "string" },
              name: { type: "string" },
              repo: { type: "string" },
              event: { type: "string" },
              event_date: { type: "string" },
              starred_at: { type: "string" },
              months_early: { type: "number" },
              weight: { type: "number" },
              points: { type: "number" },
            },
          },
        },
        personality: { type: "string" },
        share_url: { type: "string", format: "uri" },
        og_image_url: { type: "string", format: "uri" },
      },
      required: ["username", "score", "rank", "matched_count", "early_count", "top_wins", "share_url"],
    },
    annotations: {
      title: "Get GitHub Scout Receipts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_methodology",
    title: "Get Signal Methodology",
    description: [
      "Return the full methodology behind VC Deal Flow Signal: how startup engineering activity is sourced from the public GitHub API, how commit velocity and contributor-growth metrics are computed, how signal types are classified ('breakout' | 'acceleration' | 'steady' | 'cooling'), the refresh cadence, and the known limitations.",
      "",
      "WHEN TO USE:",
      "- The user asks 'how is this calculated?', 'what does breakout mean?', 'can I trust this number?', or any trust / interpretability question.",
      "- You are writing a report, memo, or footnote and need a methodology section or citation.",
      "- Due-diligence / compliance wants to audit the data pipeline before citing it.",
      "- You need to explain why a specific signal was assigned (what triggers 'breakout' vs 'acceleration').",
      "",
      "DO NOT USE FOR:",
      "- Fetching the startup data itself — use `get_trending_startups`, `search_startups_by_sector`, or `get_startup_signal`.",
      "- Getting the list of supported sectors or the refresh date — use `get_signals_summary` (it returns live counts and freshness).",
      "- Confirming whether a specific startup is tracked — use `get_startup_signal`.",
      "",
      "BEHAVIOR:",
      "- Read-only, idempotent, no side effects.",
      "- Effectively static: methodology text is versioned with the service and only changes when the computation changes (rare — quarterly at most). Safe to call once per session and reuse across turns.",
      "- No authentication required.",
      "- Fetches `/llms-full.txt` and extracts the `## Methodology` section between the `## Methodology` and `## Glossary` headings. The canonical methodology URL is included in the response so agents can surface it for citations.",
      "- On upstream failure: returns `isError: true` with HTTP status.",
      "- On malformed upstream text (missing headings): returns an empty `methodology` string; still surfaces the canonical URL so the user can click through.",
      "",
      "PARAMETERS: None.",
      "",
      "RETURNS: `{ methodology: string, url: string }`. `methodology` is plain text covering data sources, metric definitions, classification thresholds, refresh cadence, and known limitations. `url` is the canonical methodology page at https://signals.gitdealflow.com/methodology — cite this URL in generated reports.",
      "",
      "TYPICAL WORKFLOW: User asks a trust / interpretability question → `get_methodology` → quote the relevant section in your response and link the canonical URL.",
      "",
      "LIMITATIONS: Returns one monolithic text block; no structured thresholds or versioning metadata are exposed via the tool. If you need the full service context (not just methodology), fetch `/llms-full.txt` directly via the URL returned in `get_signals_summary().formats.llmsFullTxt`.",
    ].join("\n"),
    inputSchema: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        methodology: { type: "string", description: "Plain-text methodology write-up." },
        url: {
          type: "string",
          format: "uri",
          description: "Canonical methodology page on gitdealflow.com.",
        },
      },
      required: ["methodology", "url"],
    },
    annotations: {
      title: "Get Signal Methodology",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

const RESOURCES = [
  {
    uri: "signal://trending",
    name: "Trending Startups (current week)",
    description:
      "Top 20 startups across all 20 sectors ranked by engineering acceleration for the current weekly period. Refreshes every Monday ~09:00 UTC.",
    mimeType: "application/json",
  },
  {
    uri: "signal://summary",
    name: "Dataset Summary",
    description:
      "Current period, active sector count, total startups tracked, last refresh timestamp, and direct URLs to every machine-readable format (JSON, CSV, RSS, OpenAPI, llms.txt).",
    mimeType: "application/json",
  },
  {
    uri: "signal://methodology",
    name: "Signal Methodology",
    description:
      "Full plain-text methodology covering data sources, metric computation, signal classification thresholds, refresh cadence, and known limitations.",
    mimeType: "text/markdown",
  },
];

const RESOURCE_TEMPLATES = [
  {
    uriTemplate: "signal://startup/{name}",
    name: "Startup Signal Profile",
    description:
      "Full engineering-acceleration profile for a single tracked startup. Substitute {name} with the display name or GitHub org slug; matching is case-insensitive and normalization-tolerant.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "signal://sector/{slug}",
    name: "Sector Signal Snapshot",
    description:
      "All tracked startups within a sector, ranked by engineering acceleration. {slug} must be one of: ai-ml, fintech, cybersecurity, developer-tools, healthcare, climate-tech, enterprise-saas, data-infrastructure, web3, robotics, edtech, ecommerce-infrastructure, supply-chain, legal-tech, hr-tech, proptech, agtech, gaming, space-tech, social-community.",
    mimeType: "application/json",
  },
];

const PROMPTS = [
  {
    name: "weekly_digest",
    description:
      "Generate a Monday-morning weekly digest from the latest top-20 trending startups: 3-line summary at top, then ranked picks with one-sentence rationales grounded in the signal data.",
    arguments: [],
  },
  {
    name: "sector_deep_dive",
    description:
      "Write a sector-focused intelligence brief: name the top movers, the breakout patterns, and what the data implies for thesis-driven investors. Pulls live data via search_startups_by_sector.",
    arguments: [
      {
        name: "sector",
        description:
          "Sector slug. Must be one of the 20 supported values (e.g. 'ai-ml', 'fintech', 'cybersecurity').",
        required: true,
      },
    ],
  },
  {
    name: "find_dark_horse",
    description:
      "Surface an under-the-radar startup that's accelerating quietly: filter by acceleration signal but a contributor count below the median for its sector. Useful for scout-tier picks.",
    arguments: [
      {
        name: "sector",
        description:
          "Optional sector slug to constrain the search. If omitted, searches across all sectors.",
        required: false,
      },
    ],
  },
  {
    name: "compare_startups",
    description:
      "Head-to-head comparison of two startups across velocity, contributor growth, new-repo count, and signal classification, with a recommendation for which one warrants deeper diligence.",
    arguments: [
      {
        name: "name_a",
        description: "First startup name or GitHub org slug.",
        required: true,
      },
      {
        name: "name_b",
        description: "Second startup name or GitHub org slug.",
        required: true,
      },
    ],
  },
  {
    name: "acceleration_memo",
    description:
      "Draft a one-page deal memo for a named startup: signal profile, sector context, leading-indicator interpretation, comparable companies, and suggested follow-up questions for a partner meeting. Pulls live data via get_startup_signal.",
    arguments: [
      {
        name: "name",
        description: "Startup display name or GitHub org slug.",
        required: true,
      },
    ],
  },
];

const server = new Server(
  { name: "vc-deal-flow-signal", version: SERVER_VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startedAt = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    switch (name) {
      case "get_trending_startups": {
        const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
        const trending = data.trending.slice(0, 20);
        const sectorByStartup = new Map<string, string>();
        for (const sector of data.sectors) {
          for (const s of sector.startups) {
            sectorByStartup.set(s.name, sector.name);
          }
        }

        const structured = {
          period: data.meta.period.name,
          startups: trending.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            sector: sectorByStartup.get(s.name) ?? "",
            stage: s.stage,
            geography: s.geography,
            commitVelocity14d: s.commitVelocity14d,
            commitVelocityChange: s.commitVelocityChange,
            contributors: s.contributors,
            contributorGrowth: s.contributorGrowth,
            newRepos: s.newRepos,
            signalType: s.signalType,
            description: s.description,
            githubUrl: s.githubUrl,
            ...(s.websiteUrl ? { websiteUrl: s.websiteUrl } : {}),
            ...(s.linkedinUrl ? { linkedinUrl: s.linkedinUrl } : {}),
            profileUrl: s.profileUrl,
          })),
          citation: data.meta.citation,
          source: BASE_URL,
        };

        const lines = trending.map(
          (s, i) =>
            `${i + 1}. ${s.name} — ${s.commitVelocityChange} velocity change, ${s.contributors} contributors, signal: ${s.signalType}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Top 20 Trending Startups (${data.meta.period.name})\n\n${lines.join("\n")}\n\nSource: ${BASE_URL}\nData: ${BASE_URL}/api/signals.json\nCitation: ${data.meta.citation}\n\n${FOOTER}`,
            },
          ],
          structuredContent: structured,
        };
      }

      case "search_startups_by_sector": {
        const sectorSlug = (args as { sector: string }).sector;
        const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
        const sector = data.sectors.find((s) => s.slug === sectorSlug);
        if (!sector) {
          const available = data.sectors.map((s) => s.slug).join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: `Sector "${sectorSlug}" not found. Available: ${available}`,
              },
            ],
            structuredContent: {
              sector: { slug: sectorSlug, name: "" },
              period: data.meta.period.name,
              startupCount: 0,
              startups: [],
              citation: data.meta.citation,
              error: `Sector "${sectorSlug}" not found.`,
              availableSectors: data.sectors.map((s) => s.slug),
            },
            isError: true,
          };
        }

        const structured = {
          sector: {
            slug: sector.slug,
            name: sector.name,
            description: sector.description,
            url: sector.url,
          },
          period: data.meta.period.name,
          startupCount: sector.startups.length,
          startups: sector.startups.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            sector: sector.name,
            stage: s.stage,
            geography: s.geography,
            commitVelocity14d: s.commitVelocity14d,
            commitVelocityChange: s.commitVelocityChange,
            contributors: s.contributors,
            contributorGrowth: s.contributorGrowth,
            newRepos: s.newRepos,
            signalType: s.signalType,
            description: s.description,
            githubUrl: s.githubUrl,
            ...(s.websiteUrl ? { websiteUrl: s.websiteUrl } : {}),
            ...(s.linkedinUrl ? { linkedinUrl: s.linkedinUrl } : {}),
            profileUrl: s.profileUrl,
          })),
          citation: data.meta.citation,
        };

        const lines = sector.startups.map(
          (s, i) =>
            `${i + 1}. ${s.name} — ${s.commitVelocityChange} velocity change, ${s.contributors} contributors, signal: ${s.signalType}\n   ${s.description || "(no description)"}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `${sector.name} Startups (${data.meta.period.name})\n${sector.description}\n${sector.startups.length} startups tracked\n\n${lines.join("\n\n")}\n\nSource: ${BASE_URL}/startups-to-watch/${sectorSlug}-q2-2026\nCitation: ${data.meta.citation}\n\n${FOOTER}`,
            },
          ],
          structuredContent: structured,
        };
      }

      case "get_startup_signal": {
        const inputName = (args as { name: string }).name;
        const slug = inputName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
        let found: Startup | null = null;
        let foundSector = "";

        for (const sector of data.sectors) {
          const match = sector.startups.find(
            (s) =>
              s.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") === slug
          );
          if (match) {
            found = match;
            foundSector = sector.name;
            break;
          }
        }

        if (!found) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Startup "${inputName}" not found. Try the GitHub org name exactly as it appears, or use get_trending_startups / search_startups_by_sector to browse.`,
              },
            ],
            structuredContent: {
              found: false,
              suggestion:
                "Try the exact GitHub org name, or call get_trending_startups / search_startups_by_sector to browse the tracked universe.",
              citation: data.meta.citation,
            },
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `${found.name} — Engineering Signal Profile`,
                ``,
                `Sector: ${foundSector}`,
                `Stage: ${found.stage}`,
                `Geography: ${found.geography}`,
                `Commit Velocity (14d): ${found.commitVelocity14d}`,
                `Velocity Change: ${found.commitVelocityChange}`,
                `Contributors: ${found.contributors}`,
                `Contributor Growth: ${found.contributorGrowth}`,
                `New Repos (30d): ${found.newRepos}`,
                `Signal Type: ${found.signalType}`,
                `GitHub: ${found.githubUrl}`,
                found.websiteUrl ? `Website: ${found.websiteUrl}` : null,
                found.linkedinUrl ? `LinkedIn: ${found.linkedinUrl}` : null,
                found.profileUrl ? `Profile: ${found.profileUrl}` : null,
                ``,
                found.description || "",
                ``,
                `Source: ${BASE_URL}`,
                `Citation: ${data.meta.citation}`,
                ``,
                FOOTER,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          structuredContent: {
            found: true,
            startup: {
              rank: 1,
              name: found.name,
              sector: foundSector,
              stage: found.stage,
              geography: found.geography,
              commitVelocity14d: found.commitVelocity14d,
              commitVelocityChange: found.commitVelocityChange,
              contributors: found.contributors,
              contributorGrowth: found.contributorGrowth,
              newRepos: found.newRepos,
              signalType: found.signalType,
              description: found.description,
              githubUrl: found.githubUrl,
              ...(found.websiteUrl ? { websiteUrl: found.websiteUrl } : {}),
              ...(found.linkedinUrl ? { linkedinUrl: found.linkedinUrl } : {}),
              profileUrl: found.profileUrl,
            },
            citation: data.meta.citation,
          },
        };
      }

      case "get_signals_summary": {
        const changelog = (await fetchJSON(
          "/api/changelog.json"
        )) as unknown as ChangelogData;
        const cp = changelog.currentPeriod;
        const formats = {
          json: `${BASE_URL}/api/signals.json`,
          csv: `${BASE_URL}/api/signals.csv`,
          rss: `${BASE_URL}/feed.xml`,
          openapi: `${BASE_URL}/api/openapi.json`,
          llmsTxt: `${BASE_URL}/llms.txt`,
          llmsFullTxt: `${BASE_URL}/llms-full.txt`,
          aiPolicy: `${BASE_URL}/ai.txt`,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `VC Deal Flow Signal — Data Summary`,
                ``,
                `Current Period: ${cp.name}`,
                `Sectors Active: ${cp.sectorsActive}`,
                `Startups Tracked: ${cp.startupsTracked}`,
                `Last Data Refresh: ${cp.lastDataRefresh}`,
                `Update Frequency: Weekly (Mondays)`,
                ``,
                `Data Formats:`,
                `- JSON API: ${formats.json}`,
                `- CSV: ${formats.csv}`,
                `- RSS: ${formats.rss}`,
                `- OpenAPI: ${formats.openapi}`,
                `- LLMs.txt: ${formats.llmsTxt}`,
                `- Full context: ${formats.llmsFullTxt}`,
                `- AI policy: ${formats.aiPolicy}`,
                ``,
                `Website: https://gitdealflow.com`,
                `Dashboard: ${BASE_URL}`,
                ``,
                `Citation: "VC Deal Flow Signal (signals.gitdealflow.com), ${cp.name} data."`,
                ``,
                FOOTER,
              ].join("\n"),
            },
          ],
          structuredContent: {
            period: cp.name,
            sectorsActive: cp.sectorsActive,
            startupsTracked: cp.startupsTracked,
            lastDataRefresh: cp.lastDataRefresh,
            updateFrequency: "Weekly (Mondays)",
            formats,
            website: "https://gitdealflow.com",
            dashboard: BASE_URL,
            citation: `VC Deal Flow Signal (signals.gitdealflow.com), ${cp.name} data.`,
          },
        };
      }

      case "get_scout_receipts": {
        const username = String(
          (request.params.arguments as Record<string, unknown> | undefined)
            ?.github_username ?? ""
        ).trim();
        if (
          !username ||
          !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
        ) {
          throw new Error(
            "Invalid github_username. Must be 1-39 chars, alphanumeric + single hyphens."
          );
        }
        const result = (await fetchJSON(
          `/api/receipts/${encodeURIComponent(username)}`
        )) as unknown as {
          username: string;
          score: number;
          rank: string;
          total_stars: number;
          matched_count: number;
          early_count: number;
          top_wins: Array<{
            org: string;
            name: string;
            repo: string;
            event: string;
            event_date: string;
            starred_at: string;
            months_early: number;
            weight: number;
            points: number;
          }>;
          personality?: string;
        };
        const shareUrl = `${BASE_URL}/receipts/${encodeURIComponent(username)}`;
        const ogImageUrl = `${BASE_URL}/api/og/receipts/${encodeURIComponent(username)}`;
        const topWinsText = result.top_wins
          .slice(0, 5)
          .map(
            (w, i) =>
              `${i + 1}. ${w.name} — starred ${w.months_early.toFixed(0)}mo before ${w.event} (+${Math.round(w.points)} pts)`
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `GitHub Scout Receipts for @${result.username}`,
                ``,
                `Scout Score: ${result.score} / 100  (rank: ${result.rank.toUpperCase()})`,
                `Validated wins matched: ${result.matched_count}  ·  Called early: ${result.early_count}  ·  Stars analyzed: ${result.total_stars}`,
                ``,
                `Top early calls:`,
                topWinsText || "(no early calls in our database)",
                ``,
                result.personality ? `Taste: ${result.personality}` : "",
                ``,
                `Shareable card: ${shareUrl}`,
                `OG image: ${ogImageUrl}`,
                ``,
                FOOTER,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          structuredContent: {
            ...result,
            share_url: shareUrl,
            og_image_url: ogImageUrl,
          },
        };
      }

      case "get_methodology": {
        const text = await fetchText("/llms-full.txt");
        const methodSection =
          text.split("## Methodology")[1]?.split("## Glossary")[0] ?? "";
        const methodology = methodSection.trim();
        const url = `${BASE_URL}/methodology`;
        return {
          content: [
            {
              type: "text" as const,
              text: `VC Deal Flow Signal — Methodology\n\n${methodology}\n\nFull details: ${url}\n\n${FOOTER}`,
            },
          ],
          structuredContent: { methodology, url },
        };
      }

      default:
        success = false;
        errorMessage = `unknown_tool:${name}`;
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  } finally {
    captureEvent("mcp_tool_called", {
      tool_name: name,
      duration_ms: Date.now() - startedAt,
      success,
      ...(errorMessage ? { error: errorMessage.slice(0, 200) } : {}),
    });
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCES,
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: RESOURCE_TEMPLATES,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const startedAt = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const trendingMatch = uri === "signal://trending";
    const summaryMatch = uri === "signal://summary";
    const methodologyMatch = uri === "signal://methodology";
    const startupMatch = uri.match(/^signal:\/\/startup\/(.+)$/);
    const sectorMatch = uri.match(/^signal:\/\/sector\/([a-z0-9-]+)$/);

    if (trendingMatch) {
      const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
      const sectorByStartup = new Map<string, string>();
      for (const sector of data.sectors) {
        for (const s of sector.startups) sectorByStartup.set(s.name, sector.name);
      }
      const payload = {
        period: data.meta.period.name,
        startups: data.trending.slice(0, 20).map((s, i) => ({
          rank: i + 1,
          name: s.name,
          sector: sectorByStartup.get(s.name) ?? "",
          stage: s.stage,
          geography: s.geography,
          commitVelocity14d: s.commitVelocity14d,
          commitVelocityChange: s.commitVelocityChange,
          contributors: s.contributors,
          contributorGrowth: s.contributorGrowth,
          newRepos: s.newRepos,
          signalType: s.signalType,
          description: s.description,
          githubUrl: s.githubUrl,
          ...(s.websiteUrl ? { websiteUrl: s.websiteUrl } : {}),
          ...(s.linkedinUrl ? { linkedinUrl: s.linkedinUrl } : {}),
          profileUrl: s.profileUrl,
        })),
        citation: data.meta.citation,
        source: BASE_URL,
      };
      return {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) },
        ],
      };
    }

    if (summaryMatch) {
      const changelog = (await fetchJSON(
        "/api/changelog.json"
      )) as unknown as ChangelogData;
      const cp = changelog.currentPeriod;
      const payload = {
        period: cp.name,
        sectorsActive: cp.sectorsActive,
        startupsTracked: cp.startupsTracked,
        lastDataRefresh: cp.lastDataRefresh,
        updateFrequency: "Weekly (Mondays)",
        formats: {
          json: `${BASE_URL}/api/signals.json`,
          csv: `${BASE_URL}/api/signals.csv`,
          rss: `${BASE_URL}/feed.xml`,
          openapi: `${BASE_URL}/api/openapi.json`,
          llmsTxt: `${BASE_URL}/llms.txt`,
          llmsFullTxt: `${BASE_URL}/llms-full.txt`,
          aiPolicy: `${BASE_URL}/ai.txt`,
          agentCard: `${BASE_URL}/.well-known/agent-card.json`,
          mcpManifest: `${BASE_URL}/.well-known/mcp.json`,
          agentsMd: `${BASE_URL}/.well-known/agents.md`,
        },
        website: "https://gitdealflow.com",
        dashboard: BASE_URL,
        citation: `VC Deal Flow Signal (signals.gitdealflow.com), ${cp.name} data.`,
      };
      return {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) },
        ],
      };
    }

    if (methodologyMatch) {
      const text = await fetchText("/llms-full.txt");
      const methodSection =
        text.split("## Methodology")[1]?.split("## Glossary")[0] ?? "";
      const methodology = `# VC Deal Flow Signal — Methodology\n\n${methodSection.trim()}\n\nFull details: ${BASE_URL}/methodology\n\n${FOOTER}`;
      return {
        contents: [{ uri, mimeType: "text/markdown", text: methodology }],
      };
    }

    if (startupMatch) {
      const inputName = decodeURIComponent(startupMatch[1]);
      const slug = inputName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
      let found: Startup | null = null;
      let foundSector = "";
      for (const sector of data.sectors) {
        const match = sector.startups.find(
          (s) =>
            s.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") === slug
        );
        if (match) {
          found = match;
          foundSector = sector.name;
          break;
        }
      }
      const payload = found
        ? {
            found: true,
            startup: {
              name: found.name,
              sector: foundSector,
              stage: found.stage,
              geography: found.geography,
              commitVelocity14d: found.commitVelocity14d,
              commitVelocityChange: found.commitVelocityChange,
              contributors: found.contributors,
              contributorGrowth: found.contributorGrowth,
              newRepos: found.newRepos,
              signalType: found.signalType,
              description: found.description,
              githubUrl: found.githubUrl,
              ...(found.websiteUrl ? { websiteUrl: found.websiteUrl } : {}),
              ...(found.linkedinUrl ? { linkedinUrl: found.linkedinUrl } : {}),
              profileUrl: found.profileUrl,
            },
            citation: data.meta.citation,
          }
        : {
            found: false,
            suggestion:
              "Try the exact GitHub org name, or read signal://trending or signal://sector/{slug} to browse the tracked universe.",
            citation: data.meta.citation,
          };
      return {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) },
        ],
      };
    }

    if (sectorMatch) {
      const sectorSlug = sectorMatch[1];
      const data = (await fetchJSON("/api/signals.json")) as unknown as SignalsData;
      const sector = data.sectors.find((s) => s.slug === sectorSlug);
      if (!sector) {
        success = false;
        errorMessage = `unknown_sector:${sectorSlug}`;
        const payload = {
          error: `Sector "${sectorSlug}" not found.`,
          availableSectors: data.sectors.map((s) => s.slug),
        };
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) },
          ],
        };
      }
      const payload = {
        sector: {
          slug: sector.slug,
          name: sector.name,
          description: sector.description,
          url: sector.url,
        },
        period: data.meta.period.name,
        startupCount: sector.startups.length,
        startups: sector.startups.map((s, i) => ({
          rank: i + 1,
          name: s.name,
          stage: s.stage,
          geography: s.geography,
          commitVelocity14d: s.commitVelocity14d,
          commitVelocityChange: s.commitVelocityChange,
          contributors: s.contributors,
          contributorGrowth: s.contributorGrowth,
          newRepos: s.newRepos,
          signalType: s.signalType,
          description: s.description,
          githubUrl: s.githubUrl,
          ...(s.websiteUrl ? { websiteUrl: s.websiteUrl } : {}),
          ...(s.linkedinUrl ? { linkedinUrl: s.linkedinUrl } : {}),
          profileUrl: s.profileUrl,
        })),
        citation: data.meta.citation,
      };
      return {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) },
        ],
      };
    }

    success = false;
    errorMessage = `unknown_uri:${uri}`;
    throw new Error(
      `Unknown resource URI: ${uri}. Valid: signal://trending, signal://summary, signal://methodology, signal://startup/{name}, signal://sector/{slug}.`
    );
  } finally {
    captureEvent("mcp_resource_read", {
      uri,
      duration_ms: Date.now() - startedAt,
      success,
      ...(errorMessage ? { error: errorMessage.slice(0, 200) } : {}),
    });
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, string>;
  const startedAt = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    let messageText = "";

    switch (name) {
      case "weekly_digest":
        messageText = [
          "You are writing a Monday-morning Signal Digest for venture investors.",
          "",
          "Step 1: Call the `get_trending_startups` tool to fetch the current top 20.",
          "Step 2: Open with three plain-English sentences naming the dominant pattern of the week (e.g. 'AI infra is breaking out — five of the top ten are inference-layer plays').",
          "Step 3: List the top 10 startups, one per line: `<rank>. <name> (<sector>) — <commitVelocityChange> velocity, <signalType>. <one-sentence rationale grounded in the signal>`.",
          "Step 4: Close with the citation string from the tool response and the source URL.",
          "",
          "Tone: factual, terse, no hype. No em-dashes. No 'I think' or 'in my opinion'. Investor-grade copy.",
        ].join("\n");
        break;

      case "sector_deep_dive": {
        const sector = a.sector;
        if (!sector) {
          throw new Error("Missing required argument: sector");
        }
        messageText = [
          `You are writing a sector intelligence brief for ${sector}.`,
          "",
          `Step 1: Call \`search_startups_by_sector\` with sector="${sector}".`,
          "Step 2: Identify the top 3 movers (highest commit-velocity-change) and the top 3 by contributor growth.",
          "Step 3: Name the dominant pattern (deploy-frequency spikes, infrastructure buildout, contributor expansion).",
          "Step 4: Surface 1-2 dark horses: startups with steady-but-quiet acceleration outside the top of the table.",
          "Step 5: Close with thesis-relevant follow-ups for a partner meeting.",
          "",
          "If the sector slug is unknown, the tool will return an `availableSectors` list — surface it to the user and stop.",
          "Tone: factual, terse, investor-grade. Cite the data with the citation string from the tool response.",
        ].join("\n");
        break;
      }

      case "find_dark_horse": {
        const sector = a.sector;
        messageText = [
          "You are surfacing one under-the-radar startup that's accelerating quietly — a scout-tier pick before it hits the Top 20.",
          "",
          sector
            ? `Step 1: Call \`search_startups_by_sector\` with sector="${sector}".`
            : "Step 1: Call `get_trending_startups` to get the current top 20, then call `search_startups_by_sector` for 2-3 sectors with the strongest signal density to widen the candidate pool.",
          "Step 2: Filter for: signalType in {acceleration, breakout} AND contributors below the sector median AND commitVelocityChange >= +50%. Drop anything in the top 5 of its sector — those are not dark horses.",
          "Step 3: Pick ONE recommendation. Justify in 4-5 sentences using the signal numbers (velocity change, contributor growth, new repos, sector context).",
          "Step 4: Add 2-3 follow-up questions an investor should answer before a first call.",
          "",
          "Tone: skeptical, evidence-first, investor-grade. No hype. Surface the GitHub URL so the reader can verify.",
        ].join("\n");
        break;
      }

      case "compare_startups": {
        const a_name = a.name_a;
        const b_name = a.name_b;
        if (!a_name || !b_name) {
          throw new Error("Missing required arguments: name_a and name_b");
        }
        messageText = [
          `You are writing a head-to-head investor comparison of ${a_name} vs ${b_name}.`,
          "",
          `Step 1: Call \`get_startup_signal\` for both names in parallel: name="${a_name}" and name="${b_name}".`,
          "Step 2: If either is `found: false`, surface the suggestion and stop — do not invent data.",
          "Step 3: Build a side-by-side comparison table covering: Stage, Geography, Commit Velocity (14d), Velocity Change, Contributors, Contributor Growth, New Repos (30d), Signal Type, Sector.",
          "Step 4: Below the table, write a 4-6 sentence verdict naming which warrants deeper diligence and why — grounded in the data, not guesswork.",
          "Step 5: List 2-3 follow-up due-diligence questions specific to the divergence between the two profiles.",
          "",
          "Tone: factual, neutral, investor-grade. Cite the data with the citation string.",
        ].join("\n");
        break;
      }

      case "acceleration_memo": {
        const startupName = a.name;
        if (!startupName) {
          throw new Error("Missing required argument: name");
        }
        messageText = [
          `You are drafting a one-page deal memo for ${startupName}.`,
          "",
          `Step 1: Call \`get_startup_signal\` with name="${startupName}".`,
          "Step 2: If `found: false`, surface the suggestion and stop.",
          "Step 3: Call `get_methodology` so you can correctly interpret the signalType.",
          `Step 4: Optionally call \`search_startups_by_sector\` with the startup's sector slug to surface 2-3 comparable companies.`,
          "Step 5: Draft the memo with these sections (no more than one page total):",
          "  • TL;DR (2 sentences, signal verdict + recommended action)",
          "  • Engineering Signal Profile (the data, with the methodology-grounded interpretation of signalType)",
          "  • Sector Context (where this fits, who the comparables are)",
          "  • Leading-Indicator Read (what the velocity + contributor + new-repo numbers imply about stage, hiring, and product motion)",
          "  • Open Questions (3-5 follow-ups for a partner meeting)",
          "",
          "Tone: factual, investor-grade. No hype. End with the citation string from the tool response.",
        ].join("\n");
        break;
      }

      default:
        success = false;
        errorMessage = `unknown_prompt:${name}`;
        throw new Error(`Unknown prompt: ${name}`);
    }

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: messageText },
        },
      ],
    };
  } finally {
    captureEvent("mcp_prompt_get", {
      prompt_name: name,
      duration_ms: Date.now() - startedAt,
      success,
      ...(errorMessage ? { error: errorMessage.slice(0, 200) } : {}),
    });
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
