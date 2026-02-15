import { describe, it, expect, vi, beforeEach } from "vitest";
import { allowListMiddleware, rateLimitMiddleware } from "./security.js";

function makeCtx(userId?: number) {
  return {
    from: userId !== undefined ? { id: userId } : undefined,
    reply: vi.fn(),
  } as any;
}

describe("allowListMiddleware", () => {
  const middleware = allowListMiddleware([111, 222]);

  it("calls next() for allowed user", async () => {
    const next = vi.fn();
    await middleware(makeCtx(111), next);
    expect(next).toHaveBeenCalled();
  });

  it("silently rejects unauthorized user", async () => {
    const ctx = makeCtx(999);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("rejects when no ctx.from", async () => {
    const next = vi.fn();
    await middleware(makeCtx(), next);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("rateLimitMiddleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows messages under the limit", async () => {
    const middleware = rateLimitMiddleware(3);
    const next = vi.fn();

    await middleware(makeCtx(111), next);
    await middleware(makeCtx(111), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("blocks at the limit and replies", async () => {
    const middleware = rateLimitMiddleware(2);
    const next = vi.fn();
    const ctx = makeCtx(111);

    await middleware(ctx, next);
    await middleware(ctx, next);
    await middleware(ctx, next); // 3rd call → over limit
    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Too many messages. Please wait a moment."
    );
  });

  it("resets after 60 seconds", async () => {
    const middleware = rateLimitMiddleware(1);
    const next = vi.fn();

    const now = 1000000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await middleware(makeCtx(111), next);

    // Over limit
    await middleware(makeCtx(111), next);
    expect(next).toHaveBeenCalledTimes(1);

    // Advance past 60s
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    await middleware(makeCtx(111), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("tracks multiple users independently", async () => {
    const middleware = rateLimitMiddleware(1);
    const next = vi.fn();

    await middleware(makeCtx(111), next);
    await middleware(makeCtx(222), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
