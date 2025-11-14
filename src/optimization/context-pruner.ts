export interface PruningOptions {
  strategy: 'embedding-similarity' | 'keyword' | 'length' | 'hybrid';
  maxTokens: number;
  preserveRecent?: number;
  preserveImportant?: boolean;
}

export interface PrunedContext {
  original: string;
  pruned: string;
  tokensReduced: number;
  reductionRate: number;
  preservedSections: string[];
}

export class ContextPruner {
  private strategies: Map<string, (text: string, options: PruningOptions) => string>;

  constructor() {
    this.strategies = new Map([
      ['embedding-similarity', this.pruneByEmbedding.bind(this)],
      ['keyword', this.pruneByKeyword.bind(this)],
      ['length', this.pruneByLength.bind(this)],
      ['hybrid', this.pruneHybrid.bind(this)]
    ]);
  }

  prune(text: string, options: PruningOptions): PrunedContext {
    const strategy = this.strategies.get(options.strategy) || this.pruneByLength.bind(this);
    const pruned = strategy(text, options);
    
    const originalTokens = this.estimateTokens(text);
    const prunedTokens = this.estimateTokens(pruned);
    const tokensReduced = originalTokens - prunedTokens;
    const reductionRate = tokensReduced / originalTokens;

    return {
      original: text,
      pruned,
      tokensReduced,
      reductionRate,
      preservedSections: this.identifyPreservedSections(text, pruned)
    };
  }

  private pruneByEmbedding(text: string, options: PruningOptions): string {
    const sentences = this.splitIntoSentences(text);
    const scores = this.calculateSentenceImportance(sentences);
    
    const sortedSentences = sentences
      .map((sentence, index) => ({ sentence, score: scores[index], index }))
      .sort((a, b) => b.score - a.score);

    let result: string[] = [];
    let currentTokens = 0;
    
    for (const item of sortedSentences) {
      const sentenceTokens = this.estimateTokens(item.sentence);
      if (currentTokens + sentenceTokens <= options.maxTokens) {
        result.push(item.sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Preserve order
    result = result.sort((a, b) => {
      const indexA = sentences.indexOf(a);
      const indexB = sentences.indexOf(b);
      return indexA - indexB;
    });

    return result.join(' ');
  }

  private pruneByKeyword(text: string, options: PruningOptions): string {
    const keywords = this.extractKeywords(text);
    const sentences = this.splitIntoSentences(text);
    
    const scoredSentences = sentences.map(sentence => {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (sentence.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
      return { sentence, score };
    });

    scoredSentences.sort((a, b) => b.score - a.score);

    let result: string[] = [];
    let currentTokens = 0;
    
    for (const item of scoredSentences) {
      const sentenceTokens = this.estimateTokens(item.sentence);
      if (currentTokens + sentenceTokens <= options.maxTokens) {
        result.push(item.sentence);
        currentTokens += sentenceTokens;
      }
    }

    return result.join(' ');
  }

  private pruneByLength(text: string, options: PruningOptions): string {
    const targetLength = options.maxTokens * 4; // Rough character estimate
    
    if (text.length <= targetLength) {
      return text;
    }

    const sections = this.splitIntoSections(text);
    let result = '';
    
    for (const section of sections) {
      if (result.length + section.length <= targetLength) {
        result += section + '\n\n';
      } else {
        const remaining = targetLength - result.length;
        result += section.substring(0, remaining);
        break;
      }
    }

    return result.trim();
  }

  private pruneHybrid(text: string, options: PruningOptions): string {
    // Combine multiple strategies
    const embeddingWeight = 0.4;
    const keywordWeight = 0.3;
    const recencyWeight = 0.3;

    const sentences = this.splitIntoSentences(text);
    const embeddingScores = this.calculateSentenceImportance(sentences);
    const keywords = this.extractKeywords(text);
    
    const finalScores = sentences.map((sentence, index) => {
      const embeddingScore = embeddingScores[index] * embeddingWeight;
      
      const keywordScore = keywords.reduce((sum, keyword) => {
        return sum + (sentence.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0) * keywordWeight;
      
      const recencyScore = (index / sentences.length) * recencyWeight;
      
      return {
        sentence,
        score: embeddingScore + keywordScore + recencyScore,
        index
      };
    });

    finalScores.sort((a, b) => b.score - a.score);

    let result: { sentence: string; index: number }[] = [];
    let currentTokens = 0;
    
    for (const item of finalScores) {
      const sentenceTokens = this.estimateTokens(item.sentence);
      if (currentTokens + sentenceTokens <= options.maxTokens) {
        result.push(item);
        currentTokens += sentenceTokens;
      }
    }

    // Preserve original order
    result.sort((a, b) => a.index - b.index);
    
    return result.map(item => item.sentence).join(' ');
  }

  private splitIntoSentences(text: string): string[] {
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  private splitIntoSections(text: string): string[] {
    return text.split(/\n\n+/).filter(s => s.trim());
  }

  private calculateSentenceImportance(sentences: string[]): number[] {
    // Simplified importance calculation
    return sentences.map(sentence => {
      let score = 0;
      
      // Length factor
      if (sentence.length > 50 && sentence.length < 200) score += 0.3;
      
      // Contains numbers or data
      if (/\d+/.test(sentence)) score += 0.2;
      
      // Contains technical terms (simplified)
      const technicalTerms = ['function', 'class', 'method', 'api', 'error', 'bug', 'feature'];
      technicalTerms.forEach(term => {
        if (sentence.toLowerCase().includes(term)) score += 0.1;
      });
      
      // Question or conclusion indicators
      if (sentence.includes('?') || sentence.includes('therefore') || sentence.includes('conclusion')) {
        score += 0.3;
      }
      
      return Math.min(score, 1);
    });
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'but', 'for', 'with', 'about', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'of', 'in'
    ]);
    
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private identifyPreservedSections(original: string, pruned: string): string[] {
    const prunedSentences = this.splitIntoSentences(pruned);
    return prunedSentences.slice(0, 3).map(s => s.substring(0, 50) + '...');
  }

  getRecommendedStrategy(text: string, requirements: any): string {
    const length = text.length;
    const hasCode = /```[\s\S]*?```/.test(text);
    const hasNumbers = /\d+/.test(text);
    
    if (hasCode) {
      return 'keyword'; // Preserve code blocks
    }
    
    if (length > 10000) {
      return 'hybrid'; // Use multiple strategies for long text
    }
    
    if (hasNumbers || requirements.preserveData) {
      return 'embedding-similarity'; // Better at preserving important data
    }
    
    return 'length'; // Simple and fast for short text
  }
}