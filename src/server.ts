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
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://signals.gitdealflow.com";
const UA = "gitdealflow-mcp/1.2.0";
const FOOTER = "— Powered by gitdealflow.com";

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
      "RETURNS: `{ period, startups[20], citation, source }`. Each startup row contains rank, name, sector, stage, geography, commitVelocity14d, commitVelocityChange, contributors, contributorGrowth, newRepos, signalType ('breakout' | 'acceleration' | 'steady' | 'cooling'), description, githubUrl, profileUrl.",
      "",
      "TYPICAL WORKFLOW: `get_trending_startups` → pick a name → `get_startup_signal(name)` for the deep-dive → `get_methodology` if the user questions the ranking.",
      "",
      "LIMITATIONS: Only covers startups with a meaningful open-source footprint. Does not include funding, revenue, headcount, or stealth companies — pair with Crunchbase / LinkedIn MCPs for the full picture. No historical series — each call is the latest weekly snapshot only.",
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
      "RETURNS: `{ sector: {slug, name, description, url}, period, startupCount, startups[], citation }`. Each startup row contains rank, name, sector, stage, geography, commitVelocity14d, commitVelocityChange, contributors, contributorGrowth, newRepos, signalType, description, githubUrl, profileUrl.",
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
      "LIMITATIONS: Only returns data for the ~400 currently-tracked startups. No historical series — each call is the latest weekly snapshot only. No relationship data (investors, cap table, team) — pair with Crunchbase / LinkedIn MCPs for those facets.",
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

const server = new Server(
  { name: "vc-deal-flow-signal", version: "1.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
