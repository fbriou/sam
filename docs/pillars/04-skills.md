# Pillar 4: Skills Registry

## Overview

Skills are single markdown files that define specialized capabilities for the assistant. They live in `vault/skills/` and are loaded at runtime via `runtime/.claude/skills` (a symlink recreated on deploy).

> **Note:** The root `.claude/skills` symlink was removed — it was only needed during initial setup. Skills are Sam's runtime bot instructions, not Claude Code development skills. Development slash commands live in `.claude/commands/`.

## How Skills Work

1. You create a `.md` file in `vault/skills/` using Obsidian
2. The file contains YAML frontmatter (description) and instructions
3. On the VPS, `runtime/.claude/skills` symlinks to `vault/skills/` (recreated by deploy-app action)
4. `runtime/CLAUDE.md` lists available skills so the assistant knows what's available
5. You edit skills in Obsidian → they sync to Google Drive → rclone pulls to VPS

## Skill File Format

```markdown
---
description: Short description of what the skill does
---

Detailed instructions for the assistant when using this skill.
Include rules, formatting preferences, and examples.
```

### Required Fields

| Field | Purpose |
|-------|---------|
| `description` (frontmatter) | Short description shown in Claude Code's skill list |
| Body (markdown) | Full instructions, rules, and examples |

## Current Skills

| Skill | File | Purpose |
|-------|------|---------|
| summarize | `vault/skills/summarize.md` | Summarize texts into bullet points |
| diagram | `vault/skills/diagram.md` | Generate Mermaid diagrams |
| translate | `vault/skills/translate.md` | Translate between languages |
| recipe | `vault/skills/recipe.md` | Save, find, and manage cooking recipes |

## Adding a New Skill

1. Create a new `.md` file in `vault/skills/` (use Obsidian)
2. Add YAML frontmatter with a `description`
3. Write the instructions in the body
4. Update `CLAUDE.md` to list the new skill
5. That's it — the symlink ensures Claude Code picks it up automatically

### Example: Creating a "code-review" Skill

Create `vault/skills/code-review.md`:

```markdown
---
description: Review code snippets and suggest improvements
---

When asked to review code:

1. Check for bugs and logic errors
2. Suggest performance improvements
3. Note security concerns (OWASP top 10)
4. Recommend cleaner patterns if applicable
5. Be specific — mention line numbers and exact changes

Format: Use a numbered list. Each item should have:
- **Issue**: What's wrong
- **Fix**: How to fix it
- **Severity**: Low / Medium / High
```

## How the Runtime Symlink Works

On the VPS, the deploy-app action creates:

```bash
runtime/.claude/skills -> /var/lib/sam/vault/skills
```

This means:
- `vault/skills/summarize.md` is accessible to the Agent SDK at runtime
- You edit skills in Obsidian (via vault/) → they sync to Google Drive → rclone pulls to VPS
- No restart needed — the Agent SDK reads skills fresh on each invocation
