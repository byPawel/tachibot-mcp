import { workflowEngine } from './dist/src/workflows/custom-workflows.js';

try {
  console.log('🧪 Testing PromptEnhancementHandler...\n');

  const result = await workflowEngine.executeWorkflow(
    'test-prompt-enhancement',
    'Testing prompt engineering integration'
  );

  console.log('\n✅ Workflow executed successfully!\n');
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error('\n❌ Workflow execution failed:');
  console.error(error);
  process.exit(1);
}
