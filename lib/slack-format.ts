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
 * Headings, bold, and italic are resolved in a single regex pass to avoid
 * the conversion sequence turning newly-created *bold* markers into italics.
 */
export function mdToSlack(md: string): string {
  return (
    md
      // Headings (# … ######), bold (**), and italic (*) — one pass to prevent conflicts
      .replace(
        /^#{1,6}\s+(.+)$|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/gm,
        (_, heading, bold, italic) => {
          if (heading !== undefined) return `*${heading}*`;
          if (bold !== undefined) return `*${bold}*`;
          return `_${italic}_`;
        },
      )
      // Strikethrough: ~~text~~ → ~text~
      .replace(/~~([^~\n]+)~~/g, "~$1~")
      // Links: [text](url) → <url|text>
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
      // Unordered list bullets (- or * at line start) → •
      .replace(/^[ \t]*[-*]\s+/gm, "• ")
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
