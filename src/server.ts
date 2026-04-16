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
const UA = "gitdealflow-mcp/1.0.0";

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

const TOOLS = [
  {
    name: "get_trending_startups",
    description:
      "Get the top 20 trending startups by engineering acceleration across all sectors. Returns startup name, commit velocity change, contributors, signal type, and sector. Use this to find which startups are showing the strongest GitHub momentum right now.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "search_startups_by_sector",
    description:
      "Get startups ranked by engineering acceleration for a specific sector. Available sectors: ai-ml, fintech, cybersecurity, developer-tools, healthcare, climate-tech, enterprise-saas, data-infrastructure, web3, robotics, edtech, ecommerce-infrastructure, supply-chain, legal-tech, hr-tech, proptech, agtech, gaming, space-tech, social-community.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sector: {
          type: "string",
          description:
            "Sector slug, e.g. 'ai-ml', 'fintech', 'cybersecurity'",
        },
      },
      required: ["sector"],
    },
  },
  {
    name: "get_startup_signal",
    description:
      "Get the engineering signal profile for a specific startup. Returns commit velocity, contributor growth, new repos, signal type, stage, geography, and GitHub URL. Search by startup name or GitHub org name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Startup name or GitHub org name (e.g. 'roboflow', 'SkyPilot'). Case-insensitive.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_signals_summary",
    description:
      "Get a high-level summary of the VC Deal Flow Signal dataset: total sectors, startups tracked, current period, last refresh date, and links to all data formats (JSON, CSV, RSS, llms.txt).",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_methodology",
    description:
      "Get the full methodology: how startup engineering data is sourced from GitHub API, how metrics are calculated (commit velocity, contributor growth, signal classification), and known limitations.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

const server = new Server(
  { name: "vc-deal-flow-signal", version: "1.0.0" },
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
        const lines = trending.map(
          (s, i) =>
            `${i + 1}. ${s.name} — ${s.commitVelocityChange} velocity change, ${s.contributors} contributors, signal: ${s.signalType}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Top 20 Trending Startups (${data.meta.period.name})\n\n${lines.join("\n")}\n\nSource: ${BASE_URL}\nData: ${BASE_URL}/api/signals.json\nCitation: ${data.meta.citation}`,
            },
          ],
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
          };
        }
        const lines = sector.startups.map(
          (s, i) =>
            `${i + 1}. ${s.name} — ${s.commitVelocityChange} velocity change, ${s.contributors} contributors, signal: ${s.signalType}\n   ${s.description || "(no description)"}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `${sector.name} Startups (${data.meta.period.name})\n${sector.description}\n${sector.startups.length} startups tracked\n\n${lines.join("\n\n")}\n\nSource: ${BASE_URL}/startups-to-watch/${sectorSlug}-q2-2026\nCitation: ${data.meta.citation}`,
            },
          ],
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
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      }

      case "get_signals_summary": {
        const changelog = (await fetchJSON(
          "/api/changelog.json"
        )) as unknown as ChangelogData;
        const cp = changelog.currentPeriod;
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
                `- JSON API: ${BASE_URL}/api/signals.json`,
                `- CSV: ${BASE_URL}/api/signals.csv`,
                `- RSS: ${BASE_URL}/feed.xml`,
                `- OpenAPI: ${BASE_URL}/api/openapi.json`,
                `- LLMs.txt: ${BASE_URL}/llms.txt`,
                `- Full context: ${BASE_URL}/llms-full.txt`,
                `- AI policy: ${BASE_URL}/ai.txt`,
                ``,
                `Website: https://gitdealflow.com`,
                `Dashboard: ${BASE_URL}`,
                ``,
                `Citation: "VC Deal Flow Signal (signals.gitdealflow.com), ${cp.name} data."`,
              ].join("\n"),
            },
          ],
        };
      }

      case "get_methodology": {
        const text = await fetchText("/llms-full.txt");
        const methodSection =
          text.split("## Methodology")[1]?.split("## Glossary")[0] ?? "";
        return {
          content: [
            {
              type: "text" as const,
              text: `VC Deal Flow Signal — Methodology\n\n${methodSection.trim()}\n\nFull details: ${BASE_URL}/methodology`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
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
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
