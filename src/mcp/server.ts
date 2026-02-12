import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { searchMemory } from "../memory/rag.js";

/**
 * Sam Memory MCP Server
 *
 * This server exposes RAG tools to Claude Code via the Model Context Protocol.
 * When Claude Code runs `claude -p`, it connects to this MCP server and can
 * use these tools to search memories and get conversation context.
 *
 * Registered in .claude/settings.json:
 * {
 *   "mcpServers": {
 *     "sam-memory": {
 *       "command": "node",
 *       "args": ["dist/mcp/server.js"]
 *     }
 *   }
 * }
 */

const VAULT_PATH = process.env.VAULT_PATH || "./vault";
const DB_PATH = process.env.DB_PATH || "./data/sam.db";

// Initialize database connection
function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  sqliteVec.load(db);
  return db;
}

const server = new Server(
  {
    name: "sam-memory",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_memory",
        description:
          "Search past conversations and vault content by semantic similarity. " +
          "Use this when the user references past discussions, projects, or decisions.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant memories",
            },
            limit: {
              type: "number",
              description:
                "Maximum number of results to return (default: 5)",
              default: 5,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_recent_conversations",
        description:
          "Get the most recent conversation messages for immediate context.",
        inputSchema: {
          type: "object",
          properties: {
            n: {
              type: "number",
              description: "Number of recent messages to return (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "save_memory",
        description:
          "Save an important fact or decision for future recall. " +
          "Use this when the user mentions something worth remembering.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The content to save as a memory",
            },
            source: {
              type: "string",
              description:
                'Optional source label (e.g. "conversation", "decision")',
              default: "manual",
            },
          },
          required: ["content"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDb();

  try {
    switch (request.params.name) {
      case "search_memory": {
        const { query, limit = 5 } = request.params.arguments as {
          query: string;
          limit?: number;
        };

        const results = await searchMemory(db, query, limit);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No relevant memories found for this query.",
              },
            ],
          };
        }

        const formatted = results
          .map(
            (r, i) =>
              `[${i + 1}] (source: ${r.sourceFile}, relevance: ${(1 - r.distance).toFixed(2)})\n${r.content}`
          )
          .join("\n\n---\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} relevant memories:\n\n${formatted}`,
            },
          ],
        };
      }

      case "get_recent_conversations": {
        const { n = 10 } = (request.params.arguments || {}) as {
          n?: number;
        };

        const messages = db
          .prepare(
            "SELECT role, content, created_at FROM conversations ORDER BY created_at DESC LIMIT ?"
          )
          .all(n) as Array<{
          role: string;
          content: string;
          created_at: string;
        }>;

        if (messages.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No conversation history found.",
              },
            ],
          };
        }

        // Reverse to show oldest first
        const formatted = messages
          .reverse()
          .map((m) => `[${m.created_at}] ${m.role}: ${m.content}`)
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Last ${messages.length} messages:\n\n${formatted}`,
            },
          ],
        };
      }

      case "save_memory": {
        const { content, source = "manual" } = request.params.arguments as {
          content: string;
          source?: string;
        };

        // Save as a chunk (embedding will be done separately)
        db.prepare(
          "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, 0, ?)"
        ).run(`manual/${source}`, content);

        return {
          content: [
            {
              type: "text",
              text: `Memory saved: "${content.slice(0, 100)}..."`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  } finally {
    db.close();
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] Sam Memory MCP server running");
}

main().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
