import { describe, it, expect } from "vitest";
import { markdownToTelegramHtml, chunkText } from "./formatter.js";

describe("markdownToTelegramHtml", () => {
  it("converts bold **text**", () => {
    expect(markdownToTelegramHtml("**hello**")).toBe("<b>hello</b>");
  });

  it("converts bold __text__", () => {
    expect(markdownToTelegramHtml("__hello__")).toBe("<b>hello</b>");
  });

  it("converts italic *text*", () => {
    expect(markdownToTelegramHtml("*hello*")).toBe("<i>hello</i>");
  });

  it("converts italic _text_", () => {
    expect(markdownToTelegramHtml("_hello_")).toBe("<i>hello</i>");
  });

  it("converts inline code", () => {
    expect(markdownToTelegramHtml("`const x = 1`")).toBe(
      "<code>const x = 1</code>"
    );
  });

  it("escapes HTML in inline code", () => {
    expect(markdownToTelegramHtml("`<div>&</div>`")).toBe(
      "<code>&lt;div&gt;&amp;&lt;/div&gt;</code>"
    );
  });

  it("converts code blocks with language", () => {
    const input = "```ts\nconst x = 1;\n```";
    expect(markdownToTelegramHtml(input)).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>'
    );
  });

  it("converts code blocks without language", () => {
    const input = "```\nhello\n```";
    expect(markdownToTelegramHtml(input)).toBe(
      "<pre><code>hello</code></pre>"
    );
  });

  it("escapes HTML inside code blocks", () => {
    const input = "```\n<script>alert('xss')</script>\n```";
    expect(markdownToTelegramHtml(input)).toContain("&lt;script&gt;");
  });

  it("converts links", () => {
    expect(markdownToTelegramHtml("[click](https://example.com)")).toBe(
      '<a href="https://example.com">click</a>'
    );
  });

  it("converts strikethrough", () => {
    expect(markdownToTelegramHtml("~~deleted~~")).toBe("<s>deleted</s>");
  });

  it("handles mixed formatting", () => {
    const input = "**bold** and *italic* and `code`";
    const result = markdownToTelegramHtml(input);
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<code>code</code>");
  });

  it("passes plain text through unchanged", () => {
    expect(markdownToTelegramHtml("just text")).toBe("just text");
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    expect(chunkText("hello")).toEqual(["hello"]);
  });

  it("splits at paragraph boundary", () => {
    const text = "a".repeat(100) + "\n\n" + "b".repeat(100);
    const chunks = chunkText(text, 150);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("a".repeat(100));
    expect(chunks[1]).toBe("b".repeat(100));
  });

  it("falls back to line break", () => {
    const text = "a".repeat(100) + "\n" + "b".repeat(100);
    const chunks = chunkText(text, 150);
    expect(chunks).toHaveLength(2);
  });

  it("falls back to sentence end", () => {
    const text = "a".repeat(100) + ". " + "b".repeat(100);
    const chunks = chunkText(text, 150);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain(".");
  });

  it("hard cuts as last resort", () => {
    const text = "a".repeat(300);
    const chunks = chunkText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toHaveLength(100);
  });

  it("respects custom maxLength", () => {
    const text = "a".repeat(50);
    expect(chunkText(text, 50)).toHaveLength(1);
    expect(chunkText(text, 25).length).toBeGreaterThan(1);
  });

  it("returns text under default 4096 limit as single chunk", () => {
    const text = "a".repeat(4096);
    expect(chunkText(text)).toHaveLength(1);
  });
});
