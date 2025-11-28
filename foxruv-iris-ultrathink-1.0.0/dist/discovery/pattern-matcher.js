/**
 * Pattern matching engine for AI/ML expert detection
 *
 * This module provides pattern-based detection of various expert types
 * including DSPy signatures, AI functions, data pipelines, and optimization functions.
 *
 * @module discovery/pattern-matcher
 * @version 1.0.0
 */
/**
 * Default AI/ML function keywords
 */
export const DEFAULT_AI_KEYWORDS = [
    'predict',
    'generate',
    'optimize',
    'train',
    'infer',
    'classify',
    'embed',
    'transform',
    'encode',
    'decode'
];
/**
 * Built-in pattern rules for expert detection
 */
export const BUILTIN_PATTERNS = [
    // TypeScript/JavaScript DSPy-style signatures
    {
        id: 'ts-dspy-signature',
        name: 'TypeScript DSPy Signature',
        languages: ['typescript', 'javascript'],
        expertType: 'dspy_signature',
        pattern: /class\s+(\w+)\s+(?:extends\s+\w+)?\s*{/g,
        confidence: 0.9,
        validate: (match, context) => {
            // Check if class body contains field definitions
            const startPos = match.index || 0;
            const endPos = findClosingBrace(context.content, startPos);
            const classBody = context.content.substring(startPos, endPos);
            return classBody.includes('field:') || classBody.includes('Field(');
        }
    },
    // Python DSPy signatures
    {
        id: 'py-dspy-signature',
        name: 'Python DSPy Signature',
        languages: ['python'],
        expertType: 'dspy_signature',
        pattern: /class\s+(\w+)\(dspy\.Signature\):/g,
        confidence: 0.95
    },
    // TypeScript/JavaScript AI functions
    {
        id: 'ts-ai-function',
        name: 'TypeScript AI Function',
        languages: ['typescript', 'javascript'],
        expertType: 'ai_function',
        pattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
        confidence: 0.8,
        validate: (match, context) => {
            const funcName = match[1];
            return DEFAULT_AI_KEYWORDS.some(keyword => funcName.toLowerCase().includes(keyword.toLowerCase()));
        },
        boostConfidence: (match, context) => {
            const startPos = match.index || 0;
            const funcBody = context.content.substring(startPos, startPos + 500);
            let boost = 0;
            if (funcBody.includes('await') || funcBody.includes('async'))
                boost += 0.05;
            if (funcBody.includes('model') || funcBody.includes('llm'))
                boost += 0.05;
            if (funcBody.includes('prompt') || funcBody.includes('completion'))
                boost += 0.05;
            return boost;
        }
    },
    // TypeScript/JavaScript arrow AI functions
    {
        id: 'ts-ai-arrow',
        name: 'TypeScript AI Arrow Function',
        languages: ['typescript', 'javascript'],
        expertType: 'ai_function',
        pattern: /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        confidence: 0.75,
        validate: (match, context) => {
            const funcName = match[1];
            return DEFAULT_AI_KEYWORDS.some(keyword => funcName.toLowerCase().includes(keyword.toLowerCase()));
        }
    },
    // Python AI functions
    {
        id: 'py-ai-function',
        name: 'Python AI Function',
        languages: ['python'],
        expertType: 'ai_function',
        pattern: /def\s+(\w+)\s*\([^)]*\):/g,
        confidence: 0.8,
        validate: (match, context) => {
            const funcName = match[1];
            return DEFAULT_AI_KEYWORDS.some(keyword => funcName.toLowerCase().includes(keyword.toLowerCase()));
        }
    },
    // Data pipeline patterns
    {
        id: 'ts-pipeline',
        name: 'TypeScript Data Pipeline',
        languages: ['typescript', 'javascript'],
        expertType: 'data_pipeline',
        pattern: /class\s+(\w+Pipeline)\s+(?:extends\s+\w+)?\s*{/g,
        confidence: 0.85
    },
    // Optimization functions
    {
        id: 'ts-optimizer',
        name: 'TypeScript Optimizer',
        languages: ['typescript', 'javascript'],
        expertType: 'optimization',
        pattern: /class\s+(\w+(?:Optimizer|Optimiser))\s+(?:extends\s+\w+)?\s*{/g,
        confidence: 0.85
    }
];
/**
 * Helper function to find closing brace
 */
function findClosingBrace(content, startPos) {
    const openBrace = content.indexOf('{', startPos);
    if (openBrace === -1)
        return startPos + 500;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    for (let i = openBrace; i < content.length; i++) {
        const char = content[i];
        const prevChar = i > 0 ? content[i - 1] : '';
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            if (inString && char === stringChar) {
                inString = false;
                stringChar = '';
            }
            else if (!inString) {
                inString = true;
                stringChar = char;
            }
        }
        if (!inString) {
            if (char === '{')
                depth++;
            if (char === '}') {
                depth--;
                if (depth === 0)
                    return i + 1;
            }
        }
    }
    return content.length;
}
/**
 * Pattern matcher class for expert detection
 */
export class PatternMatcher {
    rules;
    constructor(customRules = []) {
        this.rules = [...BUILTIN_PATTERNS, ...customRules];
    }
    /**
     * Match patterns in file content
     */
    matchPatterns(content, filePath, language) {
        const matches = [];
        const lines = content.split('\n');
        const context = {
            content,
            filePath,
            language,
            lines,
            position: 0
        };
        // Filter rules by language
        const applicableRules = this.rules.filter(rule => rule.languages.includes(language));
        for (const rule of applicableRules) {
            // Reset regex lastIndex
            rule.pattern.lastIndex = 0;
            let match;
            while ((match = rule.pattern.exec(content)) !== null) {
                context.position = match.index || 0;
                // Validate match if validation function provided
                if (rule.validate && !rule.validate(match, context)) {
                    continue;
                }
                // Calculate confidence
                let confidence = rule.confidence;
                if (rule.boostConfidence) {
                    confidence = Math.min(1, confidence + rule.boostConfidence(match, context));
                }
                // Extract match details
                const name = match[1] || 'unknown';
                const startPos = match.index || 0;
                const lineStart = content.substring(0, startPos).split('\n').length;
                // Find block end
                const endPos = this.findBlockEnd(content, startPos, language);
                const lineEnd = content.substring(0, endPos).split('\n').length;
                // Extract signature
                const signature = this.extractSignature(content, startPos, language);
                matches.push({
                    rule,
                    match,
                    confidence,
                    lineStart,
                    lineEnd,
                    name,
                    signature,
                    metadata: {
                        blockContent: content.substring(startPos, Math.min(endPos, startPos + 200))
                    }
                });
            }
        }
        return matches;
    }
    /**
     * Find the end of a code block
     */
    findBlockEnd(content, startPos, language) {
        if (language === 'python') {
            return this.findPythonBlockEnd(content, startPos);
        }
        else {
            // TypeScript/JavaScript
            const openBrace = content.indexOf('{', startPos);
            if (openBrace === -1)
                return startPos + 100;
            return findClosingBrace(content, openBrace);
        }
    }
    /**
     * Find Python block end based on indentation
     */
    findPythonBlockEnd(content, startPos) {
        const lines = content.substring(startPos).split('\n');
        const firstLine = lines[0];
        const baseIndent = firstLine.search(/\S/);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '')
                continue;
            const indent = line.search(/\S/);
            if (indent !== -1 && indent <= baseIndent) {
                return startPos + lines.slice(0, i).join('\n').length;
            }
        }
        return startPos + lines.join('\n').length;
    }
    /**
     * Extract signature from code
     */
    extractSignature(content, startPos, language) {
        if (language === 'python') {
            const colonPos = content.indexOf(':', startPos);
            if (colonPos === -1)
                return content.substring(startPos, startPos + 100);
            return content.substring(startPos, colonPos).trim();
        }
        else {
            // TypeScript/JavaScript
            const bracePos = content.indexOf('{', startPos);
            if (bracePos === -1)
                return content.substring(startPos, startPos + 100);
            return content.substring(startPos, bracePos).trim();
        }
    }
    /**
     * Add custom pattern rule
     */
    addRule(rule) {
        this.rules.push(rule);
    }
    /**
     * Get all rules for a specific language
     */
    getRulesForLanguage(language) {
        return this.rules.filter(rule => rule.languages.includes(language));
    }
    /**
     * Get all rules for a specific expert type
     */
    getRulesForType(expertType) {
        return this.rules.filter(rule => rule.expertType === expertType);
    }
}
//# sourceMappingURL=pattern-matcher.js.map