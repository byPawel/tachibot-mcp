export interface DocumentationOptions {
  model?: string;
  maxTokens?: number;
  style?: 'narrative' | 'technical' | 'beginner-friendly' | 'api-reference';
  includeExamples?: boolean;
  generateToc?: boolean;
  format?: 'markdown' | 'html' | 'plain';
}

export interface DocumentationResult {
  readme: string;
  apiDocs: ApiDocumentation[];
  inlineComments: InlineComment[];
  changelog: string;
  narrativeDoc?: string;
  synthesis: string;
}

export interface ApiDocumentation {
  name: string;
  type: 'function' | 'class' | 'interface' | 'constant' | 'module';
  description: string;
  parameters?: Parameter[];
  returns?: ReturnType;
  examples: string[];
  seeAlso: string[];
  tags: string[];
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: any;
}

export interface ReturnType {
  type: string;
  description: string;
}

export interface InlineComment {
  line: number;
  type: 'explanation' | 'warning' | 'todo' | 'example';
  comment: string;
  complexity: 'low' | 'medium' | 'high';
}

export class DocumentationWriter {
  private defaultModel = 'gemini-2.5-flash';
  private defaultMaxTokens = 3000;
  private defaultStyle: DocumentationOptions['style'] = 'narrative';

  async generateDocs(code: string, options: DocumentationOptions = {}): Promise<DocumentationResult> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const style = options.style || this.defaultStyle;
    const includeExamples = options.includeExamples !== false; // default true
    const format = options.format || 'markdown';

    // Extract code structure
    const codeStructure = await this.analyzeCodeStructure(code);
    
    // Generate README
    const readme = await this.generateReadme(codeStructure, style || 'narrative', includeExamples);
    
    // Generate API documentation
    const apiDocs = await this.generateApiDocs(codeStructure, includeExamples);
    
    // Generate inline comments
    const inlineComments = await this.generateInlineComments(code, style || 'narrative');
    
    // Generate changelog
    const changelog = await this.generateChangelog(codeStructure);
    
    // Generate narrative documentation if requested
    let narrativeDoc: string | undefined;
    if (style === 'narrative') {
      narrativeDoc = await this.generateNarrativeDoc(codeStructure, code);
    }
    
    // Create synthesis
    const synthesis = this.synthesizeDocumentation(
      readme, apiDocs, inlineComments, changelog, narrativeDoc
    );

