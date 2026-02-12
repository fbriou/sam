import type { Context, NextFunction } from "grammy";

/**
 * Allow-list middleware: only Telegram user IDs in the allow-list can interact.
 * All other users are silently ignored (no error response — don't reveal the bot exists).
 */
export function allowListMiddleware(allowedIds: number[]) {
  const allowedSet = new Set(allowedIds);

  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId || !allowedSet.has(userId)) {
      // Silent reject — no response to unauthorized users
      return;
    }
    await next();
  };
}

/**
 * Rate limiter middleware: limits messages per user per minute.
 * Prevents abuse if a Telegram user ID is compromised.
 */
export function rateLimitMiddleware(maxPerMinute: number = 10) {
  const counts = new Map<number, { count: number; resetAt: number }>();

  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const now = Date.now();
    const entry = counts.get(userId);

    if (!entry || now > entry.resetAt) {
      counts.set(userId, { count: 1, resetAt: now + 60_000 });
      await next();
      return;
    }

    if (entry.count >= maxPerMinute) {
      await ctx.reply("Too many messages. Please wait a moment.");
      return;
    }

    entry.count++;
    await next();
  };
}
