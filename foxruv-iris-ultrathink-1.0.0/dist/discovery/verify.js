#!/usr/bin/env node
/**
 * Verification script for discovery system
 *
 * Tests the discovery system with sample code to ensure it's working correctly
 *
 * @module discovery/verify
 */
import { PatternMatcher, ExpertExtractor } from './index.js';
const sampleTypeScriptCode = `
// Sample DSPy-style signature
class QuestionAnswerSignature {
  question: InputField = Field({ description: "User question" })
  answer: OutputField = Field({ description: "Generated answer" })
}

// Sample AI function
async function predictOutcome(data: InputData): Promise<Prediction> {
  const model = await loadModel()
  const result = await model.predict(data)
  return result
}

// Sample arrow function
const generateText = async (prompt: string) => {
  const completion = await llm.complete(prompt)
  return completion.text
}

// Sample data pipeline
class DataPipeline {
  async process(raw: RawData): Promise<ProcessedData> {
    return this.transform(raw)
  }
}

// Sample optimizer
class PerformanceOptimizer {
  optimize(params: Parameters): OptimizedParameters {
    return this.findOptimal(params)
  }
}
`;
const samplePythonCode = `
# Sample DSPy signature
class QuestionAnswerSignature(dspy.Signature):
    """QA signature"""
    question = dspy.InputField()
    answer = dspy.OutputField()

# Sample AI function
def predict_outcome(data):
    model = load_model()
    result = model.predict(data)
    return result

# Another AI function
async def generate_text(prompt):
    completion = await llm.complete(prompt)
    return completion.text

# Data pipeline
class DataPipeline:
    def process(self, raw):
        return self.transform(raw)
`;
async function verifyPatternMatcher() {
    console.log('🔍 Testing Pattern Matcher...');
    const matcher = new PatternMatcher();
    // Test TypeScript patterns
    const tsMatches = matcher.matchPatterns(sampleTypeScriptCode, 'sample.ts', 'typescript');
    console.log(`  ✓ TypeScript: Found ${tsMatches.length} matches`);
    for (const match of tsMatches) {
        console.log(`    - ${match.name} (${match.rule.expertType}) - ${(match.confidence * 100).toFixed(0)}%`);
    }
    // Test Python patterns
    const pyMatches = matcher.matchPatterns(samplePythonCode, 'sample.py', 'python');
    console.log(`  ✓ Python: Found ${pyMatches.length} matches`);
    for (const match of pyMatches) {
        console.log(`    - ${match.name} (${match.rule.expertType}) - ${(match.confidence * 100).toFixed(0)}%`);
    }
    return tsMatches.length > 0 && pyMatches.length > 0;
}
async function verifyExpertExtractor() {
    console.log('\n🔬 Testing Expert Extractor...');
    const extractor = new ExpertExtractor({
        minConfidence: 0.5
    });
    // Test TypeScript extraction
    const tsExperts = extractor.extractExperts(sampleTypeScriptCode, '/test/sample.ts', 'typescript', '/test');
    console.log(`  ✓ TypeScript: Extracted ${tsExperts.length} experts`);
    for (const expert of tsExperts) {
        console.log(`    - ${expert.name}`);
        console.log(`      Type: ${expert.expertType}`);
        console.log(`      Confidence: ${(expert.confidence * 100).toFixed(0)}%`);
        console.log(`      Description: ${expert.description}`);
    }
    // Test Python extraction
    const pyExperts = extractor.extractExperts(samplePythonCode, '/test/sample.py', 'python', '/test');
    console.log(`  ✓ Python: Extracted ${pyExperts.length} experts`);
    for (const expert of pyExperts) {
        console.log(`    - ${expert.name}`);
        console.log(`      Type: ${expert.expertType}`);
        console.log(`      Confidence: ${(expert.confidence * 100).toFixed(0)}%`);
    }
    return tsExperts.length > 0 && pyExperts.length > 0;
}
async function verifyCustomPatterns() {
    console.log('\n🎨 Testing Custom Patterns...');
    const matcher = new PatternMatcher();
    // Add custom pattern
    matcher.addRule({
        id: 'test-custom',
        name: 'Test Custom Pattern',
        languages: ['typescript'],
        expertType: 'ai_function',
        pattern: /function\s+(test\w+)\(/g,
        confidence: 0.95
    });
    const testCode = `
function testCustomPattern() {
  return "custom"
}
  `;
    const matches = matcher.matchPatterns(testCode, 'test.ts', 'typescript');
    console.log(`  ✓ Custom pattern: Found ${matches.length} match(es)`);
    for (const match of matches) {
        console.log(`    - ${match.name} (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
    }
    return matches.length > 0;
}
async function verifyLanguageParsers() {
    console.log('\n📝 Testing Language Parsers...');
    const { getParser } = await import('./language-parsers.js');
    // Test TypeScript parser
    const tsParser = getParser('typescript');
    const tsBlocks = tsParser.parseBlocks(sampleTypeScriptCode, sampleTypeScriptCode.split('\n'));
    console.log(`  ✓ TypeScript parser: Found ${tsBlocks.length} blocks`);
    for (const block of tsBlocks.slice(0, 3)) {
        console.log(`    - ${block.type}: ${block.name} (lines ${block.lineStart}-${block.lineEnd})`);
    }
    // Test Python parser
    const pyParser = getParser('python');
    const pyBlocks = pyParser.parseBlocks(samplePythonCode, samplePythonCode.split('\n'));
    console.log(`  ✓ Python parser: Found ${pyBlocks.length} blocks`);
    for (const block of pyBlocks.slice(0, 3)) {
        console.log(`    - ${block.type}: ${block.name} (lines ${block.lineStart}-${block.lineEnd})`);
    }
    return tsBlocks.length > 0 && pyBlocks.length > 0;
}
async function main() {
    console.log('🚀 Verifying Expert Discovery System\n');
    console.log('='.repeat(80));
    try {
        const results = await Promise.all([
            verifyPatternMatcher(),
            verifyExpertExtractor(),
            verifyCustomPatterns(),
            verifyLanguageParsers()
        ]);
        console.log('\n' + '='.repeat(80));
        if (results.every(r => r)) {
            console.log('\n✅ All verification tests passed!');
            console.log('\n📊 Summary:');
            console.log('  ✓ Pattern matching works correctly');
            console.log('  ✓ Expert extraction works correctly');
            console.log('  ✓ Custom patterns work correctly');
            console.log('  ✓ Language parsers work correctly');
            console.log('\n🎉 Discovery system is ready to use!');
            process.exit(0);
        }
        else {
            console.log('\n❌ Some verification tests failed!');
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    }
}
// Run if executed directly
const isMainModule = process.argv[1]?.endsWith('verify.ts') || process.argv[1]?.endsWith('verify.js');
if (isMainModule) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
export { main as verify };
//# sourceMappingURL=verify.js.map