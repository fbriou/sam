import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
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
      {
        name: "manage_tasks",
        description:
          "Add, complete, or list tasks/todos. Tasks are stored in the vault as Obsidian-friendly markdown. " +
          "Use this when the user mentions something to do, a reminder, or a task.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["add", "complete", "list"],
              description:
                "The action: add a new task, complete an existing one, or list all open tasks",
            },
            text: {
              type: "string",
              description:
                "For 'add': the task description. For 'complete': text to match against existing tasks.",
            },
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Priority level for new tasks (default: medium)",
            },
            due: {
              type: "string",
              description: "Optional due date in YYYY-MM-DD format",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "gdrive_create_file",
        description:
          "Create a file on Google Drive. The file is written locally first, then uploaded via rclone.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path on Google Drive (e.g. 'poems/hello.txt' or 'notes/idea.md')",
            },
            content: {
              type: "string",
              description: "The content to write into the file",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "gdrive_list",
        description:
          "List files and folders on Google Drive at a given path.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to list (e.g. '' for root, 'vault/' for vault folder). Default: root.",
              default: "",
            },
          },
        },
      },
      {
        name: "gdrive_read",
        description:
          "Read the content of a file from Google Drive.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path of the file on Google Drive (e.g. 'poems/hello.txt')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "gdrive_delete",
        description:
          "Delete a file or folder from Google Drive.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to delete on Google Drive (e.g. 'poems/hello.txt')",
            },
          },
          required: ["path"],
        },
      },
    ],
  };
});

// Helper: run rclone command and return output
function rcloneExec(args: string): string {
  return execSync(`rclone ${args}`, {
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

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

      case "manage_tasks": {
        const { action, text, priority = "medium", due } =
          request.params.arguments as {
            action: "add" | "complete" | "list";
            text?: string;
            priority?: string;
            due?: string;
          };

        const tasksPath = join(VAULT_PATH, "tasks.md");

        // Read or initialize tasks file
        let tasksContent: string;
        if (existsSync(tasksPath)) {
          tasksContent = readFileSync(tasksPath, "utf-8");
        } else {
          tasksContent = "# Tasks\n";
        }

        switch (action) {
          case "add": {
            if (!text) {
              return {
                content: [
                  { type: "text", text: "Error: 'text' is required to add a task." },
                ],
                isError: true,
              };
            }
            const parts = [`- [ ] ${text} #${priority}`];
            if (due) parts.push(`[due:: ${due}]`);
            const taskLine = parts.join(" ");
            tasksContent = tasksContent.trimEnd() + "\n" + taskLine + "\n";
            writeFileSync(tasksPath, tasksContent, "utf-8");
            return {
              content: [{ type: "text", text: `Task added: ${taskLine}` }],
            };
          }
          case "complete": {
            if (!text) {
              return {
                content: [
                  { type: "text", text: "Error: 'text' is required to identify the task." },
                ],
                isError: true,
              };
            }
            const lines = tasksContent.split("\n");
            let found = false;
            const today = new Date().toISOString().split("T")[0];
            for (let i = 0; i < lines.length; i++) {
              if (
                lines[i].includes("- [ ]") &&
                lines[i].toLowerCase().includes(text.toLowerCase())
              ) {
                lines[i] =
                  lines[i].replace("- [ ]", "- [x]") +
                  ` [completed:: ${today}]`;
                found = true;
                break;
              }
            }
            if (!found) {
              return {
                content: [
                  {
                    type: "text",
                    text: `No matching open task found for: "${text}"`,
                  },
                ],
              };
            }
            writeFileSync(tasksPath, lines.join("\n"), "utf-8");
            return {
              content: [{ type: "text", text: "Task completed." }],
            };
          }
          case "list": {
            const openTasks = tasksContent
              .split("\n")
              .filter((l) => l.includes("- [ ]"));
            if (openTasks.length === 0) {
              return {
                content: [{ type: "text", text: "No open tasks." }],
              };
            }
            return {
              content: [
                {
                  type: "text",
                  text: `Open tasks (${openTasks.length}):\n\n${openTasks.join("\n")}`,
                },
              ],
            };
          }
        }
        break;
      }

      case "gdrive_create_file": {
        const { path: filePath, content } = request.params.arguments as {
          path: string;
          content: string;
        };

        const tmpDir = "/tmp/sam-gdrive";
        const tmpFile = join(tmpDir, filePath);
        const tmpFileDir = join(tmpDir, filePath, "..");
        execSync(`mkdir -p "${tmpFileDir}"`);
        writeFileSync(tmpFile, content, "utf-8");

        const gdrivePath = filePath.includes("/")
          ? filePath.substring(0, filePath.lastIndexOf("/"))
          : "";
        const dest = gdrivePath ? `gdrive:${gdrivePath}/` : "gdrive:";
        rcloneExec(`copy "${tmpFile}" "${dest}"`);

        return {
          content: [
            {
              type: "text",
              text: `File created on Google Drive: ${filePath}`,
            },
          ],
        };
      }

      case "gdrive_list": {
        const { path: listPath = "" } = (request.params.arguments || {}) as {
          path?: string;
        };

        const target = listPath ? `gdrive:${listPath}` : "gdrive:";
        let output: string;
        try {
          output = rcloneExec(`lsf "${target}" --max-depth 1`);
        } catch {
          output = "(empty or path not found)";
        }

        return {
          content: [
            {
              type: "text",
              text: output || "(empty folder)",
            },
          ],
        };
      }

      case "gdrive_read": {
        const { path: readPath } = request.params.arguments as {
          path: string;
        };

        const tmpRead = `/tmp/sam-gdrive-read-${Date.now()}`;
        try {
          rcloneExec(`copy "gdrive:${readPath}" "${tmpRead}"`);
          const fileName = readPath.split("/").pop()!;
          const content = readFileSync(join(tmpRead, fileName), "utf-8");
          execSync(`rm -rf "${tmpRead}"`);
          return {
            content: [{ type: "text", text: content }],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `File not found on Google Drive: ${readPath}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "gdrive_delete": {
        const { path: deletePath } = request.params.arguments as {
          path: string;
        };

        try {
          rcloneExec(`deletefile "gdrive:${deletePath}"`);
          return {
            content: [
              {
                type: "text",
                text: `Deleted from Google Drive: ${deletePath}`,
              },
            ],
          };
        } catch {
          // Try as directory
          try {
            rcloneExec(`purge "gdrive:${deletePath}"`);
            return {
              content: [
                {
                  type: "text",
                  text: `Deleted folder from Google Drive: ${deletePath}`,
                },
              ],
            };
          } catch {
            return {
              content: [
                {
                  type: "text",
                  text: `Not found on Google Drive: ${deletePath}`,
                },
              ],
              isError: true,
            };
          }
        }
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