    return {
      readme,
      apiDocs,
      inlineComments,
      changelog,
      narrativeDoc,
      synthesis
    };
  }

  private async analyzeCodeStructure(code: string): Promise<any> {
    const structure = {
      functions: this.extractFunctions(code),
      classes: this.extractClasses(code),
      interfaces: this.extractInterfaces(code),
      constants: this.extractConstants(code),
      imports: this.extractImports(code),
      exports: this.extractExports(code),
      comments: this.extractExistingComments(code),
      complexity: this.assessCodeComplexity(code),
      purpose: this.inferPurpose(code)
    };

    return structure;
  }

  private extractFunctions(code: string): any[] {
    const functions: any[] = [];
    
    // Match function declarations and expressions
    const functionPatterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{/g,
      /(\w+)\s*:\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{/g
    ];

    functionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const [, name, params, returnType] = match;
        functions.push({
          name,
          parameters: this.parseParameters(params),
          returnType: returnType?.trim(),
          line: this.getLineNumber(code, match.index),
          isAsync: match[0].includes('async'),
          isExported: match[0].includes('export')
        });
      }
    });

    return functions;
  }

  private extractClasses(code: string): any[] {
    const classes: any[] = [];
    const classPattern = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    
    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const [, name, extends_] = match;
      classes.push({
        name,
        extends: extends_,
        line: this.getLineNumber(code, match.index),
        isExported: match[0].includes('export'),
        methods: this.extractClassMethods(code, name),
        properties: this.extractClassProperties(code, name)
      });
    }

    return classes;
  }

  private extractInterfaces(code: string): any[] {
    const interfaces: any[] = [];
    const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{([^}]+)\}/g;
    
    let match;
    while ((match = interfacePattern.exec(code)) !== null) {
      const [, name, extends_, body] = match;
      interfaces.push({
        name,
        extends: extends_?.trim(),
        properties: this.parseInterfaceProperties(body),
        line: this.getLineNumber(code, match.index),
        isExported: match[0].includes('export')
      });
    }

    return interfaces;
  }

  private extractConstants(code: string): any[] {
    const constants: any[] = [];
    const constPattern = /(?:export\s+)?const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=\s*([^;]+);?/g;
    
    let match;
    while ((match = constPattern.exec(code)) !== null) {
      const [, name, type, value] = match;
      constants.push({
        name,
        type: type?.trim(),
        value: value?.trim(),
        line: this.getLineNumber(code, match.index),
        isExported: match[0].includes('export')
      });
    }

    return constants;
  }

  private extractImports(code: string): string[] {
    const imports: string[] = [];
    const importPattern = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importPattern.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractExports(code: string): string[] {
    const exports: string[] = [];
    const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface)\s+(\w+)/g;
    
    let match;
    while ((match = exportPattern.exec(code)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private extractExistingComments(code: string): any[] {
    const comments: any[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
        comments.push({
          line: index + 1,
          comment: trimmed.replace(/^(\/\/|\*)\s*/, ''),
          type: 'existing'
        });
      }
    });

    return comments;
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) return [];
    
    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const [nameAndType, defaultValue] = trimmed.split('=');
      const [name, type] = nameAndType.includes(':') 
        ? nameAndType.split(':').map(s => s.trim())
        : [nameAndType.trim(), 'any'];
      
      return {
        name,
        type: type || 'any',
        required: !defaultValue,
        description: `Parameter ${name}`,
        defaultValue: defaultValue?.trim()
      };
    });
  }

  private extractClassMethods(code: string, className: string): any[] {
    // Simplified method extraction - in practice you'd need more robust parsing
    const methods: any[] = [];
    const methodPattern = new RegExp(`class\\s+${className}[^}]*?(\\w+)\\s*\\([^)]*\\)\\s*\\{`, 'g');
    
    let match;
    while ((match = methodPattern.exec(code)) !== null) {
      methods.push({
        name: match[1],
        line: this.getLineNumber(code, match.index)
      });
    }

    return methods;
  }

  private extractClassProperties(code: string, className: string): any[] {
    // Simplified property extraction
    return [];
  }

  private parseInterfaceProperties(body: string): any[] {
    const properties: any[] = [];
    const lines = body.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim().replace(/[;,]$/, '');
      if (trimmed && !trimmed.startsWith('//')) {
        const [name, type] = trimmed.split(':').map(s => s.trim());
        if (name && type) {
          properties.push({
            name,
            type,
            description: `Property ${name}`
          });
        }
      }
    });

    return properties;
  }

  private assessCodeComplexity(code: string): 'low' | 'medium' | 'high' {
    const lines = code.split('\n').length;
    const functions = (code.match(/function/g) || []).length;
    const classes = (code.match(/class/g) || []).length;
    const complexity = lines + functions * 5 + classes * 10;
    
    return complexity > 500 ? 'high' : complexity > 200 ? 'medium' : 'low';
  }

  private inferPurpose(code: string): string {
    // Simple heuristics to infer code purpose
    if (code.includes('express') || code.includes('app.get')) return 'Web Server/API';
    if (code.includes('React') || code.includes('useState')) return 'React Component';
    if (code.includes('test(') || code.includes('describe(')) return 'Test Suite';
    if (code.includes('class') && code.includes('extends')) return 'Object-Oriented Module';
    if (code.includes('export') && code.includes('function')) return 'Utility Library';
    return 'General Purpose Module';
  }

  private async generateReadme(structure: any, style: string, includeExamples: boolean): Promise<string> {
    let readme = '';

    // Title and description
    const title = structure.exports[0] || 'Code Module';
    readme += `# ${title}\n\n`;

    if (style === 'narrative') {
      readme += this.generateNarrativeIntro(structure);
    } else {
      readme += `## Overview\n\nThis ${structure.purpose.toLowerCase()} provides functionality for:\n\n`;
      structure.functions.slice(0, 3).forEach((func: any) => {
        readme += `- ${func.name}: Handles ${func.name.toLowerCase()} operations\n`;
      });
      readme += '\n';
    }

    // Installation (if it's a module)
    if (structure.exports.length > 0) {
      readme += `## Installation\n\n\`\`\`bash\nnpm install ${title.toLowerCase()}\n\`\`\`\n\n`;
    }

    // Usage section
    readme += `## Usage\n\n`;
    if (includeExamples && structure.functions.length > 0) {
      const mainFunction = structure.functions[0];
      readme += `\`\`\`typescript\nimport { ${mainFunction.name} } from './${title.toLowerCase()}';\n\n`;
      readme += `// ${this.generateUsageExample(mainFunction)}\n`;
      readme += `const result = ${mainFunction.name}(${this.generateExampleParams(mainFunction.parameters)});\n`;
      readme += `console.error(result);\n\`\`\`\n\n`;
    }

    // API Reference
    if (structure.functions.length > 0) {
      readme += `## API Reference\n\n`;
      structure.functions.slice(0, 5).forEach((func: any) => {
        readme += `### ${func.name}\n\n`;
        readme += `${this.generateFunctionDescription(func)}\n\n`;
        readme += `**Parameters:**\n`;
        func.parameters.forEach((param: Parameter) => {
          readme += `- \`${param.name}\` (${param.type}${param.required ? '' : '?'}): ${param.description}\n`;
        });
        readme += '\n';
      });
    }

    // Contributing
    readme += `## Contributing\n\nPull requests are welcome! Please read the contributing guidelines before submitting.\n\n`;
    
    // License
    readme += `## License\n\nMIT\n`;

    return readme;
  }

  private generateNarrativeIntro(structure: any): string {
    return `Welcome to the epic journey of the ${structure.purpose}! 🚀

This isn't just another piece of code - it's a carefully crafted solution that transforms complex problems into elegant solutions. 

**The Story Begins Here...**

Our code embarks on its mission with ${structure.functions.length} powerful functions, each playing a crucial role in the greater narrative. Like characters in an epic tale, each function has its own personality and purpose:

${structure.functions.slice(0, 3).map((func: any, index: number) => 
  `${index + 1}. **${func.name}**: The ${this.getFunctionPersonality(func.name)} that ${this.generateFunctionStory(func)}`
).join('\n')}

Ready to join this adventure? Let's dive in! ⚡

`;
  }

  private getFunctionPersonality(name: string): string {
    const personalities = [
      'wise guardian', 'swift messenger', 'powerful wizard', 'clever strategist',
      'reliable companion', 'mysterious oracle', 'brave warrior', 'skilled craftsman'
    ];
    return personalities[name.length % personalities.length];
  }

  private generateFunctionStory(func: any): string {
    const actions = ['transforms data into wisdom', 'guards against errors', 'unlocks hidden potential', 
                    'weaves magic through algorithms', 'builds bridges between components'];
    return actions[func.name.length % actions.length];
  }

  private generateUsageExample(func: any): string {
    return `Example: Using ${func.name} to ${func.name.toLowerCase().replace(/([A-Z])/g, ' $1').trim()}`;
  }

  private generateExampleParams(params: Parameter[]): string {
    return params.map(param => {
      if (param.type.includes('string')) return `"example"`;
      if (param.type.includes('number')) return `42`;
      if (param.type.includes('boolean')) return `true`;
      if (param.type.includes('array') || param.type.includes('[]')) return `[]`;
      if (param.type.includes('object') || param.type.includes('{')) return `{}`;
      return `null`;
    }).join(', ');
  }

  private generateFunctionDescription(func: any): string {
    const descriptions = {
      'create': 'Creates a new instance with the specified parameters',
      'get': 'Retrieves data based on the provided criteria',
      'set': 'Updates or sets values with validation',
      'delete': 'Safely removes items with proper cleanup',
      'update': 'Modifies existing data with merge capabilities',
      'parse': 'Transforms raw input into structured data',
      'validate': 'Ensures data integrity and format compliance',
      'calculate': 'Performs complex calculations and returns results',
      'process': 'Handles data transformation and processing workflows',
      'handle': 'Manages events and requests with error handling'
    };

    const funcName = func.name.toLowerCase();
    for (const [prefix, description] of Object.entries(descriptions)) {
      if (funcName.startsWith(prefix)) return description;
    }

    return `Performs ${funcName} operations with the provided parameters`;
  }

  private async generateApiDocs(structure: any, includeExamples: boolean): Promise<ApiDocumentation[]> {
    const apiDocs: ApiDocumentation[] = [];

    // Document functions
    structure.functions.forEach((func: any) => {
      apiDocs.push({
        name: func.name,
        type: 'function',
        description: this.generateFunctionDescription(func),
        parameters: func.parameters,
        returns: {
          type: func.returnType || 'any',
          description: `Result of ${func.name} operation`
        },
        examples: includeExamples ? [
          `${func.name}(${this.generateExampleParams(func.parameters)})`
        ] : [],
        seeAlso: this.generateSeeAlso(func, structure),
        tags: this.generateTags(func)
      });
    });

    // Document classes
    structure.classes.forEach((cls: any) => {
      apiDocs.push({
        name: cls.name,
        type: 'class',
        description: `Class representing ${cls.name.toLowerCase().replace(/([A-Z])/g, ' $1').trim()}`,
        examples: includeExamples ? [
          `const instance = new ${cls.name}();`
        ] : [],
        seeAlso: [],
        tags: ['class', 'object-oriented']
      });
    });

    return apiDocs;
  }

  private generateSeeAlso(func: any, structure: any): string[] {
    const related = structure.functions
      .filter((f: any) => f.name !== func.name && f.name.toLowerCase().includes(func.name.toLowerCase().substring(0, 3)))
      .map((f: any) => f.name)
      .slice(0, 3);
    
    return related;
  }

  private generateTags(func: any): string[] {
    const tags = ['function'];
    if (func.isAsync) tags.push('async');
    if (func.isExported) tags.push('exported');
    if (func.parameters.length === 0) tags.push('no-params');
    if (func.parameters.length > 3) tags.push('many-params');
    return tags;
  }

  private async generateInlineComments(code: string, style: string): Promise<InlineComment[]> {
    const comments: InlineComment[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Add comments for complex lines
      if (this.isComplexLine(trimmed)) {
        comments.push({
          line: index + 1,
          type: 'explanation',
          comment: this.generateLineComment(trimmed, style),
          complexity: 'high'
        });
      }
      
      // Add warnings for potentially problematic patterns
      if (this.isPotentiallyProblematic(trimmed)) {
        comments.push({
          line: index + 1,
          type: 'warning',
          comment: this.generateWarningComment(trimmed),
          complexity: 'medium'
        });
      }
      
      // Add TODOs for incomplete patterns
      if (this.needsImprovement(trimmed)) {
        comments.push({
          line: index + 1,
          type: 'todo',
          comment: this.generateTodoComment(trimmed),
          complexity: 'low'
        });
      }
    });

    return comments;
  }

  private isComplexLine(line: string): boolean {
    return line.length > 80 || 
           (line.match(/[{}()]/g) || []).length > 4 ||
           line.includes('?') && line.includes(':') ||
           line.includes('&&') || line.includes('||');
  }

  private isPotentiallyProblematic(line: string): boolean {
    return line.includes('eval(') ||
           line.includes('innerHTML') ||
           line.includes('document.write') ||
           line.includes('==') && !line.includes('===');
  }

  private needsImprovement(line: string): boolean {
    return line.includes('TODO') ||
           line.includes('FIXME') ||
           line.includes('HACK') ||
           line.trim().startsWith('//') && line.toLowerCase().includes('temp');
  }

  private generateLineComment(line: string, style: string): string {
    if (style === 'narrative') {
      return `// 📖 This line orchestrates ${this.describeLineAction(line)}`;
    }
    return `// ${this.describeLineAction(line)}`;
  }

  private describeLineAction(line: string): string {
    if (line.includes('return')) return 'the final result delivery';
    if (line.includes('if')) return 'conditional logic branching';
    if (line.includes('for') || line.includes('while')) return 'iterative processing';
    if (line.includes('try')) return 'error-safe operation';
    if (line.includes('await')) return 'asynchronous operation waiting';
    return 'a complex operation';
  }

  private generateWarningComment(line: string): string {
    return `// ⚠️ Security/Performance concern: Review this pattern`;
  }

  private generateTodoComment(line: string): string {
    return `// TODO: Consider refactoring or completing this implementation`;
  }

  private async generateChangelog(structure: any): Promise<string> {
    const changelog = `# Changelog

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
${structure.functions.map((func: any) => `- \`${func.name}\` function for enhanced functionality`).join('\n')}
${structure.classes.map((cls: any) => `- \`${cls.name}\` class for object-oriented operations`).join('\n')}

