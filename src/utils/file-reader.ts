/**
 * File Reading Helper — Lets tools look at ACTUAL CODE, not summaries
 * Shared utility used by all analysis/reasoning tools that support the `files` parameter.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Expand directory paths into their code file contents.
 * Non-recursive. Filters to known code file extensions.
 */
function expandFilePaths(filePaths: string[]): string[] {
  const codeExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
    '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml',
    '.md', '.sql', '.sh', '.toml'
  ]);
  const result: string[] = [];

  for (const rawPath of filePaths) {
    // Skip line-range paths — they're always files
    if (/:\d+-\d+$/.test(rawPath)) {
      result.push(rawPath);
      continue;
    }

    const resolved = path.isAbsolute(rawPath)
      ? rawPath
      : path.join(process.cwd(), rawPath);

    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const dirFiles = fs.readdirSync(resolved)
          .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return codeExtensions.has(ext) && !f.startsWith('.');
          })
          .sort()
          .slice(0, 20)  // Cap at 20 files per directory
          .map(f => path.join(rawPath, f));
        result.push(...dirFiles);
      } else {
        result.push(rawPath);
      }
    } catch {
      result.push(rawPath);  // Let the main loop handle the error
    }
  }

  return result;
}

/**
 * Read files from disk and format as context for LLM tools.
 * Supports glob-like paths, line ranges (file.ts:100-200), and size limits.
 * Returns formatted string with file headers and line numbers.
 */
export function readFilesIntoContext(filePaths: string[], maxCharsPerFile = 8000): string {
  // Pre-process: expand directories into file lists
  const expandedPaths = expandFilePaths(filePaths);
  const sections: string[] = [];

  // Distribute char budget across files (cap total at 50k chars)
  const perFileBudget = expandedPaths.length > 1
    ? Math.min(maxCharsPerFile, Math.floor(50000 / expandedPaths.length))
    : maxCharsPerFile;

  for (const rawPath of expandedPaths) {
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

      let content = fs.readFileSync(resolved, "utf-8");
      const totalLines = content.split("\n").length;

      // Apply line range if specified
      if (startLine !== undefined && endLine !== undefined) {
        const lines = content.split("\n");
        content = lines.slice(startLine - 1, endLine).join("\n");
      }

      // Truncate if too large
      if (content.length > perFileBudget) {
        content = content.substring(0, perFileBudget) + `\n\n[... truncated at ${perFileBudget} chars, file has ${totalLines} lines total]`;
      }

      const rangeLabel = startLine ? `:${startLine}-${endLine}` : ` (${totalLines} lines)`;
      sections.push(`--- FILE: ${rawPath}${rangeLabel ? rangeLabel : ""} ---\n${content}\n`);
    } catch (err) {
      sections.push(`--- FILE: ${rawPath} ---\n[Error reading: ${String(err)}]\n`);
    }
  }

  return sections.join("\n");
}
