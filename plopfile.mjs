/**
 * Plop generator — add-tool (Task 2.2 of tool-standardization codemod)
 *
 * Usage:
 *   npm run add-tool
 *   npx plop tool
 *
 * Prompts for:
 *   provider   — e.g. "local", "grok", "openai", "gemini", "perplexity", "openrouter"
 *   name       — wire name used as `tool.name`, e.g. "grok_summarize"
 *   description — human-readable tool description
 *
 * Outputs:
 *   src/tools/{{provider}}-tools/{{name}}.ts            — tool definition
 *   src/tools/__tests__/{{name}}.test.ts               — minimal jest test
 *
 * Auto-registration:
 *   Appends the import + const reference into src/tools/{{provider}}-tools.ts
 *   at two stable anchor comments:
 *     // plop:tools    — where new tool const exports are appended
 *     // plop:register — inside the provider's getAll*Tools() return array
 *
 * Anchor convention (bootstrap one provider at a time — see Task 2.3 for
 * remaining providers):
 *   Place `// plop:tools` just above the getAll<Provider>Tools() function.
 *   Place `// plop:register` as the last item in the return array (before `]`).
 */

/** Convert snake_case / kebab-case wire name to camelCase const identifier. */
function toCamelCase(str) {
  return str.replace(/[-_]([a-z0-9])/gi, (_, c) => c.toUpperCase());
}

/** Capitalise the first letter of a string. */
function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function (plop) {
  // Helper: snake_case → camelCase  (e.g. grok_summarize → grokSummarize)
  plop.setHelper("camelName", (name) => toCamelCase(name));

  // Helper: camelCase tool-const name → e.g. grokSummarizeTool
  plop.setHelper("toolConst", (name) => toCamelCase(name) + "Tool");

  // Helper: provider string → capitalised for the getter name
  // e.g. "local" → "Local", "openai" → "Openai" (matches existing pattern)
  plop.setHelper("upperProvider", (provider) => upperFirst(provider));

  plop.setGenerator("tool", {
    description: "Scaffold a new standardised MCP tool + test",
    prompts: [
      {
        type: "list",
        name: "provider",
        message: "Which provider does this tool belong to?",
        choices: [
          "local",
          "grok",
          "openai",
          "gemini",
          "perplexity",
          "openrouter",
        ],
      },
      {
        type: "input",
        name: "name",
        message: "Wire name (snake_case, e.g. grok_summarize):",
        validate: (v) =>
          /^[a-z][a-z0-9_]*$/.test(v) ||
          "Must be lowercase snake_case (letters, digits, underscores; starts with letter)",
      },
      {
        type: "input",
        name: "description",
        message: "Short tool description (shown in MCP client):",
        validate: (v) => v.trim().length > 0 || "Description is required",
      },
    ],
    actions: [
      // 1) Emit the tool definition file
      {
        type: "add",
        path: "src/tools/{{provider}}-tools/{{name}}.ts",
        templateFile: "plop-templates/tool/tool.ts.hbs",
      },

      // 2) Emit the jest test file
      {
        type: "add",
        path: "src/tools/__tests__/{{name}}.test.ts",
        templateFile: "plop-templates/tool/test.ts.hbs",
      },

      // 3) Append import + export of the tool const into the provider file,
      //    just above the getAll*Tools getter (at the `// plop:tools` anchor).
      {
        type: "append",
        path: "src/tools/{{provider}}-tools.ts",
        pattern: /\/\/ plop:tools/,
        template:
          'import { {{toolConst name}} } from "./{{provider}}-tools/{{name}}.js";',
      },

      // 4) Append the tool const reference into the getAll*Tools() return array
      //    (at the `// plop:register` anchor inside the array literal).
      {
        type: "append",
        path: "src/tools/{{provider}}-tools.ts",
        pattern: /\/\/ plop:register/,
        template: "    {{toolConst name}},",
      },

      // Reminder — this does NOT touch registry.ts or server.ts.
      // The registry already imports the provider getter; the getter now
      // includes the new tool automatically (see Task 2.3 for providers
      // that use direct named imports instead of a getter).
    ],
  });
}
