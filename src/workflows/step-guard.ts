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

/** Meta / session tools that must never run as a step (recursion, or they read files). */
export const NON_STEP_TOOLS = new Set([
  "workflow", "workflow_start", "continue_workflow", "workflow_status",
  "create_workflow", "visualize_workflow", "list_workflows",
  "validate_workflow", "validate_workflow_file",
]);

/** Basenames/segments that look like credentials — never readable from a step. */
const SECRET_PATH = /(^|[\\/])(\.env(\.[\w.-]+)?|\.ssh|\.aws|\.gnupg|\.npmrc|\.pypirc|\.netrc|\.git-credentials|\.docker|id_(rsa|ed25519|ecdsa|dsa)[^\\/]*|[^\\/]*\.(pem|key|p12|pfx|keystore)|credentials[^\\/]*|secrets?[^\\/]*\.(json|ya?ml|toml))([\\/]|$)/i;

/** Strip a trailing line range ("src/a.ts:10-20") the file reader accepts. */
function stripRange(p: string): string {
  return p.replace(/:\d+(-\d+)?$/, "");
}

/**
 * Why a step may not read this path, or null when it may. Paths must resolve inside
 * `root` (default: the server's cwd) after following symlinks, and not look like secrets.
 */
export function stepFileViolation(rawPath: string, root: string = process.cwd()): string | null {
  if (typeof rawPath !== "string" || !rawPath.trim()) return "empty path";
  const p = stripRange(rawPath.trim());
  if (p.startsWith("~")) return "home-relative paths are not allowed";
  if (SECRET_PATH.test(p)) return "looks like a credential/secret file";

  const rootReal = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
  // Follow symlinks so one inside the root can't point out of it. For a path that doesn't
  // exist yet, resolve its deepest EXISTING ancestor — a lexical check alone would accept
  // "link-to-outside/new-file".
  const lexical = path.resolve(rootReal, p);
  let existing = lexical;
  const tail: string[] = [];
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    tail.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const resolved = path.join(fs.realpathSync(existing), ...tail);
  const rel = path.relative(rootReal, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "outside the working directory";
  if (SECRET_PATH.test(rel)) return "looks like a credential/secret file";
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
