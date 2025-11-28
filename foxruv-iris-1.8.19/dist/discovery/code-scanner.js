/**
 * Code Scanner - TypeScript AST Analysis for Expert Discovery
 *
 * Scans TypeScript codebases to discover expert classes, prediction methods,
 * and telemetry integration using the TypeScript Compiler API.
 */
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs/promises';
import { glob } from 'glob';
// ============================================================================
// Constants
// ============================================================================
const EXPERT_CLASS_PATTERNS = [
    /Expert$/i,
    /Analyst$/i,
    /Agent$/i,
    /Predictor$/i,
    /Learner$/i,
    /Trainer$/i,
    /Optimizer$/i,
];
const PREDICTION_METHOD_NAMES = [
    'predict',
    'analyze',
    'execute',
    'run',
    'evaluate',
    'process',
    'compute',
    'calculate',
    'infer',
    'captureException',
];
const TELEMETRY_IMPORTS = ['logTelemetry'];
const DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/docs/**',
    '**/examples/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/__tests__/**',
    '**/*.d.ts',
    '**/types/**'
];
// ============================================================================
// Main Scanner Functions
// ============================================================================
/**
 * Scan an entire project for expert classes and prediction methods
 */
export async function scanProject(projectPath, options = {}) {
    const startTime = Date.now();
    const errors = [];
    const allExperts = [];
    // Normalize path
    const absolutePath = path.resolve(projectPath);
    // Default patterns
    const includePatterns = options.include || ['**/*.ts', '**/*.tsx'];
    const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(options.exclude || []),
    ];
    try {
        // Verify project path exists
        await fs.access(absolutePath);
        // Find all TypeScript files
        const files = await findTypeScriptFiles(absolutePath, includePatterns, excludePatterns, options.followSymlinks);
        if (options.verbose) {
            console.log(`Found ${files.length} TypeScript files to scan`);
        }
        // Scan each file
        let scannedCount = 0;
        for (const filePath of files) {
            try {
                const experts = await scanFile(filePath, absolutePath);
                allExperts.push(...experts);
                scannedCount++;
                if (options.verbose && experts.length > 0) {
                    console.log(`  ✓ ${path.relative(absolutePath, filePath)}: ${experts.length} expert(s)`);
                }
            }
            catch (error) {
                errors.push({
                    filePath: path.relative(absolutePath, filePath),
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                if (options.verbose) {
                    console.error(`  ✗ ${path.relative(absolutePath, filePath)}: ${error}`);
                }
            }
        }
        const scanTime = Date.now() - startTime;
        return {
            projectPath: absolutePath,
            experts: allExperts,
            totalFiles: files.length,
            scannedFiles: scannedCount,
            scanTime,
            errors,
            timestamp: new Date(),
        };
    }
    catch (error) {
        throw new Error(`Failed to scan project at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Scan a single TypeScript file for expert classes
 */
export async function scanFile(filePath, projectRoot) {
    const absolutePath = path.resolve(filePath);
    // Read file content
    const content = await fs.readFile(absolutePath, 'utf-8');
    // Parse TypeScript
    const sourceFile = ts.createSourceFile(absolutePath, content, ts.ScriptTarget.Latest, true);
    // Extract imports
    const imports = extractImports(sourceFile);
    // Check for telemetry and Supabase
    const hasTelemetry = imports.some((imp) => imp.importedNames.some((name) => TELEMETRY_IMPORTS.includes(name)));
    const hasSupabaseInit = content.includes('createClient') &&
        (content.includes('@supabase/supabase-js') || content.includes('supabase'));
    // Find expert classes
    const experts = [];
    const visitNode = (node) => {
        if (ts.isClassDeclaration(node)) {
            const className = node.name?.text;
            if (className && isExpertClass(className)) {
                const expert = analyzeClass(node, className, absolutePath, projectRoot || path.dirname(absolutePath), imports, hasTelemetry, hasSupabaseInit);
                experts.push(expert);
            }
        }
        ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
    return experts;
}
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Find all TypeScript files matching patterns
 */
async function findTypeScriptFiles(rootPath, includePatterns, excludePatterns, followSymlinks = false) {
    const files = [];
    for (const pattern of includePatterns) {
        const matches = await glob(pattern, {
            cwd: rootPath,
            absolute: true,
            ignore: excludePatterns,
            follow: followSymlinks,
            nodir: true,
        });
        files.push(...matches);
    }
    // Remove duplicates
    return [...new Set(files)];
}
/**
 * Extract import information from source file
 */
function extractImports(sourceFile) {
    const imports = [];
    const visitNode = (node) => {
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier.text;
            const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const importInfo = {
                moduleName: moduleSpecifier,
                importedNames: [],
                isDefault: false,
                isNamespace: false,
                lineNumber,
            };
            if (node.importClause) {
                // Default import
                if (node.importClause.name) {
                    importInfo.isDefault = true;
                    importInfo.importedNames.push(node.importClause.name.text);
                }
                // Named imports
                if (node.importClause.namedBindings) {
                    if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                        importInfo.isNamespace = true;
                        importInfo.importedNames.push(node.importClause.namedBindings.name.text);
                    }
                    else if (ts.isNamedImports(node.importClause.namedBindings)) {
                        node.importClause.namedBindings.elements.forEach((element) => {
                            importInfo.importedNames.push(element.name.text);
                        });
                    }
                }
            }
            imports.push(importInfo);
        }
        ts.forEachChild(node, visitNode);
    };
    visitNode(sourceFile);
    return imports;
}
/**
 * Analyze a class declaration and extract metadata
 */
function analyzeClass(node, className, filePath, projectRoot, imports, hasTelemetry, hasSupabaseInit) {
    const sourceFile = node.getSourceFile();
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    // Check export type
    let exportType = 'none';
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exportType = 'named';
    }
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
        exportType = 'default';
    }
    // Extract inheritance
    const extendsClass = node.heritageClauses
        ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types[0]?.expression.getText();
    const implementsInterfaces = node.heritageClauses
        ?.find((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
        ?.types.map((type) => type.expression.getText());
    // Extract methods
    const methods = [];
    node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member)) {
            const method = analyzeMethod(member, sourceFile);
            if (method) {
                methods.push(method);
            }
        }
    });
    return {
        className,
        filePath,
        relativePath: path.relative(projectRoot, filePath),
        methods,
        imports,
        hasTelemetry,
        hasSupabaseInit,
        lineNumber,
        exportType,
        extendsClass,
        implementsInterfaces,
    };
}
/**
 * Analyze a method declaration
 */
function analyzeMethod(node, sourceFile) {
    const name = node.name.getText();
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    // Check visibility
    const isPublic = !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword ||
        m.kind === ts.SyntaxKind.ProtectedKeyword);
    const isStatic = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    // Check async
    const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    // Extract parameters
    const parameters = node.parameters.map((param) => ({
        name: param.name.getText(),
        type: param.type ? param.type.getText() : 'any',
        isOptional: !!param.questionToken,
        hasDefault: !!param.initializer,
        defaultValue: param.initializer?.getText(),
    }));
    // Extract return type
    const returnType = node.type ? node.type.getText() : 'void';
    // Extract JSDoc
    const jsDocComment = ts.getJSDocCommentsAndTags(node)[0]?.comment?.toString();
    return {
        name,
        isAsync,
        parameters,
        returnType,
        lineNumber,
        isPredictionMethod: isPredictionMethod(name),
        isPublic,
        isStatic,
        jsDocComment,
    };
}
// ============================================================================
// Validation Functions
// ============================================================================
/**
 * Check if a class name matches expert patterns
 */
export function isExpertClass(className) {
    return EXPERT_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}
/**
 * Check if a method name is a prediction method
 */
export function isPredictionMethod(methodName) {
    const lowerName = methodName.toLowerCase();
    return PREDICTION_METHOD_NAMES.some((name) => lowerName.includes(name));
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Generate a summary report from scan results
 */
export function generateSummary(result) {
    const lines = [
        '='.repeat(80),
        'Code Scanner Summary',
        '='.repeat(80),
        '',
        `Project: ${result.projectPath}`,
        `Scanned: ${result.scannedFiles}/${result.totalFiles} files`,
        `Duration: ${result.scanTime}ms`,
        `Timestamp: ${result.timestamp.toISOString()}`,
        '',
        `Discovered Experts: ${result.experts.length}`,
    ];
    if (result.errors.length > 0) {
        lines.push('', `Errors: ${result.errors.length}`);
    }
    lines.push('', 'Expert Details:', '-'.repeat(80));
    result.experts.forEach((expert) => {
        const predictionMethods = expert.methods.filter((m) => m.isPredictionMethod);
        lines.push(`  ${expert.className} (${expert.relativePath}:${expert.lineNumber})`, `    Methods: ${expert.methods.length} (${predictionMethods.length} prediction)`, `    Telemetry: ${expert.hasTelemetry ? '✓' : '✗'}`, `    Supabase: ${expert.hasSupabaseInit ? '✓' : '✗'}`, '');
    });
    if (result.errors.length > 0) {
        lines.push('', 'Errors:', '-'.repeat(80));
        result.errors.forEach((error) => {
            lines.push(`  ${error.filePath}: ${error.error}`);
        });
    }
    lines.push('', '='.repeat(80));
    return lines.join('\n');
}
/**
 * Filter experts by criteria
 */
export function filterExperts(experts, criteria) {
    return experts.filter((expert) => {
        if (criteria.hasTelemetry !== undefined && expert.hasTelemetry !== criteria.hasTelemetry) {
            return false;
        }
        if (criteria.hasSupabaseInit !== undefined &&
            expert.hasSupabaseInit !== criteria.hasSupabaseInit) {
            return false;
        }
        if (criteria.hasPredictionMethods !== undefined &&
            criteria.hasPredictionMethods &&
            !expert.methods.some((m) => m.isPredictionMethod)) {
            return false;
        }
        if (criteria.minMethods !== undefined && expert.methods.length < criteria.minMethods) {
            return false;
        }
        return true;
    });
}
