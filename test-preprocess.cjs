const yaml = require('yaml');
const fs = require('fs');

const content = fs.readFileSync('workflows/code-review.yaml', 'utf-8');
const data = yaml.parse(content);

// Simulate preprocessWorkflowVariables
const variables = data.variables || {};
console.log('Workflow variables:', variables);

function preprocess(obj, vars) {
  if (typeof obj === 'string') {
    if (!obj.includes('${')) return obj;

    const interpolated = obj.replace(/\$\{([^}]+)\}/g, (match, key) => {
      const value = vars[key];
      if (value === undefined) {
        console.log('  Keeping unresolved:', match);
        return match;
      }
      return value;
    });

    return interpolated;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => preprocess(item, vars));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'variables') {
        result[key] = value;
      } else {
        result[key] = preprocess(value, vars);
      }
    }
    return result;
  }
  return obj;
}

const preprocessed = preprocess(data, variables);
console.log('\nStep 2 input after preprocess:', JSON.stringify(preprocessed.steps[1].input, null, 2));
console.log('\nStep 2 code field value:', preprocessed.steps[1].input.code);
console.log('Step 2 code field type:', typeof preprocessed.steps[1].input.code);
