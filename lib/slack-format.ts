/**
 * Convert standard Markdown (as produced by Gemini) into Slack mrkdwn.
 *
 * Key differences from standard Markdown:
 *  - Bold:        **text**  →  *text*
 *  - Italic:      *text*    →  _text_
 *  - Headings:    # Title   →  *Title*   (Slack has no heading concept)
 *  - Links:       [t](url)  →  <url|t>
 *  - Bullets:     - item    →  • item
 *  - Strikethrough: ~~text~~ → ~text~
 *  - Code spans / blocks: kept as-is (Slack supports backtick syntax natively)
 *
 * Processing order matters:
 *  1. Bullets are converted FIRST so that `*` list markers (e.g. `* **Heading**`)
 *     are replaced with `•` before any `*` is interpreted as bold or italic.
 *     Without this, the leading `* ` in `* **text**` is incorrectly matched as
 *     an italic span (`_ _`), mangling the rest of the line.
 *  2. Headings, bold, and italic are resolved in a single regex pass so that the
 *     `*text*` output from bold/heading conversion is never re-matched as italic.
 */
export function mdToSlack(md: string): string {
  return (
    md
      // 1. Unordered list bullets FIRST — `*` and `-` markers become •
      //    so they cannot be mis-read as bold/italic delimiters below.
      .replace(/^[ \t]*[-*]\s+/gm, "• ")
      // 2. Headings, bold, italic — single pass prevents double-conversion.
      //    Order of alternatives: headings → bold (double *) → italic (single *).
      .replace(
        /^#{1,6}\s+(.+)$|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/gm,
        (_, heading, bold, italic) => {
          if (heading !== undefined) return `*${heading}*`;
          if (bold !== undefined) return `*${bold}*`;
          return `_${italic}_`;
        },
      )
      // 3. Strikethrough: ~~text~~ → ~text~
      .replace(/~~([^~\n]+)~~/g, "~$1~")
      // 4. Links: [text](url) → <url|text>
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
  );
}

/**
 * Format a list of RAG sources as Slack mrkdwn citation lines.
 *
 * Each entry becomes:
 *   • <https://github.com/…|Title> (relevance 87%)
 *
 * Falls back to plain italic title when no URL is available.
 */
export function formatSources(
  sources: { title: string; slab_url: string | null; similarity: number }[],
): string {
  return sources
    .map((s) => {
      const citation = s.slab_url
        ? `<${s.slab_url}|${s.title}>`
        : `_${s.title}_`;
      return `• ${citation} (relevance ${(s.similarity * 100).toFixed(0)}%)`;
    })
    .join("\n");
}
