/**
 * Dependency Checker
 *
 * Runtime detection of optional dependencies (ax-llm, dspy, agentdb, etc.)
 *
 * @module utils/dependency-checker
 * @version 1.0.0
 */
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
/**
 * Check if a Node.js package is available
 */
export async function checkNodeDependency(packageName) {
    try {
        await import(packageName);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if a Python package is available
 * Checks .venv first, then falls back to system python
 */
export async function checkPythonDependency(packageName) {
    // Priority 1: Check common venv locations
    const venvPaths = [
        '.venv/bin/python3',
        'venv/bin/python3',
        '.virtualenv/bin/python3',
        '../.venv/bin/python3' // For nested projects
    ];
    for (const venvPython of venvPaths) {
        try {
            const fs = await import('fs');
            if (fs.existsSync(venvPython)) {
                await execAsync(`${venvPython} -c "import ${packageName}"`);
                return true;
            }
        }
        catch {
            // Try next venv path
            continue;
        }
    }
    // Priority 2: Fall back to system python
    try {
        await execAsync(`python3 -c "import ${packageName}"`);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Generic dependency check
 */
export async function checkDependency(runtime, packageName) {
    if (runtime === 'node') {
        return await checkNodeDependency(packageName);
    }
    else {
        return await checkPythonDependency(packageName);
    }
}
/**
 * Detect all available dependencies for Iris
 */
export async function detectAvailableDependencies() {
    const [agentdb, agenticFlow, dspy, ax] = await Promise.all([
        checkNodeDependency('agentdb'),
        checkNodeDependency('agentic-flow'),
        checkPythonDependency('dspy'),
        checkPythonDependency('ax')
    ]);
    return { agentdb, agenticFlow, dspy, ax };
}
/**
 * Print dependency status to console
 */
export async function printDependencyStatus() {
    console.log('Checking dependencies...');
    const deps = await detectAvailableDependencies();
    console.log(`${deps.agentdb ? '✅' : '❌'} agentdb: ${deps.agentdb ? 'installed' : 'not found'}`);
    console.log(`${deps.agenticFlow ? '✅' : '❌'} agentic-flow: ${deps.agenticFlow ? 'installed' : 'not found'}`);
    console.log(`${deps.dspy ? '✅' : '❌'} dspy: ${deps.dspy ? 'installed' : 'not found'}`);
    console.log(`${deps.ax ? '✅' : '❌'} ax-platform: ${deps.ax ? 'installed' : 'not found'}`);
    if (!deps.agentdb) {
        console.log('   Install with: npm install agentdb');
    }
    if (!deps.agenticFlow) {
        console.log('   Install with: npm install agentic-flow');
    }
    if (!deps.dspy) {
        console.log('   Install with: pip install dspy-ai');
    }
    if (!deps.ax) {
        console.log('   Install with: pip install ax-platform');
    }
}
