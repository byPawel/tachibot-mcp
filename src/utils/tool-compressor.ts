/**
 * Tool Compressor - Aggressive token reduction for MCP tools
 * Target: Reduce from ~400 tokens per tool to ~40 tokens
 */

import { z } from 'zod';

export interface CompressedTool {
  n: string;  // name
  d: string;  // description (max 10 words)
  p: Record<string, string>;  // params (compressed schema)
}

export interface ToolGroup {
  name: string;
  tools: string[];
  consolidated: CompressedTool;
}

/**
 * Compress a tool description to minimal tokens
 */
export function compressToolDescription(tool: {
  name: string;
  description: string;
  parameters?: any;
}): CompressedTool {
  return {
    n: compressName(tool.name),
    d: compressDescription(tool.description),
    p: compressParameters(tool.parameters)
  };
}

/**
 * Compress tool name
 */
function compressName(name: string): string {
  // Remove underscores, use abbreviations
  const abbreviations: Record<string, string> = {
    'perplexity': 'pplx',
    'gemini': 'gem',
    'openai': 'oai',
    'research': 'rsch',
    'analyze': 'anlz',
    'brainstorm': 'bstm',
    'workflow': 'wf',
    'visualize': 'viz',
    'create': 'mk',
    'list': 'ls'
  };

  let compressed = name.toLowerCase();
  Object.entries(abbreviations).forEach(([full, abbr]) => {
    compressed = compressed.replace(full, abbr);
  });

  return compressed.replace(/_/g, '');
}

/**
 * Compress description to max 10 words
 */
function compressDescription(description: string): string {
  // Remove common filler words
  const fillers = ['the', 'a', 'an', 'to', 'for', 'with', 'and', 'or', 'but', 'in', 'on', 'at', 'from', 'by'];

  const words = description
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !fillers.includes(word))
    .slice(0, 7);  // Max 7 meaningful words

  return words.join(' ');
}

/**
 * Compress parameters to minimal schema notation
 */
function compressParameters(params: any): Record<string, string> {
  if (!params) return {};

  const compressed: Record<string, string> = {};

  // Handle Zod schema
  if (params._def) {
    const shape = params._def.shape?.() || {};
    Object.entries(shape).forEach(([key, value]: [string, any]) => {
      compressed[compressParamName(key)] = compressParamType(value);
    });
  }
  // Handle plain object
  else if (typeof params === 'object') {
    Object.entries(params).forEach(([key, value]: [string, any]) => {
      compressed[compressParamName(key)] =
        typeof value === 'object' ? compressParamType(value) : 's';
    });
  }

  return compressed;
}

/**
 * Compress parameter names
 */
function compressParamName(name: string): string {
  const mapping: Record<string, string> = {
    'query': 'q',
    'prompt': 'p',
    'model': 'm',
    'temperature': 't',
    'maxTokens': 'mx',
    'max_tokens': 'mx',
    'context': 'c',
    'content': 'c',
    'message': 'msg',
    'depth': 'd',
    'name': 'n',
    'type': 'typ',
    'projectPath': 'path',
    'input': 'i',
    'output': 'o'
  };

  return mapping[name] || name.slice(0, 3);
}

/**
 * Compress parameter type to shorthand
 */
function compressParamType(zodType: any): string {
  if (!zodType) return 's';  // Default to string

  const typeName = zodType._def?.typeName || zodType.type || 'string';

  const typeMap: Record<string, string> = {
    'ZodString': 's',
    'ZodNumber': 'n',
    'ZodBoolean': 'b',
    'ZodArray': 'a',
    'ZodObject': 'o',
    'ZodEnum': 'e',
    'ZodOptional': '?',
    'string': 's',
    'number': 'n',
    'boolean': 'b',
    'array': 'a',
    'object': 'o'
  };

  let compressed = typeMap[typeName] || 's';

  // Handle optional
  if (zodType._def?.typeName === 'ZodOptional') {
    const innerType = compressParamType(zodType._def.innerType);
    compressed = innerType + '?';
  }

  // Handle enum values
  if (zodType._def?.values) {
    const values = zodType._def.values.slice(0, 3).join('|');
    compressed = `e[${values}]`;
  }

  return compressed;
}

/**
 * Consolidate multiple tools into one
 */
export function consolidateTools(tools: string[], groupName: string): CompressedTool {
  const consolidationMap: Record<string, CompressedTool> = {
    'ai_models': {
      n: 'ai',
      d: 'query ai models',
      p: {
        m: 's', // model
        p: 's', // prompt
        t: 'n?', // temperature (optional)
        mx: 'n?' // maxTokens (optional)
      }
    },
    'research': {
      n: 'rsch',
      d: 'web research citations',
      p: {
        q: 's', // query
        d: 'e[quick|standard|deep]?', // depth
        s: 'a?' // sources (optional array)
      }
    },
    'code': {
      n: 'code',
      d: 'analyze review code',
      p: {
        c: 's', // code
        m: 'e[review|analyze|fix]?', // mode
        f: 's?' // focus area (optional)
      }
    },
    'workflow': {
      n: 'wf',
      d: 'execute workflows',
      p: {
        n: 's', // name
        i: 's', // input
        o: 'o?' // options (optional object)
      }
    }
  };

  return consolidationMap[groupName] || {
    n: groupName.slice(0, 5),
    d: `${groupName} tools`,
    p: { i: 's' }
  };
}

/**
 * Expand compressed tool back to full MCP format
 */
export function expandCompressedTool(compressed: CompressedTool): any {
  // Expand parameter names
  const expandParamName = (short: string): string => {
    const mapping: Record<string, string> = {
      'q': 'query',
      'p': 'prompt',
      'm': 'model',
      't': 'temperature',
      'mx': 'maxTokens',
      'c': 'content',
      'd': 'depth',
      'n': 'name',
      'i': 'input',
      'o': 'output'
    };
    return mapping[short] || short;
  };

  // Expand parameter types
  const expandParamType = (short: string): any => {
    if (short.endsWith('?')) {
      return z.optional(expandParamType(short.slice(0, -1)));
    }

    const typeMap: Record<string, any> = {
      's': z.string(),
      'n': z.number(),
      'b': z.boolean(),
      'a': z.array(z.string()),
      'o': z.object({})
    };

    // Handle enums
    if (short.startsWith('e[')) {
      const values = short.slice(2, -1).split('|');
      return z.enum(values as [string, ...string[]]);
    }

    return typeMap[short] || z.string();
  };

  // Build expanded parameters
  const parameters: Record<string, any> = {};
  Object.entries(compressed.p).forEach(([key, type]) => {
    parameters[expandParamName(key)] = expandParamType(type);
  });

  return {
    name: compressed.n,
    description: compressed.d,
    parameters: z.object(parameters)
  };
}

/**
 * Calculate estimated token count for a tool
 */
export function estimateTokens(tool: any): number {
  const str = JSON.stringify(tool);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(str.length / 4);
}

/**
 * Batch compress all tools with token budget
 */
export function compressAllTools(
  tools: any[],
  maxTokens: number = 10000
): { compressed: CompressedTool[], totalTokens: number } {
  const compressed: CompressedTool[] = [];
  let totalTokens = 0;

  for (const tool of tools) {
    const comp = compressToolDescription(tool);
    const tokens = estimateTokens(comp);

    if (totalTokens + tokens <= maxTokens) {
      compressed.push(comp);
      totalTokens += tokens;
    } else {
      console.warn(`Skipping tool ${tool.name} - would exceed token budget`);
    }
  }

  return { compressed, totalTokens };
}