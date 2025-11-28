/**
 * Language-specific parsers for TypeScript/JavaScript and Python
 *
 * This module provides parsing capabilities for extracting code blocks,
 * signatures, and metadata from different programming languages.
 *
 * @module discovery/language-parsers
 * @version 1.0.0
 */
/**
 * TypeScript/JavaScript parser implementation
 */
export class TypeScriptParser {
    language = 'typescript';
    /**
     * Parse TypeScript/JavaScript content into code blocks
     */
    parseBlocks(content, lines) {
        const blocks = [];
        // Pattern for classes
        const classPattern = /class\s+(\w+)\s*(?:extends\s+\w+)?\s*{/g;
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            const name = match[1];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            const endPos = this.findBlockEnd(content, startPos);
            const lineEnd = content.substring(0, endPos).split('\n').length;
            blocks.push({
                content: content.substring(startPos, endPos),
                lineStart,
                lineEnd,
                type: 'class',
                name
            });
        }
        // Pattern for functions
        const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g;
        while ((match = funcPattern.exec(content)) !== null) {
            const name = match[1];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            const endPos = this.findBlockEnd(content, startPos);
            const lineEnd = content.substring(0, endPos).split('\n').length;
            blocks.push({
                content: content.substring(startPos, endPos),
                lineStart,
                lineEnd,
                type: 'function',
                name
            });
        }
        // Pattern for arrow functions assigned to const/let
        const arrowPattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
        while ((match = arrowPattern.exec(content)) !== null) {
            const name = match[1];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            const endPos = this.findArrowFunctionEnd(content, startPos);
            const lineEnd = content.substring(0, endPos).split('\n').length;
            blocks.push({
                content: content.substring(startPos, endPos),
                lineStart,
                lineEnd,
                type: 'function',
                name
            });
        }
        return blocks;
    }
    /**
     * Find the end of a code block by matching braces
     */
    findBlockEnd(content, startPos) {
        const openBrace = content.indexOf('{', startPos);
        if (openBrace === -1)
            return startPos + 100;
        return this.findClosingBrace(content, openBrace);
    }
    /**
     * Find matching closing brace
     */
    findClosingBrace(content, startPos) {
        let depth = 0;
        let inString = false;
        let stringChar = '';
        for (let i = startPos; i < content.length; i++) {
            const char = content[i];
            const prevChar = i > 0 ? content[i - 1] : '';
            // Handle strings
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
     * Find the end of an arrow function
     */
    findArrowFunctionEnd(content, startPos) {
        const arrowPos = content.indexOf('=>', startPos);
        if (arrowPos === -1)
            return startPos + 100;
        // Check if it's a block arrow function
        const nextChar = content.substring(arrowPos + 2).trim()[0];
        if (nextChar === '{') {
            return this.findClosingBrace(content, content.indexOf('{', arrowPos));
        }
        // Single expression arrow function - find end of expression
        let pos = arrowPos + 2;
        let depth = 0;
        let inString = false;
        let stringChar = '';
        while (pos < content.length) {
            const char = content[pos];
            const prevChar = pos > 0 ? content[pos - 1] : '';
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (inString && char === stringChar) {
                    inString = false;
                }
                else if (!inString) {
                    inString = true;
                    stringChar = char;
                }
            }
            if (!inString) {
                if (char === '(' || char === '[' || char === '{')
                    depth++;
                if (char === ')' || char === ']' || char === '}')
                    depth--;
                if (depth === 0 && (char === '\n' || char === ';')) {
                    return pos + 1;
                }
            }
            pos++;
        }
        return pos;
    }
    /**
     * Extract function/class signature
     */
    extractSignature(content, startPos) {
        const lineEnd = content.indexOf('\n', startPos);
        if (lineEnd === -1)
            return content.substring(startPos, startPos + 100);
        const bracePos = content.indexOf('{', startPos);
        if (bracePos === -1 || bracePos > lineEnd) {
            return content.substring(startPos, lineEnd).trim();
        }
        return content.substring(startPos, bracePos).trim();
    }
    /**
     * Check if code contains telemetry calls
     */
    hasTelemetry(code) {
        const patterns = [
            'logTelemetry',
            'recordExecution',
            'trackPerformance',
            'saveReflexion',
            'storeExecution'
        ];
        return patterns.some(pattern => code.includes(pattern));
    }
}
/**
 * Python parser implementation
 */
export class PythonParser {
    language = 'python';
    /**
     * Parse Python content into code blocks
     */
    parseBlocks(content, lines) {
        const blocks = [];
        // Pattern for classes
        const classPattern = /^(\s*)class\s+(\w+)(?:\([^)]*\))?:/gm;
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            const indent = match[1].length;
            const name = match[2];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            const endPos = this.findBlockEnd(content, startPos);
            const lineEnd = content.substring(0, endPos).split('\n').length;
            blocks.push({
                content: content.substring(startPos, endPos),
                lineStart,
                lineEnd,
                type: 'class',
                name,
                indent
            });
        }
        // Pattern for functions
        const funcPattern = /^(\s*)def\s+(\w+)\s*\([^)]*\):/gm;
        while ((match = funcPattern.exec(content)) !== null) {
            const indent = match[1].length;
            const name = match[2];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            const endPos = this.findBlockEnd(content, startPos);
            const lineEnd = content.substring(0, endPos).split('\n').length;
            blocks.push({
                content: content.substring(startPos, endPos),
                lineStart,
                lineEnd,
                type: 'function',
                name,
                indent
            });
        }
        return blocks;
    }
    /**
     * Find the end of a Python block based on indentation
     */
    findBlockEnd(content, startPos) {
        const lines = content.substring(startPos).split('\n');
        const firstLine = lines[0];
        const baseIndent = firstLine.search(/\S/);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // Skip empty lines
            if (line.trim() === '')
                continue;
            // Check indentation
            const indent = line.search(/\S/);
            if (indent !== -1 && indent <= baseIndent) {
                // Found line with same or less indentation
                return startPos + lines.slice(0, i).join('\n').length;
            }
        }
        return startPos + lines.join('\n').length;
    }
    /**
     * Extract function/class signature
     */
    extractSignature(content, startPos) {
        const colonPos = content.indexOf(':', startPos);
        if (colonPos === -1)
            return content.substring(startPos, startPos + 100);
        return content.substring(startPos, colonPos).trim();
    }
    /**
     * Check if code contains telemetry calls
     */
    hasTelemetry(code) {
        const patterns = [
            'log_telemetry',
            'record_execution',
            'track_performance',
            'save_reflexion',
            'store_execution'
        ];
        return patterns.some(pattern => code.includes(pattern));
    }
}
/**
 * JavaScript parser (extends TypeScript parser)
 */
export class JavaScriptParser extends TypeScriptParser {
    language = 'javascript';
}
/**
 * Get appropriate parser for a language
 */
export function getParser(language) {
    switch (language) {
        case 'typescript':
            return new TypeScriptParser();
        case 'javascript':
            return new JavaScriptParser();
        case 'python':
            return new PythonParser();
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}
//# sourceMappingURL=language-parsers.js.map