### Features
- Comprehensive API with ${structure.functions.length} functions
- ${structure.interfaces.length} well-defined interfaces
- Full TypeScript support
- Extensive documentation

### Technical Details
- Code complexity: ${structure.complexity}
- Total exports: ${structure.exports.length}
- Dependencies: ${structure.imports.length}

---

*This changelog follows [Semantic Versioning](https://semver.org/) guidelines.*
`;

    return changelog;
  }

  private async generateNarrativeDoc(structure: any, code: string): Promise<string> {
    return `# The Epic Tale of Our Code 📚

## Chapter 1: The Origin Story

Once upon a time, in the mystical realm of software development, there lived a ${structure.purpose}. This wasn't just any ordinary piece of code - it was destined for greatness!

Our story begins with ${structure.functions.length} mighty functions, each with their own unique powers and responsibilities...

## Chapter 2: The Heroes

${structure.functions.slice(0, 3).map((func: any, index: number) => `
### ${func.name} - The ${this.getFunctionPersonality(func.name)}

*"I shall ${this.generateFunctionStory(func)}!"*

With ${func.parameters.length} trusty parameters by their side, ${func.name} stands ready to face any challenge. Their journey began on line ${func.line}, where they first declared their noble purpose.
`).join('')}

## Chapter 3: The Architecture

The grand design of our system follows the sacred patterns:

- **Modularity**: Each piece serves a specific purpose
- **Maintainability**: Future heroes can easily understand and extend
- **Reliability**: Built with error handling and validation

## Chapter 4: The Quest Continues...

As our code evolves, new chapters will be written. Each commit tells a story, each function solves a problem, and each bug fix makes our code stronger.

*To be continued...*

---

**Moral of the Story**: Great code is like a great book - it tells a story, has memorable characters (functions), and leaves the reader (developer) satisfied and enlightened.
`;
  }

  private synthesizeDocumentation(
    readme: string,
    apiDocs: ApiDocumentation[],
    inlineComments: InlineComment[],
    changelog: string,
    narrativeDoc?: string
  ): string {
    let synthesis = `## Documentation Generation Summary\n\n`;

    synthesis += `**Generated Documentation:**\n`;
    synthesis += `- README.md: ${readme.split('\n').length} lines\n`;
    synthesis += `- API Documentation: ${apiDocs.length} items\n`;
    synthesis += `- Inline Comments: ${inlineComments.length} suggestions\n`;
    synthesis += `- Changelog: Generated with version history\n`;
    
    if (narrativeDoc) {
      synthesis += `- Narrative Documentation: Epic storytelling format\n`;
    }
    
    synthesis += `\n**Documentation Quality:**\n`;
    
    const hasExamples = apiDocs.some(doc => doc.examples.length > 0);
    const hasParameters = apiDocs.some(doc => doc.parameters && doc.parameters.length > 0);
    const hasWarnings = inlineComments.some(comment => comment.type === 'warning');
    
    synthesis += `- Examples included: ${hasExamples ? '✅' : '❌'}\n`;
    synthesis += `- Parameter documentation: ${hasParameters ? '✅' : '❌'}\n`;
    synthesis += `- Code warnings identified: ${hasWarnings ? '✅' : '❌'}\n`;
    
    const complexComments = inlineComments.filter(c => c.complexity === 'high').length;
    if (complexComments > 0) {
      synthesis += `- Complex code sections documented: ${complexComments}\n`;
    }

    synthesis += `\n**Next Steps:**\n`;
    synthesis += `1. Review generated README and customize as needed\n`;
    synthesis += `2. Add generated inline comments to source files\n`;
    synthesis += `3. Update changelog with actual version information\n`;
    synthesis += `4. Consider generating additional documentation for complex APIs\n`;

    return synthesis;
  }
}