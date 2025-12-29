/**
 * Workflow Ink Renderer
 *
 * Renders workflow results with React Ink components:
 * - Per-step output with model badges and nerd icons
 * - Comparison table using InkTable with colors
 * - Optional judging/evaluation at end
 *
 * Usage:
 *   import { renderWorkflowResult } from './workflow-ink-renderer.js';
 *   const output = renderWorkflowResult(execution, { includeComparison: true, includeJudging: true });
 */

import './color-setup.js';

import React from 'react';
import { render, Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { PassThrough } from 'stream';
import { loadTheme, Markdown, type InkTheme } from './ink-markdown-renderer.js';
import { SimpleTable, TableThemeProvider, type TableTheme } from './ink-table.js';
import { nerdIcons } from './ink-renderer.js';

// ============================================================================
// TYPES
// ============================================================================

export interface StepResult {
  step: string;
  tool?: string;
  model?: string;
  output: string;
  duration?: number;
  tokens?: number;
  filePath?: string;
}

export interface WorkflowResult {
  workflowName: string;
  workflowId?: string;
  duration: number;
  steps: StepResult[];
  status: 'completed' | 'failed' | 'running';
}

export interface RenderWorkflowOptions {
  /** Include comparison table at the end */
  includeComparison?: boolean;
  /** Include AI judge evaluation */
  includeJudging?: boolean;
  /** Judge result (if already computed) */
  judgeResult?: JudgeResult;
  /** Maximum characters per step summary */
  maxSummaryLength?: number;
  /** Theme name */
  theme?: string;
}

export interface JudgeResult {
  winner?: string;
  reasoning: string;
  scores?: Record<string, number>;
  rankings?: string[];
}

// ============================================================================
// MODEL CONFIG: ICONS + COLORS
// ============================================================================

/** Model-specific configuration with nerd icons and gradient colors */
const modelConfig: Record<string, {
  nerdIcon: string;
  fallbackIcon: string;
  gradient: string[];
  color: string;
}> = {
  gemini: {
    nerdIcon: nerdIcons.sparkle || '✦',
    fallbackIcon: '✦',
    gradient: ['#00D4FF', '#FF00D4'],
    color: '#00D4FF',
  },
  grok: {
    nerdIcon: nerdIcons.lightning || '⚡',
    fallbackIcon: '⚡',
    gradient: ['#FF8800', '#FF4400'],
    color: '#FF8800',
  },
  openai: {
    nerdIcon: nerdIcons.robot || '✾',
    fallbackIcon: '✾',
    gradient: ['#00FF88', '#00DDFF'],
    color: '#00FF88',
  },
  perplexity: {
    nerdIcon: nerdIcons.search || '⍟',
    fallbackIcon: '⍟',
    gradient: ['#A855F7', '#EC4899'],
    color: '#A855F7',
  },
  qwen: {
    nerdIcon: nerdIcons.chip || '☁',
    fallbackIcon: '☁',
    gradient: ['#FFD000', '#FF8800'],
    color: '#FFD000',
  },
  kimi: {
    nerdIcon: nerdIcons.magic || '☾',
    fallbackIcon: '☾',
    gradient: ['#C084FC', '#F472B6'],
    color: '#C084FC',
  },
  claude: {
    nerdIcon: nerdIcons.brain || '⚜',
    fallbackIcon: '⚜',
    gradient: ['#FB923C', '#FBBF24'],
    color: '#FB923C',
  },
  focus: {
    nerdIcon: nerdIcons.cpu || '◉',
    fallbackIcon: '◉',
    gradient: ['#60A5FA', '#A78BFA'],
    color: '#60A5FA',
  },
  workflow: {
    nerdIcon: nerdIcons.cogs,
    fallbackIcon: nerdIcons.cogs,
    gradient: ['#34D399', '#22D3EE'],
    color: '#34D399',
  },
  default: {
    nerdIcon: nerdIcons.robot,
    fallbackIcon: nerdIcons.robot,
    gradient: ['#888888', '#CCCCCC'],
    color: '#888888',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get model config (icon, gradient, color)
 */
function getModelConfig(model?: string) {
  if (!model) return modelConfig.default;
  const key = model.toLowerCase().split(/[-_]/)[0]; // Extract base: "gemini-3-pro" -> "gemini"
  return modelConfig[key] || modelConfig.default;
}

/**
 * Get icon for model (nerd font if available, fallback otherwise)
 */
function getModelIcon(model?: string): string {
  const config = getModelConfig(model);
  return config.nerdIcon;
}

/**
 * Extract model name from tool name
 */
function extractModelFromTool(tool?: string): string {
  if (!tool) return 'default';
  const lower = tool.toLowerCase();
  for (const key of Object.keys(modelConfig)) {
    if (lower.includes(key)) return key;
  }
  return 'default';
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.slice(0, 2), 16);
  const g1 = parseInt(hex1.slice(2, 4), 16);
  const b1 = parseInt(hex1.slice(4, 6), 16);

  const r2 = parseInt(hex2.slice(0, 2), 16);
  const g2 = parseInt(hex2.slice(2, 4), 16);
  const b2 = parseInt(hex2.slice(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `${r};${g};${b}`;
}

/**
 * Create gradient background text
 */
function createGradientBgText(text: string, colors: string[]): string {
  const chars = Array.from(text);
  const numColors = colors.length;
  const reset = '\x1b[0m';
  const dark = '\x1b[38;2;30;30;30m';
  const bold = '\x1b[1m';

  let result = bold + dark;

  for (let i = 0; i < chars.length; i++) {
    const position = i / (chars.length - 1 || 1);
    const colorIndex = position * (numColors - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, numColors - 1);
    const factor = colorIndex - lowerIndex;

    const rgb = interpolateColor(colors[lowerIndex], colors[upperIndex], factor);
    result += `\x1b[48;2;${rgb}m${chars[i]}`;
  }

  return result + reset;
}

// ============================================================================
// INK COMPONENTS
// ============================================================================

/**
 * Workflow header component
 */
const WorkflowHeader: React.FC<{ name: string; duration: number; stepCount: number }> = ({
  name,
  duration,
  stepCount
}) => {
  const wfIcon = nerdIcons.robot;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Gradient colors={['#34D399', '#22D3EE', '#818CF8']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box marginTop={1}>
        <Text bold color="#34D399">{wfIcon} Workflow:</Text>
        <Text bold> {name}</Text>
      </Box>
      <Box>
        <Text dimColor>Duration: {(duration / 1000).toFixed(1)}s │ Steps: {stepCount}</Text>
      </Box>
      <Box marginTop={1}>
        <Gradient colors={['#34D399', '#22D3EE', '#818CF8']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
    </Box>
  );
};

/**
 * Step result component with model badge and nerd icon
 */
const StepResultCard: React.FC<{
  stepNum: number;
  step: StepResult;
  maxSummaryLength?: number;  // Ignored - no truncation
}> = ({ stepNum, step }) => {
  const modelKey = step.model || extractModelFromTool(step.tool);
  const config = getModelConfig(modelKey);
  const icon = getModelIcon(modelKey);
  const displayOutput = step.output;  // Full output, no truncation

  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor={config.color} paddingX={1}>
      {/* Step header */}
      <Box marginBottom={1}>
        <Text bold color={config.color}>{icon}</Text>
        <Text bold> Step {stepNum}: </Text>
        <Text bold color="#00D7FF">{step.step}</Text>
      </Box>

      {/* Model/Tool info */}
      <Box>
        <Text dimColor>Tool: </Text>
        <Text color="#AF87FF">{step.tool || 'unknown'}</Text>
        {step.model && (
          <>
            <Text dimColor> │ Model: </Text>
            <Text color={config.color}>{step.model}</Text>
          </>
        )}
        {step.duration && (
          <>
            <Text dimColor> │ </Text>
            <Text color="#5FAF5F">{(step.duration / 1000).toFixed(1)}s</Text>
          </>
        )}
      </Box>

      {/* Gradient divider */}
      <Box marginTop={1}>
        <Gradient colors={config.gradient}>
          {'─'.repeat(60)}
        </Gradient>
      </Box>

      {/* Output - rendered with Ink Markdown */}
      <Box marginTop={1} flexDirection="column">
        <Markdown>{displayOutput}</Markdown>
      </Box>

      {/* File path */}
      {step.filePath && (
        <Box marginTop={1}>
          <Text dimColor>{nerdIcons.file} Full output: </Text>
          <Text color="#5F87FF">{step.filePath}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Comparison table using SimpleTable from ink-table.tsx
 */
const ComparisonTable: React.FC<{ steps: StepResult[] }> = ({ steps }) => {
  // Build headers and rows for SimpleTable
  const headers = ['Step', 'Model', 'Summary'];

  const rows = steps.map(step => {
    const modelKey = step.model || extractModelFromTool(step.tool);
    const icon = getModelIcon(modelKey);
    const firstLine = step.output.split('\n')[0] || '';
    const summary = truncateText(firstLine, 35);

    return [
      step.step,
      `${icon} ${modelKey}`,
      summary,
    ];
  });

  // Theme for table - colored borders and header
  const tableTheme: TableTheme = {
    borderColor: '#60A5FA',
    headerColor: '#000000',
    headerBgColor: '#60A5FA',
    headerBold: true,
    cellColor: undefined,
  };

  return (
    <Box flexDirection="column" marginTop={2}>
      {/* Header gradient */}
      <Box marginBottom={1}>
        <Gradient colors={['#60A5FA', '#A78BFA', '#F472B6']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box>
        <Text bold color="#60A5FA">
          {nerdIcons.table} Comparison Summary
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Gradient colors={['#60A5FA', '#A78BFA', '#F472B6']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>

      {/* Table using SimpleTable */}
      <TableThemeProvider theme={tableTheme}>
        <SimpleTable
          headers={headers}
          rows={rows}
          minColWidth={10}
          maxColWidth={40}
        />
      </TableThemeProvider>
    </Box>
  );
};

/**
 * Judge result component with colors
 */
const JudgeResultCard: React.FC<{ judge: JudgeResult }> = ({ judge }) => {
  const judgeIcon = nerdIcons.brain;
  const trophyIcon = nerdIcons.star;

  return (
    <Box flexDirection="column" marginTop={2}>
      {/* Header */}
      <Box marginBottom={1}>
        <Gradient colors={['#F59E0B', '#EF4444', '#EC4899']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box>
        <Text bold color="#F59E0B">{judgeIcon} Judge Evaluation</Text>
      </Box>
      <Box marginBottom={1}>
        <Gradient colors={['#F59E0B', '#EF4444', '#EC4899']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>

      {/* Winner */}
      {judge.winner && (
        <Box marginBottom={1}>
          <Text bold color="#22C55E">{trophyIcon} Winner: </Text>
          <Text bold color="#FDE047">{judge.winner}</Text>
        </Box>
      )}

      {/* Rankings */}
      {judge.rankings && judge.rankings.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="#60A5FA">Rankings:</Text>
          {judge.rankings.map((step, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const color = i === 0 ? '#FDE047' : i === 1 ? '#D1D5DB' : i === 2 ? '#CD7F32' : undefined;
            return (
              <Box key={i} marginLeft={2}>
                <Text color={color}>{medal} {step}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Scores */}
      {judge.scores && Object.keys(judge.scores).length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="#60A5FA">Scores:</Text>
          {Object.entries(judge.scores).map(([step, score], i) => {
            const scoreColor = score >= 8 ? '#22C55E' : score >= 5 ? '#FDE047' : '#EF4444';
            return (
              <Box key={i} marginLeft={2}>
                <Text>{step}: </Text>
                <Text color={scoreColor} bold>{score}/10</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Reasoning */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="#A78BFA"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="#A78BFA">Reasoning:</Text>
        <Box marginTop={1} flexDirection="column">
          {judge.reasoning.split('\n').map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Footer component
 */
const WorkflowFooter: React.FC<{ status: string }> = ({ status }) => {
  const statusColor = status === 'completed' ? '#22C55E' : status === 'failed' ? '#EF4444' : '#F59E0B';
  const statusIcon = status === 'completed'
    ? nerdIcons.checkCircle
    : status === 'failed'
    ? nerdIcons.error
    : nerdIcons.sync;

  return (
    <Box flexDirection="column" marginTop={2}>
      <Box>
        <Gradient colors={['#34D399', '#22D3EE', '#818CF8']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box marginTop={1}>
        <Text bold color={statusColor}>{statusIcon} Workflow {status}</Text>
      </Box>
    </Box>
  );
};

/**
 * Main workflow result view
 */
const WorkflowResultView: React.FC<{
  result: WorkflowResult;
  options: RenderWorkflowOptions;
}> = ({ result, options }) => {
  const maxSummaryLength = options.maxSummaryLength || 500;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <WorkflowHeader
        name={result.workflowName}
        duration={result.duration}
        stepCount={result.steps.length}
      />

      {/* Step results */}
      {result.steps.map((step, i) => (
        <StepResultCard
          key={i}
          stepNum={i + 1}
          step={step}
          maxSummaryLength={maxSummaryLength}
        />
      ))}

      {/* Comparison table (if enabled and >1 step) */}
      {options.includeComparison && result.steps.length > 1 && (
        <ComparisonTable steps={result.steps} />
      )}

      {/* Judge result (if enabled) */}
      {options.includeJudging && options.judgeResult && (
        <JudgeResultCard judge={options.judgeResult} />
      )}

      {/* Footer */}
      <WorkflowFooter status={result.status} />
    </Box>
  );
};

// ============================================================================
// SINGLE STEP COMPONENTS (for streaming workflow)
// ============================================================================

/**
 * Progress header for single step rendering
 */
const SingleStepHeader: React.FC<{
  workflowName: string;
  currentStep: number;
  totalSteps: number;
  elapsedTime?: number;
}> = ({ workflowName, currentStep, totalSteps, elapsedTime }) => {
  const wfIcon = nerdIcons.robot;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);
  const progressBarWidth = 40;
  const filledWidth = Math.round((currentStep / totalSteps) * progressBarWidth);
  const emptyWidth = progressBarWidth - filledWidth;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Gradient colors={['#34D399', '#22D3EE', '#818CF8']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box marginTop={1}>
        <Text bold color="#34D399">{wfIcon} Workflow:</Text>
        <Text bold> {workflowName}</Text>
        <Text dimColor> │ Step </Text>
        <Text bold color="#00D7FF">{currentStep}</Text>
        <Text dimColor>/{totalSteps}</Text>
        <Text dimColor> │ </Text>
        <Text color="#22C55E">{progressPercent}%</Text>
      </Box>
      {/* Progress bar */}
      <Box marginTop={1}>
        <Text dimColor>[</Text>
        <Text color="#22C55E">{'█'.repeat(filledWidth)}</Text>
        <Text dimColor>{'░'.repeat(emptyWidth)}</Text>
        <Text dimColor>]</Text>
        {elapsedTime !== undefined && (
          <>
            <Text dimColor> │ </Text>
            <Text color="#5FAF5F">{(elapsedTime / 1000).toFixed(1)}s</Text>
          </>
        )}
      </Box>
      <Box marginTop={1}>
        <Gradient colors={['#34D399', '#22D3EE', '#818CF8']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
    </Box>
  );
};

/**
 * Single step view for streaming workflow execution
 */
const SingleStepView: React.FC<{
  step: StepResult;
  stepNum: number;
  totalSteps: number;
  workflowName: string;
  elapsedTime?: number;
  maxSummaryLength?: number;
}> = ({ step, stepNum, totalSteps, workflowName, elapsedTime, maxSummaryLength = 6400 }) => {
  return (
    <Box flexDirection="column">
      <SingleStepHeader
        workflowName={workflowName}
        currentStep={stepNum}
        totalSteps={totalSteps}
        elapsedTime={elapsedTime}
      />
      <StepResultCard
        stepNum={stepNum}
        step={step}
        maxSummaryLength={maxSummaryLength}
      />
    </Box>
  );
};

/**
 * Workflow completion summary view
 */
const WorkflowSummaryView: React.FC<{
  workflowName: string;
  totalSteps: number;
  totalDuration: number;
  summary: string;
  steps?: StepResult[];
  includeComparison?: boolean;
}> = ({ workflowName, totalSteps, totalDuration, summary, steps, includeComparison }) => {
  const successIcon = nerdIcons.checkCircle;

  return (
    <Box flexDirection="column">
      {/* Completion header */}
      <Box>
        <Gradient colors={['#22C55E', '#34D399', '#10B981']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
      <Box marginTop={1}>
        <Text bold color="#22C55E">{successIcon} Workflow Complete:</Text>
        <Text bold> {workflowName}</Text>
      </Box>
      <Box>
        <Text dimColor>Steps: {totalSteps} │ Duration: {(totalDuration / 1000).toFixed(1)}s</Text>
      </Box>
      <Box marginTop={1}>
        <Gradient colors={['#22C55E', '#34D399', '#10B981']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>

      {/* Summary content */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="#22C55E"
        paddingX={1}
        marginTop={1}
        marginBottom={1}
      >
        <Text bold color="#22C55E">Summary:</Text>
        <Box marginTop={1} flexDirection="column">
          {summary.split('\n').map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      </Box>

      {/* Comparison table if enabled and multiple steps */}
      {includeComparison && steps && steps.length > 1 && (
        <ComparisonTable steps={steps} />
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Gradient colors={['#22C55E', '#34D399', '#10B981']}>
          {'━'.repeat(70)}
        </Gradient>
      </Box>
    </Box>
  );
};

// ============================================================================
// MAIN RENDER FUNCTIONS
// ============================================================================

/**
 * Render a single workflow step (for streaming execution)
 */
export function renderSingleStep(
  step: StepResult,
  stepNum: number,
  totalSteps: number,
  workflowName: string,
  options: {
    elapsedTime?: number;
    maxSummaryLength?: number;
  } = {}
): string {
  const stream = new PassThrough();
  let output = '';

  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const { unmount } = render(
    <SingleStepView
      step={step}
      stepNum={stepNum}
      totalSteps={totalSteps}
      workflowName={workflowName}
      elapsedTime={options.elapsedTime}
      maxSummaryLength={options.maxSummaryLength}
    />,
    {
      stdout: stream as unknown as NodeJS.WriteStream,
      exitOnCtrlC: false,
      patchConsole: false,
    }
  );

  unmount();
  return output;
}

/**
 * Render workflow completion summary
 */
export function renderWorkflowSummary(
  workflowName: string,
  totalSteps: number,
  totalDuration: number,
  summary: string,
  options: {
    steps?: StepResult[];
    includeComparison?: boolean;
  } = {}
): string {
  const stream = new PassThrough();
  let output = '';

  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const { unmount } = render(
    <WorkflowSummaryView
      workflowName={workflowName}
      totalSteps={totalSteps}
      totalDuration={totalDuration}
      summary={summary}
      steps={options.steps}
      includeComparison={options.includeComparison}
    />,
    {
      stdout: stream as unknown as NodeJS.WriteStream,
      exitOnCtrlC: false,
      patchConsole: false,
    }
  );

  unmount();
  return output;
}

/**
 * Render workflow result using React Ink
 */
export function renderWorkflowResult(
  result: WorkflowResult,
  options: RenderWorkflowOptions = {}
): string {
  const stream = new PassThrough();
  let output = '';

  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const { unmount } = render(
    <WorkflowResultView result={result} options={options} />,
    {
      stdout: stream as unknown as NodeJS.WriteStream,
      exitOnCtrlC: false,
      patchConsole: false,
    }
  );

  unmount();
  return output;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  WorkflowHeader,
  StepResultCard,
  ComparisonTable,
  JudgeResultCard,
  WorkflowFooter,
  WorkflowResultView,
  SingleStepHeader,
  SingleStepView,
  WorkflowSummaryView,
  getModelIcon,
  getModelConfig,
  extractModelFromTool,
};
