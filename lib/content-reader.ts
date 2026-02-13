import fs from "fs";
import path from "path";

export interface MarkdownDocument {
  title: string;
  body: string;
  filePath: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

// Recursively find all .md files in the content directory
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

// Extract the title from a markdown document.
// Looks for the first `# Heading` line; falls back to the filename.
function extractTitle(content: string, fileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  // Fallback: derive title from filename
  return fileName
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Read and parse a single markdown file into a MarkdownDocument.
function parseMarkdownFile(absolutePath: string): MarkdownDocument {
  const raw = fs.readFileSync(absolutePath, "utf-8");
  const relativePath = path.relative(CONTENT_DIR, absolutePath);
  const fileName = path.basename(absolutePath);
  const title = extractTitle(raw, fileName);

  // Remove the title line from the body so it isn't duplicated in chunks
  const body = raw.replace(/^#\s+.+\n*/m, "").trim();

  return { title, body, filePath: relativePath };
}

// Load all markdown documents from the content/ directory.
export function loadAllDocuments(): MarkdownDocument[] {
  const files = findMarkdownFiles(CONTENT_DIR);
  return files.map(parseMarkdownFile);
}
