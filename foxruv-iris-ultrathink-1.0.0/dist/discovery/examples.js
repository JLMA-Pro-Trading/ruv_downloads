/**
 * Usage examples for the expert discovery system
 *
 * @module discovery/examples
 */
import { CodeScanner, PatternMatcher, ExpertExtractor } from './index.js';
/**
 * Example 1: Basic project scanning
 */
export async function example1_BasicScanning() {
    console.log('Example 1: Basic Project Scanning\n');
    const scanner = new CodeScanner({
        verbose: true,
        languages: ['typescript', 'python']
    });
    const result = await scanner.scanProject('./my-project');
    console.log(`\n📊 Scan Results:`);
    console.log(`  Total Files: ${result.summary.totalFiles}`);
    console.log(`  Total Experts: ${result.summary.totalExperts}`);
    console.log(`\n  By Language:`);
    for (const [lang, count] of Object.entries(result.summary.byLanguage)) {
        console.log(`    ${lang}: ${count}`);
    }
    console.log(`\n  By Type:`);
    for (const [type, count] of Object.entries(result.summary.byType)) {
        console.log(`    ${type}: ${count}`);
    }
    console.log(`\n📋 Discovered Experts:`);
    for (const expert of result.experts.slice(0, 5)) {
        console.log(`  - ${expert.name} (${expert.expertType})`);
        console.log(`    File: ${expert.filePath}:${expert.lineStart}`);
        console.log(`    Confidence: ${(expert.confidence * 100).toFixed(0)}%`);
    }
}
/**
 * Example 2: Custom pattern detection
 */
