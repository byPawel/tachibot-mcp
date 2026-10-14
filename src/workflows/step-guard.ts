/**
 * Trust boundary for workflow steps that delegate to registered MCP tools.
 *
 * A workflow YAML can come from anywhere — `workflow({ file })` runs any path, and
 * workflow files get shared and downloaded — so a step gets LESS trust than the user's
 * own MCP client calling the same tool directly. Before this guard, a step could:
 *   - run tools the user disabled in the active profile (profile = their allowlist),
 *   - pass `files: ["~/.ssh/id_rsa", "../../.env"]` to any of the 38 file-taking tools,
 *     whose reader has no sandbox, shipping secrets to a third-party model,
 *   - escalate cost (`useHeavy: true`) or point jev_decide at any OpenRouter model.
 *
 * Direct tool calls are deliberately NOT restricted here: the user's own client may
 * pass absolute paths to other repos.
 */
import * as fs from "fs";
import * as path from "path";
import { isToolEnabled } from "../utils/tool-config.js";
import { expandFilePaths, parseFileSpec, resolveFileSpec } from "../utils/file-reader.js";

/** Meta / session tools that must never run as a step (recursion, or they read files). */
export const NON_STEP_TOOLS = new Set([
  "workflow", "workflow_start", "continue_workflow", "workflow_status",
  "create_workflow", "visualize_workflow", "list_workflows",
  "validate_workflow", "validate_workflow_file",
]);

/**
 * Credential-looking names that are NOT hidden files (hidden ones are refused wholesale
 * below). A denylist can't be complete, which is why every dot-segment is refused too.
 */
const SECRET_NAME = /^(id_(rsa|ed25519|ecdsa|dsa)\b.*|.*\.(pem|key|p12|pfx|keystore|jks|kdbx)|credentials.*|secrets?(\..*)?|.*\.secret(s)?(\..*)?|service[-_]?account.*\.json|token(s)?(\..*)?)$/i;

/**
 * Why a step may not read `resolved` (an absolute path from the reader's own resolver),
 * or null. Symlinks are followed via the deepest EXISTING ancestor, so neither
 * "link-to-outside/x" nor a missing "link-to-outside/new" escapes the check.
 */
function concreteFileViolation(resolved: string, rootReal: string): string | null {
  let existing = resolved;
  const tail: string[] = [];
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    tail.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const real = path.join(fs.realpathSync(existing), ...tail);
  const rel = path.relative(rootReal, real);
  if (rel === "" ) return null; // the root itself (a directory spec) — its files are checked individually
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "outside the working directory";
  const segments = rel.split(path.sep);
  if (segments.some((seg) => seg.startsWith("."))) return "hidden files/directories (.env, .git, .ssh…) are not readable from workflow steps";
  if (segments.some((seg) => SECRET_NAME.test(seg))) return "looks like a credential/secret file";
  return null;
}

/**
 * Why a step may not pass this `files` entry, or null when it may. Uses the file
 * reader's OWN parser, resolver and directory expansion (utils/file-reader.ts), so the
 * guard validates exactly the files readFilesIntoContext will open — no differential
 * on line ranges ("foo:5" vs "foo"), directories (".") or resolution.
 * Containment root is the server's cwd, the same base the reader resolves against.
 */
export function stepFileViolation(rawPath: string): string | null {
  if (typeof rawPath !== "string" || !rawPath.trim()) return "empty path";
  if (rawPath.trim().startsWith("~")) return "home-relative paths are not allowed";
  const rootReal = fs.realpathSync(process.cwd());

  // The spec itself (directory or file), then every file the reader would expand it to
  const targets = [rawPath, ...expandFilePaths([rawPath])];
  for (const spec of targets) {
    const why = concreteFileViolation(resolveFileSpec(parseFileSpec(spec).filePath), rootReal);
    if (why) return why;
  }
  return null;
}

/**
 * Check a delegated step's tool + args. Returns an error message (the step fails with it,
 * visibly) or null when the step may run.
 */
export function checkStep(toolName: string, args: Record<string, any>): string | null {
  if (NON_STEP_TOOLS.has(toolName)) return `'${toolName}' cannot run as a workflow step`;
  if (!isToolEnabled(toolName)) {
    return `'${toolName}' is disabled in the active profile — workflows can only run enabled tools`;
  }
  if (args.useHeavy === true) {
    return `'useHeavy' is not allowed in workflow steps (cost escalation) — call ${toolName} directly to use the Heavy model`;
  }
  if (toolName === "jev_decide" && args.model !== undefined && !/^typesafe\/[\w.-]+$/.test(String(args.model))) {
    return `jev_decide 'model' must be a typesafe/* id in workflow steps`;
  }
  if (args.files !== undefined) {
    if (!Array.isArray(args.files)) return "'files' must be an array of paths";
    for (const f of args.files) {
      const why = stepFileViolation(f);
      if (why) return `file '${f}' refused: ${why}`;
    }
  }
  return null;
}
