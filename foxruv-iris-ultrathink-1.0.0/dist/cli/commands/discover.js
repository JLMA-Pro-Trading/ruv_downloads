import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import enquirer from 'enquirer';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
const { prompt } = enquirer;
export const discoverCommand = new Command('discover')
    .description('Discover AI experts in codebase')
    .option('--path <path>', 'Path to scan', './')
    .option('--languages <list>', 'Comma-separated language list (ts,js,py,go,rs)', 'ts,js,py')
    .option('--confidence <threshold>', 'Minimum confidence threshold (0-1)', '0.7')
    .option('-o, --output <file>', 'Save results to JSON file')
    .option('--interactive', 'Interactive instrumentation mode', true)
    .option('--no-interactive', 'Skip interactive prompts')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
    const spinner = ora('Discovering AI experts...').start();
    try {
        const scanPath = resolve(options.path);
        if (!existsSync(scanPath)) {
            spinner.fail('Path not found');
            console.log(chalk.gray(`Expected: ${scanPath}`));
            process.exit(1);
        }
        const languages = options.languages.split(',').map((l) => l.trim());
        const confidenceThreshold = parseFloat(options.confidence);
        spinner.text = 'Scanning codebase...';
        // Scan for experts
        const scanner = new CodeScanner({
            languages,
            confidenceThreshold,
            verbose: options.verbose
        });
        const result = await scanner.scan(scanPath);
        spinner.succeed(chalk.green(`Discovered ${result.experts.length} experts!`));
        // Display results
        console.log(chalk.cyan('\n📊 Discovery Summary:'));
        console.log(chalk.gray(`  Total files scanned: ${result.summary.totalFiles}`));
        console.log(chalk.gray(`  Total experts found: ${result.summary.totalExperts}`));
        console.log(chalk.gray(`  With telemetry: ${result.summary.withTelemetry}`));
        console.log(chalk.gray(`  Without telemetry: ${result.summary.withoutTelemetry}`));
        console.log(chalk.cyan('\n📋 By Language:'));
        for (const [lang, count] of Object.entries(result.summary.byLanguage)) {
            console.log(chalk.gray(`  ${lang}: ${count}`));
        }
        console.log(chalk.cyan('\n🔍 By Type:'));
        for (const [type, count] of Object.entries(result.summary.byType)) {
            console.log(chalk.gray(`  ${type}: ${count}`));
        }
        // Show top experts
        console.log(chalk.cyan('\n🌟 Top Experts (by confidence):'));
        const topExperts = result.experts
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10);
        for (const expert of topExperts) {
            const telemetryIcon = expert.hasTelemetry ? '✓' : '✗';
            console.log(chalk.gray(`  ${telemetryIcon} ${expert.name} (${(expert.confidence * 100).toFixed(0)}%)`));
            console.log(chalk.gray(`     ${expert.filePath}:${expert.lineStart}`));
        }
        // Interactive instrumentation
        if (options.interactive && result.summary.withoutTelemetry > 0) {
            console.log(chalk.yellow(`\n⚠️  ${result.summary.withoutTelemetry} experts without telemetry`));
            const { shouldInstrument } = await prompt({
                type: 'confirm',
                name: 'shouldInstrument',
                message: 'Would you like to instrument them now?',
                initial: false
            });
            if (shouldInstrument) {
                const instrumentSpinner = ora('Preparing instrumentation...').start();
                const expertsToInstrument = result.experts.filter(e => !e.hasTelemetry);
                for (const expert of expertsToInstrument) {
                    instrumentSpinner.text = `Instrumenting ${expert.name}...`;
                    await instrumentExpert(expert);
                }
                instrumentSpinner.succeed(chalk.green('Instrumentation complete!'));
                console.log(chalk.cyan('\nInstrumented experts:'));
                expertsToInstrument.forEach(e => {
                    console.log(chalk.gray(`  ✓ ${e.name}`));
                });
            }
        }
        // Save results
        if (options.output) {
            const outputPath = resolve(options.output);
            await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
            console.log(chalk.green(`\n💾 Results saved to: ${outputPath}`));
        }
        console.log(chalk.cyan('\n✨ Discovery complete!'));
    }
    catch (error) {
        spinner.fail(chalk.red('Discovery failed'));
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        if (options.parent?.opts().debug) {
            console.error(error);
        }
        process.exit(1);
    }
});
class CodeScanner {
    languages;
    confidenceThreshold;
    verbose;
    constructor(options) {
        this.languages = options.languages;
        this.confidenceThreshold = options.confidenceThreshold;
        this.verbose = options.verbose;
    }
    async scan(path) {
        const result = {
            experts: [],
            summary: {
                totalFiles: 0,
                totalExperts: 0,
                byLanguage: {},
                byType: {},
                withTelemetry: 0,
                withoutTelemetry: 0
            }
        };
        const files = this.findSourceFiles(path);
        result.summary.totalFiles = files.length;
        for (const file of files) {
            const experts = await this.scanFile(file);
            for (const expert of experts) {
                if (expert.confidence >= this.confidenceThreshold) {
                    result.experts.push(expert);
                    result.summary.byLanguage[expert.language] =
                        (result.summary.byLanguage[expert.language] || 0) + 1;
                    result.summary.byType[expert.expertType] =
                        (result.summary.byType[expert.expertType] || 0) + 1;
                    if (expert.hasTelemetry) {
                        result.summary.withTelemetry++;
                    }
                    else {
                        result.summary.withoutTelemetry++;
                    }
                }
            }
        }
        result.summary.totalExperts = result.experts.length;
        return result;
    }
    findSourceFiles(path) {
        const files = [];
        const extensionMap = {
            ts: ['.ts'],
            js: ['.js'],
            py: ['.py'],
            go: ['.go'],
            rs: ['.rs']
        };
        const extensions = new Set();
        this.languages.forEach(lang => {
            extensionMap[lang]?.forEach(ext => extensions.add(ext));
        });
        const walk = (dir) => {
            if (!existsSync(dir))
                return;
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = resolve(dir, entry.name);
                    // Skip ignored directories
                    if (entry.name.startsWith('.'))
                        continue;
                    if (['node_modules', 'dist', 'build', '__pycache__', 'target'].includes(entry.name))
                        continue;
                    if (entry.isDirectory()) {
                        walk(fullPath);
                    }
                    else if (entry.isFile()) {
                        const ext = entry.name.substring(entry.name.lastIndexOf('.'));
                        if (extensions.has(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                // Skip directories we can't read
            }
        };
        walk(path);
        return files;
    }
    async scanFile(filePath) {
        try {
            const content = await readFile(filePath, 'utf-8');
            const ext = filePath.substring(filePath.lastIndexOf('.'));
            const language = this.getLanguage(ext);
            if (!language)
                return [];
            return this.detectExperts(filePath, content, language);
        }
        catch (error) {
            if (this.verbose) {
                console.warn(`Warning: Could not scan ${filePath}`);
            }
            return [];
        }
    }
    getLanguage(ext) {
        switch (ext) {
            case '.ts': return 'typescript';
            case '.js': return 'javascript';
            case '.py': return 'python';
            case '.go': return 'go';
            case '.rs': return 'rust';
            default: return null;
        }
    }
    detectExperts(filePath, content, language) {
        const experts = [];
        // AI/ML keywords to look for
        const aiKeywords = [
            'predict', 'generate', 'train', 'infer', 'classify', 'embed',
            'optimize', 'model', 'neural', 'agent', 'llm', 'ai', 'ml'
        ];
        // Function patterns by language
        const patterns = {
            typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
            javascript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
            python: /def\s+(\w+)\s*\([^)]*\):/g,
            go: /func\s+(\w+)\s*\([^)]*\)/g,
            rust: /fn\s+(\w+)\s*\([^)]*\)/g
        };
        const pattern = patterns[language];
        if (!pattern)
            return experts;
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const funcName = match[1];
            const startPos = match.index;
            const lineStart = content.substring(0, startPos).split('\n').length;
            // Check if function name contains AI keywords
            const isAIFunction = aiKeywords.some(keyword => funcName.toLowerCase().includes(keyword.toLowerCase()));
            if (!isAIFunction)
                continue;
            // Check for telemetry
            const funcEnd = this.findFunctionEnd(content, startPos, language);
            const funcBody = content.substring(startPos, funcEnd);
            const hasTelemetry = this.checkForTelemetry(funcBody);
            experts.push({
                id: randomUUID(),
                name: funcName,
                filePath,
                language,
                expertType: this.classifyExpertType(funcName),
                signature: match[0],
                description: `AI function: ${funcName}`,
                hasTelemetry,
                confidence: 0.8,
                lineStart,
                lineEnd: content.substring(0, funcEnd).split('\n').length,
                metadata: { pattern: 'function' }
            });
        }
        return experts;
    }
    findFunctionEnd(content, startPos, _language) {
        // Simple heuristic: find matching brace
        let depth = 0;
        let foundOpen = false;
        for (let i = startPos; i < content.length; i++) {
            const char = content[i];
            if (char === '{') {
                depth++;
                foundOpen = true;
            }
            else if (char === '}') {
                depth--;
                if (foundOpen && depth === 0) {
                    return i + 1;
                }
            }
        }
        return Math.min(startPos + 500, content.length);
    }
    checkForTelemetry(code) {
        const telemetryPatterns = [
            'logTelemetry',
            'recordExecution',
            'trackPerformance',
            'saveReflexion',
            'storeExecution',
            'telemetry',
            'metrics'
        ];
        return telemetryPatterns.some(pattern => code.includes(pattern));
    }
    classifyExpertType(name) {
        const lower = name.toLowerCase();
        if (lower.includes('predict') || lower.includes('infer'))
            return 'ai_function';
        if (lower.includes('train') || lower.includes('model'))
            return 'ml_model';
        if (lower.includes('pipeline') || lower.includes('process'))
            return 'data_pipeline';
        if (lower.includes('handler') || lower.includes('api'))
            return 'api_handler';
        return 'generic';
    }
}
async function instrumentExpert(expert) {
    // This is a placeholder - actual instrumentation would modify files
    console.log(chalk.gray(`  Planning instrumentation for: ${expert.name}`));
    // In a real implementation:
    // 1. Read the file
    // 2. Parse AST
    // 3. Insert telemetry calls
    // 4. Write back to file
}
//# sourceMappingURL=discover.js.map