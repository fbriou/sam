import { spawn } from "child_process";
import { join } from "path";

export interface ClaudeResult {
  text: string;
  sessionId: string;
}

export interface ClaudeOptions {
  sessionId?: string;
  outputFormat?: "json" | "text" | "stream-json";
  maxTurns?: number;
  appendSystemPrompt?: string;
  model?: string;
  cwd?: string;
}

/**
 * Spawn the Claude Code CLI in print mode (-p) and return the response.
 *
 * This is the core integration point: every Telegram message becomes a
 * `claude -p` invocation. Claude Code automatically loads CLAUDE.md,
 * MCP servers from .claude/settings.json, and skills from .claude/skills/.
 *
 * Sessions are keyed by Telegram chat ID so each conversation has continuity.
 */
export function spawnClaude(
  message: string,
  opts: ClaudeOptions = {}
): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const args = ["-p", message];

    // Output format defaults to json for structured parsing
    args.push("--output-format", opts.outputFormat || "json");

    // Session management: each Telegram chat gets its own session
    if (opts.sessionId) {
      args.push("--session-id", opts.sessionId);
    }

    // Limit agentic turns to prevent runaway execution
    if (opts.maxTurns) {
      args.push("--max-turns", String(opts.maxTurns));
    }

    // Additional system prompt (appended to CLAUDE.md context)
    if (opts.appendSystemPrompt) {
      args.push("--append-system-prompt", opts.appendSystemPrompt);
    }

    // Model override (useful for switching to Haiku for simple queries)
    if (opts.model) {
      args.push("--model", opts.model);
    }

    const proc = spawn("claude", args, {
      cwd: opts.cwd || join(process.cwd(), "runtime"),
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn claude CLI: ${err.message}. Is Claude Code installed?`
        )
      );
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`claude exited with code ${code}: ${stderr.trim()}`)
        );
      }

      try {
        if (opts.outputFormat === "text") {
          resolve({ text: stdout.trim(), sessionId: "" });
          return;
        }

        const json = JSON.parse(stdout);
        resolve({
          text: json.result || json.content || stdout.trim(),
          sessionId: json.session_id || "",
        });
      } catch {
        // If JSON parsing fails, return raw output
        resolve({ text: stdout.trim(), sessionId: "" });
      }
    });

    // Close stdin — claude -p reads the prompt from args, not stdin
    proc.stdin.end();
  });
}
