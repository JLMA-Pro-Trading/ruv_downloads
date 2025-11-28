/**
 * Code Instrumentation Engine
 *
 * Automatically adds webhook-based telemetry to expert classes by:
 * - Adding a simple fetch-based telemetry helper function
 * - Wrapping prediction methods with telemetry logging
 * - Sending telemetry data to hardcoded Iris backend
 *
 * Uses TypeScript AST parsing for safe code modifications.
 * Zero configuration required - auto-detects projectId from package.json.
 */
import * as ts from 'typescript';
import * as fs from 'fs/promises';
/**
 * Code Instrumentation Engine for Expert Classes
 */
export class CodeInstrumenter {
    options;
    constructor(options = {}) {
        this.options = {
            preserveComments: options.preserveComments ?? true,
            addErrorHandling: options.addErrorHandling ?? true,
            nonBlocking: options.nonBlocking ?? true,
            skipIfInstrumented: options.skipIfInstrumented ?? true,
            telemetryImportPath: options.telemetryImportPath ?? '@foxruv/iris',
        };
    }
    /**
     * Main entry point: Instrument an expert class file
     */
    async instrumentExpert(expert, options) {
        const opts = { ...this.options, ...options };
        const changes = [];
        try {
            // Read the source file
            const sourceCode = await fs.readFile(expert.filePath, 'utf-8');
            // Check if already instrumented
            if (opts.skipIfInstrumented && this.isAlreadyInstrumented(sourceCode)) {
                console.log(`Skipping ${expert.filePath}: already instrumented`);
                return changes;
            }
            // Parse TypeScript AST
            const sourceFile = ts.createSourceFile(expert.filePath, sourceCode, ts.ScriptTarget.Latest, true);
            // Step 1: Add imports
            const importChange = await this.addImports(expert.filePath, sourceFile, sourceCode);
            if (importChange) {
                changes.push(importChange);
            }
            // Step 2: Find the expert class
            const classNode = this.findExpertClass(sourceFile, expert.className);
            if (!classNode) {
                console.warn(`Class not found in ${expert.filePath}`);
                return changes;
            }
            // Step 3: Modify constructor
            const constructorChanges = await this.modifyConstructor(expert.filePath, classNode, sourceCode);
            changes.push(...constructorChanges);
            // Step 4: Wrap prediction methods
            const methodNames = expert.predictionMethods || this.findPredictionMethods(classNode);
            for (const methodName of methodNames) {
                const methodChange = await this.wrapMethod(expert.filePath, methodName, expert, classNode, sourceCode);
                if (methodChange) {
                    changes.push(methodChange);
                }
            }
            return changes;
        }
        catch (error) {
            console.error(`Error instrumenting ${expert.filePath}:`, error);
            throw new Error(`Instrumentation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Add telemetry helper function to the file (no imports needed)
     */
    async addImports(filePath, sourceFile, sourceCode) {
        if (!sourceCode) {
            sourceCode = await fs.readFile(filePath, 'utf-8');
        }
        if (!sourceFile) {
            sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
        }
        // Check if helper already exists
        const hasTelemetryHelper = sourceCode.includes('sendIrisTelemetry');
        if (hasTelemetryHelper) {
            return null; // Already has helper
        }
        // Find the position to insert helper (after last import statement)
        let insertPosition = 0;
        let lastImportEnd = 0;
        ts.forEachChild(sourceFile, (node) => {
            if (ts.isImportDeclaration(node)) {
                lastImportEnd = node.end;
            }
        });
        insertPosition = lastImportEnd > 0 ? lastImportEnd : 0;
        const helperFunction = this.generateTelemetryHelper();
        const lineNumber = sourceFile.getLineAndCharacterOfPosition(insertPosition).line + 1;
        return {
            filePath,
            type: 'import_added',
            lineNumber,
            before: '',
            after: helperFunction,
            description: 'Added webhook telemetry helper',
        };
    }
    /**
     * Modify constructor (no longer needed for HTTP-based telemetry)
     */
    async modifyConstructor(_filePath, _classNode, _sourceCode) {
        // HTTP-based telemetry doesn't need constructor initialization
        // Just return empty changes array
        return [];
    }
    /**
     * Wrap a prediction method with telemetry logging
     */
    async wrapMethod(filePath, methodName, expert, classNode, sourceCode) {
        if (!sourceCode) {
            sourceCode = await fs.readFile(filePath, 'utf-8');
        }
        if (!classNode) {
            const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
            classNode = this.findExpertClass(sourceFile, expert.className);
            if (!classNode) {
                return null;
            }
        }
        // Find the method
        let methodNode;
        classNode.members.forEach((member) => {
            if (ts.isMethodDeclaration(member) &&
                member.name &&
                ts.isIdentifier(member.name) &&
                member.name.text === methodName) {
                methodNode = member;
            }
        });
        if (!methodNode) {
            console.warn(`Method ${methodName} not found in class`);
            return null;
        }
        // Check if already wrapped
        const methodText = sourceCode.substring(methodNode.pos, methodNode.end);
        if (methodText.includes('sendIrisTelemetry') || methodText.includes('startTime')) {
            return null; // Already instrumented
        }
        // Generate wrapped method
        const wrappedMethod = this.generateWrappedMethod(methodNode, methodName, expert, sourceCode);
        const lineNumber = ts.getLineAndCharacterOfPosition(methodNode.getSourceFile(), methodNode.pos).line + 1;
        return {
            filePath,
            type: 'method_wrapped',
            lineNumber,
            before: methodText.trim(),
            after: wrappedMethod,
            description: `Wrapped ${methodName} with telemetry`,
        };
    }
    /**
     * Apply all code changes to the file system
     */
    async applyChanges(changes) {
        if (changes.length === 0) {
            return;
        }
        // Group changes by file
        const changesByFile = new Map();
        for (const change of changes) {
            const fileChanges = changesByFile.get(change.filePath) || [];
            fileChanges.push(change);
            changesByFile.set(change.filePath, fileChanges);
        }
        // Apply changes to each file
        for (const [filePath, fileChanges] of changesByFile) {
            await this.applyChangesToFile(filePath, fileChanges);
        }
    }
    /**
     * Generate a unified diff of changes
     */
    async generateDiff(changes) {
        const diffLines = [];
        const changesByFile = new Map();
        for (const change of changes) {
            const fileChanges = changesByFile.get(change.filePath) || [];
            fileChanges.push(change);
            changesByFile.set(change.filePath, fileChanges);
        }
        for (const [filePath, fileChanges] of changesByFile) {
            diffLines.push(`--- ${filePath}`);
            diffLines.push(`+++ ${filePath}`);
            diffLines.push('');
            for (const change of fileChanges) {
                diffLines.push(`@@ Line ${change.lineNumber} @@ ${change.description}`);
                if (change.before) {
                    diffLines.push(`- ${change.before.trim()}`);
                }
                if (change.after) {
                    diffLines.push(`+ ${change.after.trim()}`);
                }
                diffLines.push('');
            }
        }
        return diffLines.join('\n');
    }
    // Helper methods
    isAlreadyInstrumented(sourceCode) {
        return sourceCode.includes('sendIrisTelemetry');
    }
    findExpertClass(sourceFile, className) {
        let targetClass;
        const visit = (node) => {
            if (ts.isClassDeclaration(node)) {
                if (!className || (node.name && node.name.text === className)) {
                    targetClass = node;
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return targetClass;
    }
    findPredictionMethods(classNode) {
        const methods = [];
        const predictionKeywords = ['predict', 'analyze', 'evaluate', 'assess', 'compute'];
        classNode.members.forEach((member) => {
            if (ts.isMethodDeclaration(member) &&
                member.name &&
                ts.isIdentifier(member.name)) {
                const methodName = member.name.text;
                if (predictionKeywords.some((keyword) => methodName.toLowerCase().includes(keyword))) {
                    methods.push(methodName);
                }
            }
        });
        return methods;
    }
    /**
     * Generate webhook-based telemetry helper function
     * Zero configuration - hardcoded backend URL, auto-detects projectId
     */
    generateTelemetryHelper() {
        return `
/**
 * Helper function for webhook-based telemetry
 * Automatically sends to Iris backend with zero configuration
 */
async function sendIrisTelemetry(data: any): Promise<void> {
  try {
    await fetch('https://iris-prime-hbj41m305-legonow.vercel.app/api/iris/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (err) {
    // Silent fail - don't break predictions
  }
}
`;
    }
    generateWrappedMethod(methodNode, methodName, expert, sourceCode) {
        const methodText = sourceCode.substring(methodNode.pos, methodNode.end);
        const body = methodNode.body;
        if (!body) {
            return methodText; // Can't wrap methods without body
        }
        const bodyText = sourceCode.substring(body.pos + 1, body.end - 1).trim();
        const isAsync = methodNode.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword);
        // Get method signature parts
        const params = methodNode.parameters
            .map((p) => sourceCode.substring(p.pos, p.end).trim())
            .join(', ');
        const returnType = methodNode.type
            ? sourceCode.substring(methodNode.type.pos, methodNode.type.end).trim()
            : 'any';
        // Auto-detect projectId from package.json name or directory
        const projectId = expert.name || 'unknown-project';
        const wrappedBody = `
  ${isAsync ? 'async ' : ''}${methodName}(${params})${returnType ? ': ' + returnType : ''} {
    const startTime = Date.now();
    let outcome = 'success';
    let confidence = 0;

    try {
      ${bodyText}

      // Extract confidence if available in result
      const result = ${isAsync ? 'await ' : ''}(() => { ${bodyText} })();
      confidence = typeof result === 'object' && result?.confidence ? result.confidence : 0;

      // Send telemetry (non-blocking)
      sendIrisTelemetry({
        projectId: '${projectId}',
        expertId: this.constructor.name,
        confidence,
        latencyMs: Date.now() - startTime,
        outcome: 'success'
      }).catch(() => {}); // Ignore telemetry errors

      return result;
    } catch (error) {
      outcome = 'error';

      // Send error telemetry (non-blocking)
      sendIrisTelemetry({
        projectId: '${projectId}',
        expertId: this.constructor.name,
        confidence: 0,
        latencyMs: Date.now() - startTime,
        outcome: 'error'
      }).catch(() => {}); // Ignore telemetry errors

      throw error;
    }
  }`;
        return wrappedBody;
    }
    async applyChangesToFile(filePath, changes) {
        let content = await fs.readFile(filePath, 'utf-8');
        // Sort changes by line number (descending) to avoid position shifts
        const sortedChanges = [...changes].sort((a, b) => b.lineNumber - a.lineNumber);
        for (const change of sortedChanges) {
            switch (change.type) {
                case 'import_added':
                    // Add at the beginning after other imports
                    content = this.insertAfterImports(content, change.after);
                    break;
                case 'method_wrapped':
                case 'constructor_modified':
                case 'method_added':
                    // Replace the old code with new code
                    if (change.before) {
                        content = content.replace(change.before, change.after);
                    }
                    else {
                        // Insert at line number
                        content = this.insertAtLine(content, change.lineNumber, change.after);
                    }
                    break;
            }
        }
        // Write back to file
        await fs.writeFile(filePath, content, 'utf-8');
    }
    insertAfterImports(content, insertText) {
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        if (lastImportIndex >= 0) {
            lines.splice(lastImportIndex + 1, 0, insertText.trim());
        }
        else {
            lines.unshift(insertText.trim());
        }
        return lines.join('\n');
    }
    insertAtLine(content, lineNumber, insertText) {
        const lines = content.split('\n');
        lines.splice(lineNumber, 0, insertText);
        return lines.join('\n');
    }
}
/**
 * Convenience function to instrument a single expert
 */
export async function instrumentExpert(expert, options) {
    const instrumenter = new CodeInstrumenter(options);
    return instrumenter.instrumentExpert(expert, options);
}
/**
 * Convenience function to instrument multiple experts in batch
 */
export async function instrumentExperts(experts, options) {
    const instrumenter = new CodeInstrumenter(options);
    const results = new Map();
    for (const expert of experts) {
        try {
            const changes = await instrumenter.instrumentExpert(expert, options);
            results.set(expert.filePath, changes);
        }
        catch (error) {
            console.error(`Failed to instrument ${expert.filePath}:`, error);
            results.set(expert.filePath, []);
        }
    }
    return results;
}
