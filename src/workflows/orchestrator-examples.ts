import { ToolOrchestrator } from './tool-orchestrator.js';

// Example usage of the intelligent tool orchestrator
export async function demonstrateToolOrchestrator() {
  const orchestrator = new ToolOrchestrator();

  console.error('🎯 Tool Orchestrator Demo\n');

  // Example 1: Simple question
  const example1 = "What is TypeScript?";
  console.error(`📝 Query: "${example1}"`);
  const rec1 = orchestrator.recommendTools(example1);
  console.error('🤖 Recommended workflow:');
  rec1.workflow.forEach((step, i) => {
    console.error(`  ${i + 1}. ${step.toolId}: ${step.reason}`);
  });
  console.error(`📊 Analysis: ${rec1.analysis.category}, ${rec1.analysis.complexity}, ${rec1.analysis.timeConstraint}\n`);

  // Example 2: Complex technical analysis
  const example2 = "Analyze my React application architecture for performance bottlenecks and security vulnerabilities";
  console.error(`📝 Query: "${example2}"`);
  const rec2 = orchestrator.recommendTools(example2);
  console.error('🤖 Recommended workflow:');
  rec2.workflow.forEach((step, i) => {
    console.error(`  ${i + 1}. ${step.toolId}: ${step.reason}`);
  });
  console.error(`📊 Analysis: ${rec2.analysis.category}, ${rec2.analysis.complexity}, ${rec2.analysis.timeConstraint}\n`);

  // Example 3: Research project
  const example3 = "I need comprehensive research on current AI safety practices for deployment in production systems";
  console.error(`📝 Query: "${example3}"`);
  const rec3 = orchestrator.recommendTools(example3);
  console.error('🤖 Recommended workflow:');
  rec3.workflow.forEach((step, i) => {
    console.error(`  ${i + 1}. ${step.toolId}: ${step.reason}`);
  });
  console.error(`📊 Analysis: ${rec3.analysis.category}, ${rec3.analysis.complexity}, ${rec3.analysis.timeConstraint}\n`);

  // Example 4: Urgent simple task
  const example4 = "Quickly validate this code snippet for security issues";
  console.error(`📝 Query: "${example4}"`);
  const rec4 = orchestrator.recommendTools(example4);
  console.error('🤖 Recommended workflow:');
  rec4.workflow.forEach((step, i) => {
    console.error(`  ${i + 1}. ${step.toolId}: ${step.reason}`);
  });
  console.error(`📊 Analysis: ${rec4.analysis.category}, ${rec4.analysis.complexity}, ${rec4.analysis.timeConstraint}\n`);

  // Show orchestrator capabilities
  console.error('🔧 Orchestrator Status:');
  const status = orchestrator.getStatus();
  console.error(`  Available tools: ${status.totalTools}`);
  console.error(`  Categories: ${status.categories.join(', ')}`);
  console.error(`  Tools: ${status.availableTools.join(', ')}`);
}

// Smart workflow examples for different scenarios
export const ORCHESTRATION_SCENARIOS = {
  // Quick fact-checking
  factCheck: {
    query: "What is the latest version of Node.js?",
    expectedFlow: ['perplexity_ask'],
    reason: "Simple factual question needs quick, current answer"
  },

  // Initial exploration
  exploration: {
    query: "I want to understand microservices architecture",
    expectedFlow: ['scout', 'think'],
    reason: "Exploration task needs context gathering, then reflection"
  },

  // Complex technical analysis
  technicalAnalysis: {
    query: "Analyze this codebase for architectural improvements and security issues",
    expectedFlow: ['scout', 'architect', 'focus', 'challenger', 'verifier'],
    reason: "Complex technical task needs comprehensive analysis and validation"
  },

  // Research project
  researchProject: {
    query: "Comprehensive research on quantum computing applications in cryptography",
    expectedFlow: ['perplexity_research', 'focus', 'challenger'],
    reason: "Research task needs deep investigation, reasoning, and validation"
  },

  // Code review
  codeReview: {
    query: "Review this React component for bugs and improvements",
    expectedFlow: ['code_reviewer', 'challenger', 'test_architect'],
    reason: "Code review needs specialized analysis, challenges, and test recommendations"
  },

  // Urgent debugging
  urgentDebugging: {
    query: "Quickly debug this production error in our API",
    expectedFlow: ['scout', 'nextThought', 'challenger'],
    reason: "Urgent task needs fast context, structured thinking, validation"
  },

  // System design
  systemDesign: {
    query: "Design a scalable e-commerce platform architecture",
    expectedFlow: ['scout', 'architect', 'focus', 'challenger', 'verifier'],
    reason: "Design task needs research, architecture, reasoning, validation"
  },

  // Data-driven decision
  dataDecision: {
    query: "Should we migrate from MongoDB to PostgreSQL based on current performance data?",
    expectedFlow: ['perplexity_reason', 'architect', 'challenger'],
    reason: "Decision needs current data, technical analysis, critical evaluation"
  }
};

