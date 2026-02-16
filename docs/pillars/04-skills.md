# Pillar 4: Skills Registry

## Overview

Skills are single markdown files that define specialized capabilities for the assistant. They live in `vault/skills/` and are symlinked to `.claude/skills/` so Claude Code loads them natively.

## How Skills Work

1. You create a `.md` file in `vault/skills/` using Obsidian
2. The file contains YAML frontmatter (description) and instructions
3. It's symlinked to `.claude/skills/` which Claude Code reads
4. When Claude Code processes a message that matches a skill's domain, it applies the instructions
5. CLAUDE.md lists available skills so the assistant knows what's available

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

## How the Symlink Works

```bash
.claude/skills -> ../vault/skills
```

This means:
- `vault/skills/summarize.md` is accessible as `.claude/skills/summarize.md`
- Claude Code sees it as a native skill
- You edit skills in Obsidian (via vault/) — they sync to Google Drive — rclone pulls to VPS
- No restart needed — Claude Code reads skills fresh on each invocation
