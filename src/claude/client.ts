import { join } from "path";
import { readFileSync } from "fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeResult {
  text: string;
  sessionId: string;
}

// Load Sam's personality once at startup
const runtimeDir = join(process.cwd(), "runtime");
const samPrompt = readFileSync(join(runtimeDir, "CLAUDE.md"), "utf-8");

/**
 * Lightweight query for simple tasks (heartbeat, summarization).
 * No MCP servers, no tools, no session resume — just a prompt and a response.
 */
export async function simpleQuery(
  prompt: string,
  opts: { model?: string } = {}
): Promise<string> {
  let text = "";

  const q = query({
    prompt,
    options: {
      maxTurns: 1,
      permissionMode: "dontAsk",
      ...(opts.model ? { model: opts.model } : {}),
    },
  });

  for await (const msg of q) {
    if (msg.type === "result" && msg.subtype === "success") {
      text = (msg as SDKResultSuccess).result;
    }
  }

  return text;
}

/**
 * Ask Claude via the Agent SDK.
 *
 * - systemPrompt: Sam personality loaded directly (avoids CLAUDE.md hierarchy issues)
 * - mcpServers: sam-memory configured explicitly (no settingSources needed)
 * - WebSearch: enabled for online lookups
 * - Session resume: for conversation continuity across messages
 */
export async function askClaude(
  message: string,
  opts: { sessionId?: string; model?: string } = {}
): Promise<ClaudeResult> {
  let text = "";
  let resultSessionId = "";

  const q = query({
    prompt: message,
    options: {
      systemPrompt: samPrompt,
      cwd: runtimeDir,
      mcpServers: {
        "sam-memory": {
          command: "node",
          args: [join(runtimeDir, "../dist/mcp/server.js")],
          env: {
            VAULT_PATH: join(runtimeDir, "../vault"),
            DB_PATH: join(runtimeDir, "../data/sam.db"),
          },
        },
      },
      tools: ["Bash", "WebSearch", "AskUserQuestion", "TodoWrite", "TaskOutput"],
      allowedTools: [
        "Bash",
        "WebSearch",
        "AskUserQuestion",
        "TodoWrite",
        "TaskOutput",
        "mcp__sam-memory__search_memory",
        "mcp__sam-memory__get_recent_conversations",
        "mcp__sam-memory__save_memory",
        "mcp__sam-memory__manage_tasks",
        "mcp__sam-memory__manage_recipes",
        "mcp__sam-memory__gdrive_create_file",
        "mcp__sam-memory__gdrive_list",
        "mcp__sam-memory__gdrive_read",
        "mcp__sam-memory__gdrive_delete",
      ],
      maxTurns: 10,
      permissionMode: "dontAsk",
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.sessionId ? { resume: opts.sessionId } : {}),
    },
  });

  try {
    for await (const msg of q) {
      if (msg.type === "result" && msg.subtype === "success") {
        const success = msg as SDKResultSuccess;
        text = success.result;
        resultSessionId = success.session_id;
      } else if (msg.type === "result") {
        const error = msg as SDKResultError;
        console.error(
          `[claude] SDK returned ${error.subtype} after ${error.num_turns} turns`,
          error.errors?.length ? `— ${error.errors.join("; ")}` : ""
        );
        resultSessionId = error.session_id;
      }
    }
  } catch (err) {
    // If resume fails (stale session), retry without resume
    if (opts.sessionId && err instanceof Error && err.message.includes("session")) {
      console.log("[claude] Session resume failed, starting fresh session");
      return askClaude(message, { ...opts, sessionId: undefined });
    }
    throw err;
  }

  return { text, sessionId: resultSessionId };
}