// Test the orchestrator's decision making
export function testOrchestrationLogic() {
  const orchestrator = new ToolOrchestrator();
  
  console.error('🧪 Testing Orchestration Logic\n');
  
  Object.entries(ORCHESTRATION_SCENARIOS).forEach(([scenario, config]) => {
    console.error(`📋 Scenario: ${scenario}`);
    console.error(`   Query: "${config.query}"`);
    
    const recommendations = orchestrator.recommendTools(config.query);
    const actualFlow = recommendations.workflow.map(step => step.toolId);
    
    console.error(`   Expected: [${config.expectedFlow.join(', ')}]`);
    console.error(`   Actual:   [${actualFlow.join(', ')}]`);
    console.error(`   Reason: ${config.reason}`);
    
    // Check if key tools are included
    const hasKeyTools = config.expectedFlow.some(tool => actualFlow.includes(tool));
    console.error(`   ✅ Has key tools: ${hasKeyTools}`);
    console.error('');
  });
}

// Example integration with YAML workflows
export function generateDynamicWorkflow(query: string, context?: string) {
  const orchestrator = new ToolOrchestrator();
  const recommendations = orchestrator.recommendTools(query, context);
  
  // Generate YAML workflow dynamically
  const workflow = {
    name: "Dynamic AI Orchestrated Workflow",
    version: "1.0",
    description: `Automatically orchestrated workflow for: ${query}`,
    tags: ["dynamic", "ai-orchestrated", recommendations.analysis.category],
    
    ai_enhancements: {
      circuit_breakers: true,
      intelligent_orchestration: true,
      adaptive_routing: true
    },
    
    steps: recommendations.workflow.map((step, index) => ({
      id: `step_${index + 1}`,
      type: step.toolId.includes('perplexity') ? 'tachibot-mcp-tool' :
            step.toolId.includes('focus') ? 'tachibot-mcp-tool' :
            'tachibot-mcp-tool',
      tool: step.toolId,
      config: {
        reason: step.reason,
        auto_selected: true
      },
      circuit_breaker: {
        failure_threshold: 3,
        recovery_timeout: '10s'
      }
    })),
    
    metadata: {
      generated_by: "ToolOrchestrator",
      analysis: recommendations.analysis,
      timestamp: new Date().toISOString()
    }
  };
  
  return workflow;
}

// CLI-like interface for testing
export function orchestratorCLI(query: string): string {
  const orchestrator = new ToolOrchestrator();
  const recommendations = orchestrator.recommendTools(query);
  
  let output = `🎯 Orchestration for: "${query}"\n\n`;
  
  output += `📊 Analysis:\n`;
  output += `   Category: ${recommendations.analysis.category}\n`;
  output += `   Complexity: ${recommendations.analysis.complexity}\n`;
  output += `   Domain: ${recommendations.analysis.domain}\n`;
  output += `   Time Constraint: ${recommendations.analysis.timeConstraint}\n`;
  output += `   Quality Requirement: ${recommendations.analysis.qualityRequirement}\n\n`;
  
  output += `🤖 Recommended Workflow:\n`;
  recommendations.workflow.forEach((step, index) => {
    output += `   ${index + 1}. ${step.toolId}\n`;
    output += `      └─ ${step.reason}\n`;
  });
  
  output += `\n💡 Primary Tools: ${recommendations.primary.map(p => p.toolId).join(', ')}\n`;
  
  return output;
}