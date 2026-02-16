# Pillar 5: Recipe Management

## Overview

Recipes are stored as individual markdown files in `vault/recipes/`. Each recipe has structured YAML frontmatter (title, ingredients, servings, tags) and a markdown body with instructions. They're Obsidian-compatible and sync to Google Drive via rclone.

## How It Works

1. User shares a recipe with Sam via Telegram
2. Sam extracts structured data (title, ingredients, instructions, tags)
3. Sam calls `manage_recipes(action: "add")` MCP tool
4. Recipe is saved as `vault/recipes/<slug>.md`
5. File syncs to Google Drive via rclone
6. Recipe is searchable via `manage_recipes(action: "search")`

## Recipe Format

```markdown
---
title: Pasta al Pomodoro
servings: 4
prepTime: 15 min
cookTime: 30 min
tags:
  - italian
  - pasta
  - vegetarian
ingredients:
  - 400g spaghetti
  - 2 cloves garlic
  - 1 can crushed tomatoes
---

## Instructions

1. Boil water, cook pasta
2. Sauté garlic, add tomatoes, simmer 20 min
3. Toss and serve

## Notes

Can be frozen for 3 months.
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Recipe name |
| ingredients | array | Yes | List of ingredients with quantities |
| servings | number | No | Number of servings |
| prepTime | string | No | Preparation time (e.g. "15 min") |
| cookTime | string | No | Cooking time (e.g. "30 min") |
| tags | array | No | Categories (e.g. ["italian", "pasta"]) |

## MCP Tool: manage_recipes

| Action | Parameters | Description |
|--------|------------|-------------|
| add | title, ingredients, instructions, servings?, prepTime?, cookTime?, tags?, notes? | Create a new recipe |
| list | — | List all recipes with titles and tags |
| read | title (slug) | Read full recipe content |
| search | query | Search recipes by name, ingredients, or tags |
| delete | title (slug) | Delete a recipe |

### Search

Text-based search without embeddings (works without `ANTHROPIC_API_KEY`):

- Title match: 50 points
- Ingredient match: 30 points
- Tag match: 20 points
- Body match: 10 points

Results are sorted by score descending.

## Key Files

| File | Purpose |
|------|---------|
| `src/mcp/server.ts` | MCP tool definition + handler |
| `src/claude/client.ts` | Tool registered in allowedTools |
| `runtime/CLAUDE.md` | Documents when/how Sam uses the tool |
| `vault/skills/recipe.md` | Skill instructions for recipe handling |
| `src/mcp/recipes.test.ts` | Unit tests |

## Phase 2 (Deferred)

- Meal planning with Google Calendar integration
- Shopping list generation
- Recipe scaling (adjust servings)
