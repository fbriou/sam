# Setting Up the Telegram Bot

## Step 1: Create a Bot via BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a **name** for your bot (e.g., "MyClaw Assistant")
4. Choose a **username** (must end in "bot", e.g., "myclaw_assistant_bot")
5. BotFather will give you a **bot token** — copy it

Example token: `7123456789:ABCdefGHIjklMNOpqrstUVwxyz`

## Step 2: Get Your Telegram User ID

1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot)
2. Send `/start`
3. It will reply with your **user ID** — copy the number

Example: `123456789`

## Step 3: Configure .env

```bash
cp .env.example .env
```

Fill in:
```
TELEGRAM_BOT_TOKEN=7123456789:ABCdefGHIjklMNOpqrstUVwxyz
TELEGRAM_ALLOWED_IDS=123456789
TELEGRAM_CHAT_ID=123456789
```

## Step 4: Test the Bot

```bash
npm run dev
```

Then send a message to your bot on Telegram. You should get a response from Claude.

## Step 5 (Optional): Configure Bot Settings

Send these commands to @BotFather:

- `/setdescription` — Set a short description shown in the bot profile
- `/setabouttext` — Set the "About" text
- `/setuserpic` — Set a profile picture
- `/setcommands` — Set command menu:
  ```
  start - Start the bot
  ```

## Bot Privacy Settings

By default, Telegram bots in groups only receive messages that start with `/` or mention the bot. To receive all messages in a group:

1. Open @BotFather
2. Send `/setprivacy`
3. Select your bot
4. Choose "Disable"

For a personal assistant, you'll mostly use private chats where the bot receives everything.
