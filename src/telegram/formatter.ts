/**
 * Convert Claude's markdown response to Telegram-safe HTML.
 *
 * Telegram supports a subset of HTML: <b>, <i>, <code>, <pre>, <a>.
 * Claude often outputs standard markdown which needs conversion.
 */
export function markdownToTelegramHtml(text: string): string {
  let html = text;

  // Code blocks: ```lang\ncode\n``` → <pre><code class="language-lang">code</code></pre>
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      const langAttr = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
    }
  );

  // Inline code: `code` → <code>code</code>
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Bold: **text** or __text__ → <b>text</b>
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ → <i>text</i>
  // Be careful not to match inside already-converted bold tags
  html = html.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "<i>$1</i>");
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<i>$1</i>");

  // Links: [text](url) → <a href="url">text</a>
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );

  // Strikethrough: ~~text~~ → <s>text</s>
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  return html;
}

/**
 * Escape HTML special characters to prevent injection.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Split a long message into chunks that fit within Telegram's 4096 character limit.
 * Tries to split at paragraph boundaries, then sentence boundaries, then hard-cut.
 */
export function chunkText(text: string, maxLength: number = 4096): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a paragraph break
    let splitAt = remaining.lastIndexOf("\n\n", maxLength);

    // Fallback: line break
    if (splitAt <= 0) {
      splitAt = remaining.lastIndexOf("\n", maxLength);
    }

    // Fallback: sentence end
    if (splitAt <= 0) {
      splitAt = remaining.lastIndexOf(". ", maxLength);
      if (splitAt > 0) splitAt += 1; // Include the period
    }

    // Last resort: hard cut
    if (splitAt <= 0) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
