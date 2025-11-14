import { WorkflowDefinition, WorkflowType } from './types.js';

export const workflows: Record<WorkflowType, WorkflowDefinition> = {
  [WorkflowType.CREATIVE_DISCOVERY]: {
    name: '🎨 Creative Discovery',
    type: WorkflowType.CREATIVE_DISCOVERY,
    description: 'Generate innovative ideas and explore possibilities',
    steps: [
      {
        tool: 'gemini_brainstorm',
        promptTechnique: 'what_if_speculation',
        adaptationCheck: true
      },
      {
        tool: 'openai_brainstorm',
        promptTechnique: 'alternative_perspectives',
        optional: false
      },
      {
        tool: 'perplexity_research',
        promptTechnique: 'evidence_gathering',
        optional: true,
        adaptationCheck: true,
        adaptationThreshold: 300
      },
      {
        tool: 'think',
        promptTechnique: 'quick_reflection',
        optional: false
      },
      {
        tool: 'openai_reason',
        promptTechnique: 'feasibility_analysis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  ★ ★  @     @  ◎ ◎  @     @  ○ ○  @     @  ● ●  @     @  ◉ ◉  @
     @ \\___// @     @   ~   @     @  \\_/  @     @   ◡   @     @   -   @
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     gemini[{g}] → openai[{o}] → perplexity[{p}]? → think[{t}] → reason[{r}]
     
🧠 Technique: {technique}
📊 Progress: {progress}
💭 Current: {current}`
  },

  [WorkflowType.DEEP_RESEARCH]: {
    name: '🔬 Deep Research',
    type: WorkflowType.DEEP_RESEARCH,
    description: 'Comprehensive investigation with evidence gathering',
    steps: [
      {
        tool: 'perplexity_research',
        promptTechnique: 'comprehensive_investigation',
        adaptationCheck: true,
        adaptationThreshold: 500
      },
      {
        tool: 'think',
        promptTechnique: 'pattern_recognition',
        optional: false
      },
      {
        tool: 'openai_reason',
        promptTechnique: 'systematic_analysis',
        optional: false
      },
      {
        tool: 'gemini_brainstorm',
        promptTechnique: 'creative_applications',
        optional: true
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  ○ ○  @     @  ● ●  @     @  ◉ ◉  @     @  ★ ★  @
     @  \\_/  @     @   ◡   @     @   ~   @     @ \\o// @
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     perplex[{p}] → think[{t}] → reason[{r}] → gemini[{g}]
     
🔍 Technique: {technique}
📊 Progress: {progress}
📚 Current: {current}`
  },

  [WorkflowType.PROBLEM_SOLVING]: {
    name: '🧩 Problem Solving',
    type: WorkflowType.PROBLEM_SOLVING,
    description: 'Break down and solve complex problems systematically',
    steps: [
      {
        tool: 'think',
        promptTechnique: 'problem_decomposition',
        optional: false
      },
      {
        tool: 'openai_reason',
        promptTechnique: 'first_principles',
        optional: false
      },
      {
        tool: 'perplexity_research',
        promptTechnique: 'evidence_gathering',
        optional: false,
        adaptationCheck: true
      },
      {
        tool: 'gemini_brainstorm',
        promptTechnique: 'innovative_solutions',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  ● ●  @     @  ◉ ◉  @     @  ○ ○  @     @  ★ ★  @
     @   ◡   @     @   ≡   @     @  \\_/  @     @   !   @
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     think[{t}] → reason[{r}] → perplex[{p}] → gemini[{g}]
     
🔧 Technique: {technique}
📊 Progress: {progress}
💡 Current: {current}`
  },

  [WorkflowType.SYNTHESIS]: {
    name: '🎯 Synthesis',
    type: WorkflowType.SYNTHESIS,
    description: 'Combine multiple perspectives into coherent insights',
    steps: [
      {
        tool: 'gemini_brainstorm',
        promptTechnique: 'exploratory_angles',
        optional: false
      },
      {
        tool: 'perplexity_research',
        promptTechnique: 'comprehensive_data',
        optional: false
      },
      {
        tool: 'openai_reason',
        promptTechnique: 'analytical_framework',
        optional: false
      },
      {
        tool: 'think',
        promptTechnique: 'integration_reflection',
        optional: false
      }
    ],
    visualTemplate: `
     gemini[{g}] ↘
                  ↘
     perplex[{p}] → think[{t}] → SYNTHESIS
                  ↗
     openai[{o}] ↗
     
🔀 Technique: {technique}
📊 Progress: {progress}
🎯 Current: {current}`
  },

  [WorkflowType.FACT_CHECK]: {
    name: '✅ Fact Check',
    type: WorkflowType.FACT_CHECK,
    description: 'Validate claims and ideas with evidence-based analysis',
    steps: [
      {
        tool: 'think',
        promptTechnique: 'problem_decomposition',
        optional: false
      },
      {
        tool: 'perplexity_research',
        promptTechnique: 'comprehensive_investigation',
        adaptationCheck: true,
        adaptationThreshold: 500
      },
      {
        tool: 'openai_reason',
        promptTechnique: 'systematic_analysis',
        optional: false
      },
      {
        tool: 'gemini_brainstorm',
        promptTechnique: 'alternative_perspectives',
        optional: false
      },
      {
        tool: 'think',
        promptTechnique: 'integration_reflection',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  ● ●  @     @  ○ ○  @     @  ◉ ◉  @     @  ★ ★  @     @  ● ●  @
     @   ?   @     @  \\_/  @     @   ≡   @     @   ~   @     @   !   @
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     think[{t}] → perplex[{p}] → reason[{r}] → gemini[{g}] → think[{t2}]
     
✅ Technique: {technique}
📊 Progress: {progress}
🔍 Current: {current}`
  },

  // Developer-Focused Workflows
  [WorkflowType.RAPID_PROTOTYPE]: {
    name: '🚀 Rapid Prototype',
    type: WorkflowType.RAPID_PROTOTYPE,
    description: 'From idea to working demo in minutes',
    steps: [
      {
        tool: 'scout',
        promptTechnique: 'requirement_gathering',
        optional: false
      },
      {
        tool: 'architect',
        promptTechnique: 'system_design',
        optional: false
      },
      {
        tool: 'code_reviewer',
        promptTechnique: 'design_validation',
        optional: true
      },
      {
        tool: 'documentation_writer',
        promptTechnique: 'quick_documentation',
        optional: true
      },
      {
        tool: 'think',
        promptTechnique: 'prototype_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  🔍  @     @  🏗️  @     @  ✅  @     @  📝  @     @  🎯  @
     @scout @     @archi @     @review@     @ docs @     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     scout[{s}] → arch[{a}] → review[{r}] → docs[{d}] → think[{t}]
     
🚀 Technique: {technique}
📊 Progress: {progress}
⚡ Current: {current}`
  },

  [WorkflowType.CODE_QUALITY]: {
    name: '🔧 Code Quality',
    type: WorkflowType.CODE_QUALITY,
    description: 'Comprehensive code improvement pipeline',
    steps: [
      {
        tool: 'code_reviewer',
        promptTechnique: 'comprehensive_review',
        optional: false
      },
      {
        tool: 'test_architect',
        promptTechnique: 'test_generation',
        optional: false
      },
      {
        tool: 'challenger',
        promptTechnique: 'code_questioning',
        optional: false
      },
      {
        tool: 'auditor',
        promptTechnique: 'quality_audit',
        optional: false
      },
      {
        tool: 'think',
        promptTechnique: 'quality_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  👀  @     @  🧪  @     @  ⚔️  @     @  🔍  @     @  💎  @
     @review@     @ test @     @chall @     @audit @     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     review[{r}] → test[{t}] → chall[{c}] → audit[{a}] → think[{s}]
     
🔧 Technique: {technique}
📊 Progress: {progress}
💎 Current: {current}`
  },

  [WorkflowType.SECURE_DEPLOYMENT]: {
    name: '🛡️ Secure Deployment',
    type: WorkflowType.SECURE_DEPLOYMENT,
    description: 'Security-first deployment pipeline',
    steps: [
      {
        tool: 'auditor',
        promptTechnique: 'security_audit',
        optional: false
      },
      {
        tool: 'commit_guardian',
        promptTechnique: 'pre_deploy_validation',
        optional: false
      },
      {
        tool: 'verifier',
        promptTechnique: 'deployment_verification',
        optional: false
      },
      {
        tool: 'challenger',
        promptTechnique: 'security_questioning',
        optional: true
      },
      {
        tool: 'think',
        promptTechnique: 'deployment_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  🔒  @     @  🛡️  @     @  ✅  @     @  ⚔️  @     @  🚀  @
     @audit @     @guard @     @verify@     @chall @     @deploy@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     audit[{a}] → guard[{g}] → verify[{v}] → chall[{c}] → think[{d}]
     
🛡️ Technique: {technique}
📊 Progress: {progress}
🔐 Current: {current}`
  },

  [WorkflowType.FULL_STACK_DEVELOPMENT]: {
    name: '🏗️ Full-Stack Dev',
    type: WorkflowType.FULL_STACK_DEVELOPMENT,
    description: 'End-to-end feature development',
    steps: [
      {
        tool: 'architect',
        promptTechnique: 'system_architecture',
        optional: false
      },
      {
        tool: 'code_reviewer',
        promptTechnique: 'implementation_review',
        optional: false
      },
      {
        tool: 'test_architect',
        promptTechnique: 'full_stack_testing',
        optional: false
      },
      {
        tool: 'documentation_writer',
        promptTechnique: 'comprehensive_docs',
        optional: false
      },
      {
        tool: 'commit_guardian',
        promptTechnique: 'final_validation',
        optional: true
      },
      {
        tool: 'think',
        promptTechnique: 'feature_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  🏗️  @     @  👀  @     @  🧪  @     @  📝  @     @  🛡️  @     @  ✨  @
     @archi @     @review@     @ test @     @ docs @     @guard @     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     arch[{a}] → review[{r}] → test[{t}] → docs[{d}] → guard[{g}] → think[{s}]
     
🏗️ Technique: {technique}
📊 Progress: {progress}
🎯 Current: {current}`
  },

  [WorkflowType.TEST_DRIVEN_DEVELOPMENT]: {
    name: '🧪 Test-Driven Dev',
    type: WorkflowType.TEST_DRIVEN_DEVELOPMENT,
    description: 'TDD workflow with comprehensive testing',
    steps: [
      {
        tool: 'test_architect',
        promptTechnique: 'test_first_design',
        optional: false
      },
      {
        tool: 'code_reviewer',
        promptTechnique: 'tdd_validation',
        optional: false
      },
      {
        tool: 'challenger',
        promptTechnique: 'test_questioning',
        optional: false
      },
      {
        tool: 'verifier',
        promptTechnique: 'test_verification',
        optional: false
      },
      {
        tool: 'think',
        promptTechnique: 'tdd_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  🧪  @     @  👀  @     @  ⚔️  @     @  ✅  @     @  🎯  @
     @ test @     @review@     @chall @     @verify@     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     test[{t}] → review[{r}] → chall[{c}] → verify[{v}] → think[{s}]
     
🧪 Technique: {technique}
📊 Progress: {progress}
🔬 Current: {current}`
  },

  [WorkflowType.CODE_REVIEW_WORKFLOW]: {
    name: '👁️ Code Review',
    type: WorkflowType.CODE_REVIEW_WORKFLOW,
    description: 'Thorough code review with learning',
    steps: [
      {
        tool: 'code_reviewer',
        promptTechnique: 'socratic_review',
        optional: false
      },
      {
        tool: 'challenger',
        promptTechnique: 'assumption_challenging',
        optional: false
      },
      {
        tool: 'auditor',
        promptTechnique: 'evidence_audit',
        optional: true
      },
      {
        tool: 'think',
        promptTechnique: 'review_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  👁️  @     @  ⚔️  @     @  🔍  @     @  🕵️  @     @  📋  @
     @review@     @chall @     @audit @     @hunt  @     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     review[{r}] → chall[{c}] → audit[{a}] → hunt[{h}] → think[{s}]
     
👁️ Technique: {technique}
📊 Progress: {progress}
🔍 Current: {current}`
  },

  [WorkflowType.DOCUMENTATION_GENERATION]: {
    name: '📚 Doc Generation',
    type: WorkflowType.DOCUMENTATION_GENERATION,
    description: 'Comprehensive documentation creation',
    steps: [
      {
        tool: 'scout',
        promptTechnique: 'code_exploration',
        optional: false
      },
      {
        tool: 'documentation_writer',
        promptTechnique: 'narrative_docs',
        optional: false
      },
      {
        tool: 'code_reviewer',
        promptTechnique: 'documentation_review',
        optional: true
      },
      {
        tool: 'challenger',
        promptTechnique: 'doc_questioning',
        optional: true
      },
      {
        tool: 'think',
        promptTechnique: 'documentation_synthesis',
        optional: false
      }
    ],
    visualTemplate: `
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     @  🔍  @     @  📝  @     @  👀  @     @  ❓  @     @  📚  @
     @scout @     @ docs @     @review@     @chall @     @synth@
     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@     @@@@@@@@@
     scout[{s}] → docs[{d}] → review[{r}] → chall[{c}] → think[{t}]
     
📚 Technique: {technique}
📊 Progress: {progress}
✍️ Current: {current}`
  }
};

// Prompt technique descriptions for user visibility
export const promptTechniques = {
  // Creative techniques
  what_if_speculation: 'Exploring possibilities with "What if..." questions',
  alternative_perspectives: 'Viewing from different angles and domains',
  creative_applications: 'Finding innovative uses and connections',
  innovative_solutions: 'Generating novel approaches to problems',
  exploratory_angles: 'Discovering unexpected dimensions',

  // Research techniques
  comprehensive_investigation: 'Systematic data gathering with 5W1H framework',
  evidence_gathering: 'Finding supporting and contradicting evidence',
  comprehensive_data: 'Collecting data from multiple sources',

  // Analytical techniques
  systematic_analysis: 'Step-by-step logical examination',
  first_principles: 'Breaking down to fundamental truths',
  feasibility_analysis: 'Evaluating practical implementation',
  analytical_framework: 'Structured analytical approach',

  // Reflective techniques
  quick_reflection: 'Brief pattern recognition and insight capture',
  pattern_recognition: 'Identifying recurring themes and connections',
  problem_decomposition: 'Breaking complex problems into components',
  integration_reflection: 'Synthesizing insights from multiple sources',

  // Developer-focused techniques
  requirement_gathering: 'Extracting and clarifying project requirements',
  system_design: 'Creating architectural blueprints and system design',
  design_validation: 'Reviewing and validating design decisions',
  quick_documentation: 'Rapid documentation generation for prototypes',
  prototype_synthesis: 'Combining prototype elements into coherent design',
  comprehensive_review: 'Thorough code analysis with multiple perspectives',
  test_generation: 'Creating comprehensive test suites and edge cases',
  code_questioning: 'Challenging code assumptions and design choices',
  quality_audit: 'Systematic quality assessment and improvement suggestions',
  quality_synthesis: 'Integrating quality insights into actionable recommendations',
  security_audit: 'Deep security vulnerability analysis',
  pre_deploy_validation: 'Pre-deployment checks and validations',
  deployment_verification: 'Verifying deployment readiness and safety',
  security_questioning: 'Challenging security assumptions and practices',
  deployment_synthesis: 'Synthesizing deployment insights and recommendations',
  system_architecture: 'End-to-end system architecture design',
  implementation_review: 'Reviewing implementation against requirements',
  full_stack_testing: 'Comprehensive testing across all system layers',
  comprehensive_docs: 'Creating complete documentation suite',
  final_validation: 'Final checks before feature completion',
  feature_synthesis: 'Integrating all feature development insights',
  test_first_design: 'Designing tests before implementation (TDD)',
  tdd_validation: 'Validating TDD practices and test quality',
  test_questioning: 'Challenging test coverage and effectiveness',
  test_verification: 'Verifying test completeness and quality',
  tdd_synthesis: 'Synthesizing TDD insights and recommendations',
  socratic_review: 'Educational code review with guiding questions',
  assumption_challenging: 'Challenging code and design assumptions',
  evidence_audit: 'Requiring evidence for all claims and decisions',
  dependency_tracing: 'Tracing code dependencies and relationships',
  review_synthesis: 'Synthesizing review insights and learning points',
  code_exploration: 'Exploring codebase structure and patterns',
  narrative_docs: 'Creating engaging, story-driven documentation',
  documentation_review: 'Reviewing documentation for clarity and completeness',
  doc_questioning: 'Challenging documentation assumptions and gaps',
  documentation_synthesis: 'Synthesizing documentation insights and improvements'
};

// Helper function to get visual status indicator
export function getStatusIndicator(status: string): string {
  const indicators: Record<string, string> = {
    idle: '  ',
    processing: '..',
    complete: '✓',
    error: '!!'
  };
  return indicators[status] || '  ';
}