export async function example2_CustomPatterns() {
    console.log('Example 2: Custom Pattern Detection\n');
    const matcher = new PatternMatcher();
    // Add custom pattern for detecting transformers
    matcher.addRule({
        id: 'custom-transformer',
        name: 'Custom Transformer',
        languages: ['typescript'],
        expertType: 'ai_function',
        pattern: /class\s+(\w+Transformer)\s*{/g,
        confidence: 0.9,
        validate: (match, context) => {
            // Ensure it has a transform method
            return context.content.includes('transform');
        },
        boostConfidence: (match, context) => {
            // Boost confidence if it mentions AI
            return context.content.includes('AI') ? 0.05 : 0;
        }
    });
    const sampleCode = `
class DataTransformer {
  async transform(data: any) {
    // AI-powered transformation
    return transformedData
  }
}
  `;
    const matches = matcher.matchPatterns(sampleCode, 'example.ts', 'typescript');
    console.log(`Found ${matches.length} matches:`);
    for (const match of matches) {
        console.log(`  - ${match.name}`);
        console.log(`    Confidence: ${(match.confidence * 100).toFixed(0)}%`);
        console.log(`    Pattern: ${match.rule.name}`);
    }
}
/**
 * Example 3: Expert extraction with custom config
 */
export async function example3_CustomExtraction() {
    console.log('Example 3: Custom Expert Extraction\n');
    const extractor = new ExpertExtractor({
        detectAIFunctions: true,
        detectDSPySignatures: true,
        minConfidence: 0.7,
        aiFunctionKeywords: [
            'predict',
            'generate',
            'optimize',
            'myCustomAI',
            'smartPredict'
        ]
    });
    const sampleCode = `
async function myCustomAI(input: string): Promise<Result> {
  // AI processing
  return result
}

function smartPredictOutcome(data: Data): Prediction {
  // Prediction logic
  return prediction
}
  `;
    const experts = extractor.extractExperts(sampleCode, 'example.ts', 'typescript', '.');
    console.log(`Extracted ${experts.length} experts:`);
    for (const expert of experts) {
        console.log(`  - ${expert.name}`);
        console.log(`    Type: ${expert.expertType}`);
        console.log(`    Description: ${expert.description}`);
        console.log(`    Confidence: ${(expert.confidence * 100).toFixed(0)}%`);
        console.log(`    Lines: ${expert.lineStart}-${expert.lineEnd}`);
    }
}
/**
 * Example 4: Language-specific parsing
 */
export async function example4_LanguageParsing() {
    console.log('Example 4: Language-Specific Parsing\n');
    const { getParser } = await import('./language-parsers.js');
    const pythonCode = `
class MySignature(dspy.Signature):
    """My signature"""
    input = dspy.InputField()
    output = dspy.OutputField()

def predict_outcome(data):
    # AI prediction
    log_telemetry({"event": "predict"})
    return result
  `;
    const parser = getParser('python');
    const blocks = parser.parseBlocks(pythonCode, pythonCode.split('\n'));
    console.log(`Parsed ${blocks.length} code blocks:`);
    for (const block of blocks) {
        console.log(`  - ${block.type}: ${block.name}`);
        console.log(`    Lines: ${block.lineStart}-${block.lineEnd}`);
        console.log(`    Has telemetry: ${parser.hasTelemetry(block.content) ? '✓' : '✗'}`);
    }
}
/**
 * Example 5: Statistics and export
 */
export async function example5_StatisticsAndExport() {
    console.log('Example 5: Statistics and Export\n');
    const scanner = new CodeScanner({
        verbose: false,
        languages: ['typescript']
    });
    const result = await scanner.scanProject('./src');
    // Get statistics
    const stats = scanner.getStatistics(result);
    console.log('📈 Statistics:');
    console.log(`  Experts per file: ${stats.expertsPerFile.toFixed(2)}`);
    console.log(`  Average confidence: ${(stats.avgConfidence * 100).toFixed(0)}%`);
    console.log(`\n  Files per language:`);
    for (const [lang, count] of Object.entries(stats.filesPerLanguage)) {
        console.log(`    ${lang}: ${count}`);
    }
    console.log(`\n🏆 Top Experts (by confidence):`);
    for (const expert of stats.topExperts.slice(0, 5)) {
        console.log(`  ${(expert.confidence * 100).toFixed(0)}% - ${expert.name} (${expert.expertType})`);
    }
    // Export to JSON
    scanner.exportToJson(result, './discoveries.json');
    console.log('\n💾 Results exported to discoveries.json');
}
/**
 * Example 6: Filtering by type
 */
export async function example6_FilterByType() {
    console.log('Example 6: Filter by Expert Type\n');
    const scanner = new CodeScanner({
        verbose: false,
        expertTypes: ['dspy_signature', 'ai_function'] // Only these types
    });
    const result = await scanner.scanProject('./src');
    console.log(`Found ${result.summary.totalExperts} experts (filtered)`);
    console.log('\nBreakdown:');
    for (const [type, count] of Object.entries(result.summary.byType)) {
        console.log(`  ${type}: ${count}`);
    }
}
/**
 * Example 7: Multi-language scanning
 */
export async function example7_MultiLanguage() {
    console.log('Example 7: Multi-Language Scanning\n');
    const scanner = new CodeScanner({
        verbose: true,
        languages: ['typescript', 'javascript', 'python']
    });
    const result = await scanner.scanProject('./src');
    console.log('\n📊 Language Distribution:');
    for (const [lang, count] of Object.entries(result.summary.byLanguage)) {
        const percentage = ((count / result.summary.totalExperts) * 100).toFixed(1);
        console.log(`  ${lang}: ${count} (${percentage}%)`);
    }
}
/**
 * Example 8: Error handling
 */
export async function example8_ErrorHandling() {
    console.log('Example 8: Error Handling\n');
    const scanner = new CodeScanner({
        verbose: false,
        maxFileSize: 1024 // Very small to trigger errors
    });
    const result = await scanner.scanProject('./src');
    if (result.errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        for (const error of result.errors) {
            console.log(`  - ${error}`);
        }
    }
    console.log(`\n✓ Successfully processed ${result.summary.totalExperts} experts`);
}
/**
 * Run all examples
 */
export async function runAllExamples() {
    const examples = [
        example1_BasicScanning,
        example2_CustomPatterns,
        example3_CustomExtraction,
        example4_LanguageParsing,
        example5_StatisticsAndExport,
        example6_FilterByType,
        example7_MultiLanguage,
        example8_ErrorHandling
    ];
    for (const example of examples) {
        try {
            await example();
            console.log('\n' + '='.repeat(80) + '\n');
        }
        catch (error) {
            console.error(`Error in ${example.name}:`, error);
        }
    }
}
//# sourceMappingURL=examples.js.map