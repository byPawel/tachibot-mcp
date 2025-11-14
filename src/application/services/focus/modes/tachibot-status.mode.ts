/**
 * Status Mode - Display system status
 * Extracted from server.ts lines 379-400 (Phase 2: SOLID refactoring)
 */

import { IFocusMode, FocusResult } from '../../../../domain/interfaces/IFocusMode.js';
import { canRunFocusDeep } from '../../../../focus-deep.js';
import { isPerplexityAvailable } from '../../../../tools/perplexity-tools.js';
import { isGrokAvailable } from '../../../../tools/grok-tools.js';
import { getProviderInfo } from '../../../../tools/unified-ai-provider.js';
import { loadConfig } from '../../../../config.js';

export class TachibotStatusMode implements IFocusMode {
  readonly modeName = 'tachibot-status';
  readonly description = 'Display TachiBot system status and available features';

  async execute(params: Record<string, unknown>): Promise<FocusResult> {
    const config = loadConfig();
    const providerInfo = getProviderInfo();
    const availableProviders = Object.entries(providerInfo)
      .filter(([_, info]) => info.available)
      .map(([name]) => name);

    const statusInfo = canRunFocusDeep();
    let status = `# 🔧 Focus MCP Server Status\n\n`;
    status += `**Mode**: ${config.isClaudeCode ? 'Claude Code' : 'Standalone'}\n`;
    if (config.isClaudeCode) {
      status += `**Claude Model**: ${config.claudeModel || 'Not detected'}\n`;
    }
    status += `\n**Available Features**:\n`;
    status += `- Think tool: ✅ Always available\n`;
    status += `- Sequential thinking: ✅ Always available\n`;
    status += `- Unified AI providers: ${availableProviders.join(', ') || 'None configured'}\n`;
    status += `- Perplexity tools: ${isPerplexityAvailable() ? '✅ Available' : '❌ Need PERPLEXITY_API_KEY'}\n`;
    status += `- Grok tools: ${isGrokAvailable() ? '✅ Available' : '❌ Need GROK_API_KEY'}\n`;

    // Check LM Studio async
    const lmstudioAvailable = availableProviders.includes('lmstudio');
    const lmstudioModel = lmstudioAvailable ? 'local-model' : 'Not connected';
    status += `- LM Studio tools: ${lmstudioAvailable ? `✅ Available (${lmstudioModel})` : '❌ Start LM Studio'}\n`;
    status += `\n**Focus-Deep Status**:\n`;
    status += `- Quality: ${statusInfo.quality}\n`;
    status += `- Available models: ${statusInfo.models.join(', ')}\n`;

    return {
      output: status,
      metadata: {
        mode: this.modeName,
        timestamp: Date.now(),
        providers: availableProviders,
        quality: statusInfo.quality
      }
    };
  }
}
