/**
 * File Reading Helper — Lets tools look at ACTUAL CODE, not summaries
 * Shared utility used by all analysis/reasoning tools that support the `files` parameter.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Read files from disk and format as context for LLM tools.
 * Supports glob-like paths, line ranges (file.ts:100-200), and size limits.
 * Returns formatted string with file headers and line numbers.
 */
export function readFilesIntoContext(filePaths: string[], maxCharsPerFile = 8000): string {
  const sections: string[] = [];

  for (const rawPath of filePaths) {
    try {
      // Parse optional line range: file.ts:100-200
      const rangeMatch = rawPath.match(/^(.+?):(\d+)-(\d+)$/);
      const filePath = rangeMatch ? rangeMatch[1] : rawPath;
      const startLine = rangeMatch ? parseInt(rangeMatch[2], 10) : undefined;
      const endLine = rangeMatch ? parseInt(rangeMatch[3], 10) : undefined;

      const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      if (!fs.existsSync(resolved)) {
        sections.push(`--- FILE: ${rawPath} ---\n[File not found: ${resolved}]\n`);
        continue;
      }

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        sections.push(`--- FILE: ${rawPath} ---\n[Is a directory, not a file]\n`);
        continue;
      }

      let content = fs.readFileSync(resolved, "utf-8");
      const totalLines = content.split("\n").length;

      // Apply line range if specified
      if (startLine !== undefined && endLine !== undefined) {
        const lines = content.split("\n");
        content = lines.slice(startLine - 1, endLine).join("\n");
      }

      // Truncate if too large
      if (content.length > maxCharsPerFile) {
        content = content.substring(0, maxCharsPerFile) + `\n\n[... truncated at ${maxCharsPerFile} chars, file has ${totalLines} lines total]`;
      }

      const rangeLabel = startLine ? `:${startLine}-${endLine}` : ` (${totalLines} lines)`;
      sections.push(`--- FILE: ${rawPath}${rangeLabel ? rangeLabel : ""} ---\n${content}\n`);
    } catch (err) {
      sections.push(`--- FILE: ${rawPath} ---\n[Error reading: ${String(err)}]\n`);
    }
  }

  return sections.join("\n");
}
