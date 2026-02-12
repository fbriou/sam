# ADR-001: Claude Code CLI as the LLM Brain

## Status

Accepted

## Context

We need an LLM backend for the personal assistant. The two main options are:

1. **Anthropic API directly** (`@anthropic-ai/sdk`): Call the API with custom system prompts, manage context manually
2. **Claude Code CLI** (`claude -p`): Spawn the CLI tool for each interaction, leveraging its built-in features

## Decision

Use Claude Code CLI (`claude -p`) as the primary conversational engine.

Use the Anthropic SDK directly only for the heartbeat (background checks with Haiku model).

## Rationale

### Why Claude Code CLI

- **Subscription-based**: Uses the existing Claude subscription on the local dev machine. No per-token API billing for conversations during development.
- **CLAUDE.md auto-loaded**: Personality, rules, and project context are loaded automatically without manual prompt construction.
- **MCP servers**: Custom MCP servers (like our memory/RAG server) are available natively. Claude Code manages the MCP lifecycle.
- **Skills**: Skill files in `.claude/skills/` are loaded automatically. New skills can be added by creating a file — no code changes.
- **Hooks**: Post-invocation hooks can trigger actions (like conversation summarization).
- **Session management**: Built-in session persistence via `--session-id` or `--resume`.
- **Output formats**: Supports `--output-format json` for structured parsing.

### Why Anthropic SDK for heartbeat

- Heartbeat checks are one-shot (no session needed)
- Uses Haiku model (much cheaper than Sonnet)
- Doesn't consume Claude Code subscription rate limits
- Simpler — no need for CLI process spawning for a simple prompt

### Trade-offs

| Aspect | Claude Code CLI | Direct API |
|--------|----------------|------------|
| Cost (dev) | Subscription (included) | Pay per token |
| Cost (VPS) | API key (pay per token) | Same |
| Latency | Higher (process spawn ~1-2s) | Lower (~0.5s) |
| Features | CLAUDE.md, MCP, skills, hooks, sessions | Manual prompt management |
| Complexity | Thin orchestrator | Full prompt builder needed |
| Portability | Requires Claude Code installed | Any Node.js runtime |

### On the VPS

On the VPS, Claude Code uses `ANTHROPIC_API_KEY` (API billing), so the subscription cost advantage doesn't apply there. However, the feature advantages (CLAUDE.md, MCP, skills) still justify the approach. The architecture is the same locally and on VPS.

## Consequences

- Claude Code CLI must be installed on the NixOS server (done globally via `npm install -g`)
- Process spawning adds ~1-2s latency per message
- Authentication on VPS requires `ANTHROPIC_API_KEY` (API billing)
- If we ever need to switch to direct API, the `src/claude/client.ts` wrapper is the only file that changes
