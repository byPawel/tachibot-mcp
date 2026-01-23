/**
 * Wrapper tool to access OpenRouter/Qwen tools
 * Since they don't show in Claude's UI, this provides a single entry point
 */

import { z } from "zod";
import { qwenCoderTool, qwqReasoningTool, qwenGeneralTool, qwenCompetitiveTool, openRouterMultiModelTool } from "./openrouter-tools.js";

/**
 * Unified Qwen tool that wraps all OpenRouter tools
 */
export const qwenTool = {
  name: "qwen",
  description: "Access Qwen3-Coder, QwQ reasoning, and other OpenRouter models. Select 'tool' type first, then provide the main input.",
  parameters: z.object({
    tool: z.enum(["coder", "reason", "general", "competitive", "multi"])
      .describe("Which tool to use - must be one of: coder, reason, general, competitive, multi"),

    // Coder parameters
    task: z.enum(["generate", "review", "optimize", "debug", "refactor", "explain"])
      .optional()
      .describe("For coder tool - task type: generate, review, optimize, debug, refactor, explain"),
    code: z.string().optional().describe("For coder tool - source code to analyze"),
    requirements: z.string().optional().describe("For coder tool - requirements or description"),
    language: z.string().optional().describe("Programming language"),

    // Reasoning parameters
    problem: z.string().optional().describe("For reason/competitive tool - the problem to solve (put your question here)"),
    approach: z.enum(["logical", "mathematical", "systematic", "critical"])
      .optional()
      .describe("For reason tool - approach: logical, mathematical, systematic, critical"),

    // General/Multi parameters
    query: z.string().optional().describe("For general/multi tool - your question or request (put your question here)"),
    model: z.string().optional().describe("For multi tool - specific model to use"),

    // Common
    useFree: z.boolean().optional().default(false).describe("Use free tier model")
  }),
  
  execute: async (args: any, { log }: any) => {
    log?.info(`Using Qwen tool: ${args.tool}`);
    
    switch (args.tool) {
      case "coder":
        return await qwenCoderTool.execute({
          task: args.task || "generate",
          code: args.code,
          requirements: args.requirements || args.query || "",
          language: args.language,
          useFree: args.useFree
        }, { log });
        
      case "reason":
        return await qwqReasoningTool.execute({
          problem: args.problem || args.query || args.requirements || "",
          approach: args.approach,
          useFree: args.useFree
        }, { log });
        
      case "general":
        return await qwenGeneralTool.execute({
          query: args.query || args.requirements || args.problem || "",
          mode: "general",
          useFree: args.useFree
        }, { log });
        
      case "competitive":
        return await qwenCompetitiveTool.execute({
          problem: args.problem || args.query || args.requirements || "",
          language: args.language,
          optimize: true
        }, { log });
        
      case "multi":
        return await openRouterMultiModelTool.execute({
          query: args.query || args.requirements || args.problem || "",
          model: args.model || "qwen/qwen3-coder",
          temperature: 0.7
        }, { log });
        
      default:
        return "Unknown tool. Use: coder, reason, general, competitive, or multi";
    }
  }
};

/**
 * Export the wrapper tool
 */
export function getQwenWrapperTool() {
  return qwenTool;
}