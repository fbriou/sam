# ---- Build stage ----
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3, sqlite-vec)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
COPY scripts/ scripts/

RUN npx tsc

# ---- Runtime stage ----
FROM node:22-slim

WORKDIR /app

# System deps: git (Claude Code), ripgrep (Claude Code search)
RUN apt-get update && \
    apt-get install -y git ripgrep && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Copy built app and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Copy Claude Code config (MCP server, settings)
COPY .claude/ .claude/
COPY CLAUDE.md ./

# Create directories for runtime data
RUN mkdir -p /app/data /app/vault && \
    chown -R node:node /app

USER node

# Health check — verify the process is running
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "dist/index.js"]
