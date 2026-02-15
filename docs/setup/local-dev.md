# Local Development Setup

## Prerequisites

- **Node.js 22+**: `node -v` should show v22.x or later
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
- **Telegram Bot**: Created via @BotFather (see [telegram-bot.md](telegram-bot.md))
- **Anthropic API Key or Claude subscription**: API key from [console.anthropic.com](https://console.anthropic.com), or log in via `claude auth login` to use your Pro/Max subscription

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/fbriou/sam.git sam
cd sam
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

```bash
cp .env.example .env
```

Fill in the required values:
```
ANTHROPIC_API_KEY=sk-ant-api03-...    # Optional if using Claude subscription
TELEGRAM_BOT_TOKEN=7123456:ABC...
TELEGRAM_ALLOWED_IDS=123456789
TELEGRAM_CHAT_ID=123456789
WEBHOOK_SECRET=any-random-string-here
```

If you have a Claude Pro/Max subscription, you can skip `ANTHROPIC_API_KEY` and authenticate via:
```bash
claude auth login
```

### 4. Set up the vault

Create vault files if they don't exist:
```bash
mkdir -p vault/memories vault/skills
```

Or link to your Google Drive vault (see [google-drive.md](google-drive.md)):
```bash
ln -s "$HOME/Google Drive/My Drive/sam-vault" ./vault
```

### 5. Initial embedding (optional)

If you have vault content to embed:
```bash
npx tsx scripts/embed-vault.ts
```

### 6. Run

```bash
npm run dev
```

You should see:
```
[sam] Starting Sam...
[sam] Environment: development
[sam] Database initialized
[telegram] Starting bot in long polling mode...
[telegram] Bot is running
[heartbeat] Heartbeat started (*/30 * * * *, Europe/Paris)
[sam] All systems booted. Ready.
```

### 7. Test

Send a message to your bot on Telegram. You should get a response within 10 seconds.

## Development Workflow

- **Edit vault**: Open `vault/` in Obsidian. Changes take effect on next Claude Code invocation.
- **Add a skill**: Create a `.md` file in `vault/skills/`. It's automatically available via the `.claude/skills` symlink.
- **Re-embed vault**: Run `npm run embed-vault` after significant vault changes.
- **Type check**: `npx tsc --noEmit`

## Troubleshooting

**"ANTHROPIC_API_KEY is required"**: Make sure `.env` exists and has the key set, or authenticate via `claude auth login` for subscription-based auth.

**"Credit balance is too low"**: Your API credits are depleted. Either add credits at [console.anthropic.com](https://console.anthropic.com) or switch to subscription auth via `claude auth login`.

**"TELEGRAM_BOT_TOKEN is required"**: Create a bot via @BotFather and add the token.

**Bot doesn't respond**: Check that your Telegram user ID is in `TELEGRAM_ALLOWED_IDS`.

**"claude: command not found"**: Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`

**sqlite-vec errors**: Make sure you're on Node.js 22 (not 25+). Run `npm rebuild`.
