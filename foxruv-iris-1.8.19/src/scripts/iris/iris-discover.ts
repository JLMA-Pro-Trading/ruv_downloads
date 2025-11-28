#!/usr/bin/env node
/**
 * IRIS Discover - Autonomous Expert Discovery & Instrumentation
 *
 * Orchestrates the complete discovery workflow:
 * 1. Scan project for expert functions/modules
 * 2. Store discoveries in AgentDB + Supabase
 * 3. Analyze gaps (missing telemetry)
 * 4. Interactive instrumentation approval
 * 5. Auto-instrument code with telemetry
 * 6. Summary and next steps
 *
 * Features:
 * - Multi-language support (TypeScript, JavaScript, Python)
 * - Pattern detection (DSPy signatures, AI functions, data pipelines)
 * - AgentDB vector storage for expert embeddings
 * - Supabase reflexion bank integration
 * - Interactive CLI prompts
 * - Dry-run mode
 * - JSON export
 *
 * Usage:
 *   iris discover --project <path> [options]
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Scan failed
 *
 * @version 1.0.0
 */

import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { AgentDBManager } from '../../storage/agentdb-integration.js'
import { initSupabaseFromEnv, isSupabaseInitialized, saveReflexion } from '../../supabase/index.js'
import { logTelemetry } from '../../supabase/index.js'

// ============================================================================
// Types
// ============================================================================

interface DiscoverOptions {
  project: string // Path to project directory
  interactive?: boolean // Default: true
  autoInstrument?: boolean // Skip prompts
  dryRun?: boolean // Just report, don't modify
  verbose?: boolean
  outputJson?: string // Save results to JSON
  dbBasePath?: string
  languages?: string[] // Filter by language
  expertTypes?: string[] // Filter by expert type
}

interface DiscoveredExpert {
  id: string
  name: string
  filePath: string
  language: 'typescript' | 'javascript' | 'python'
  expertType: 'dspy_signature' | 'ai_function' | 'data_pipeline' | 'optimization' | 'generic'
  signature: string
  description: string
  hasTelemetry: boolean
  confidence: number
  lineStart: number
  lineEnd: number
  embedding?: number[]
  metadata?: Record<string, any>
}

interface ScanResult {
  experts: DiscoveredExpert[]
  summary: {
    totalFiles: number
    totalExperts: number
    byLanguage: Record<string, number>
    byType: Record<string, number>
    withTelemetry: number
    withoutTelemetry: number
  }
  errors: string[]
}

interface InstrumentationChange {
  expertId: string
  filePath: string
  insertions: Array<{
    line: number
    code: string
  }>
  imports: string[]
}

// ============================================================================
// Code Scanner
// ============================================================================

class CodeScanner {
  private verbose: boolean
  private languages: string[]

  constructor(options: { verbose?: boolean; languages?: string[]; expertTypes?: string[] }) {
    this.verbose = options.verbose || false
    this.languages = options.languages || ['typescript', 'javascript', 'python']
  }

  /**
   * Scan project directory for experts
   */
  async scanProject(projectPath: string): Promise<ScanResult> {
    const result: ScanResult = {
      experts: [],
      summary: {
        totalFiles: 0,
        totalExperts: 0,
        byLanguage: {},
        byType: {},
        withTelemetry: 0,
        withoutTelemetry: 0
      },
      errors: []
    }

    try {
      const files = this.findSourceFiles(projectPath)
      result.summary.totalFiles = files.length

      if (this.verbose) {
        console.log(`\n📂 Scanning ${files.length} files...`)
      }

      for (const file of files) {
        try {
          const experts = await this.scanFile(file, projectPath)
          result.experts.push(...experts)

          for (const expert of experts) {
            result.summary.byLanguage[expert.language] =
              (result.summary.byLanguage[expert.language] || 0) + 1
            result.summary.byType[expert.expertType] =
              (result.summary.byType[expert.expertType] || 0) + 1

            if (expert.hasTelemetry) {
              result.summary.withTelemetry++
            } else {
              result.summary.withoutTelemetry++
            }
          }
        } catch (error) {
          result.errors.push(`${file}: ${error}`)
        }
      }

      result.summary.totalExperts = result.experts.length
    } catch (error) {
      result.errors.push(`Project scan failed: ${error}`)
    }

    return result
  }

  /**
   * Find source files in project
   */
  private findSourceFiles(projectPath: string): string[] {
    const files: string[] = []
    const extensions = new Set<string>()

    if (this.languages.includes('typescript')) extensions.add('.ts')
    if (this.languages.includes('javascript')) extensions.add('.js')
    if (this.languages.includes('python')) extensions.add('.py')

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return

      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        // Skip common ignore patterns
        if (entry.name.startsWith('.')) continue
        if (entry.name === 'node_modules') continue
        if (entry.name === '__pycache__') continue
        if (entry.name === 'dist') continue
        if (entry.name === 'build') continue

        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (extensions.has(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    walk(projectPath)
    return files
  }

  /**
   * Scan individual file for experts
   */
  private async scanFile(filePath: string, projectPath: string): Promise<DiscoveredExpert[]> {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const ext = path.extname(filePath)
    const language = ext === '.py' ? 'python' : ext === '.ts' ? 'typescript' : 'javascript'

    const experts: DiscoveredExpert[] = []

    // Pattern detection based on language
    if (language === 'typescript' || language === 'javascript') {
      experts.push(...this.scanTypeScript(filePath, projectPath, content, lines))
    } else if (language === 'python') {
      experts.push(...this.scanPython(filePath, projectPath, content, lines))
    }

    return experts
  }

  /**
   * Scan TypeScript/JavaScript file
   */
  private scanTypeScript(
    filePath: string,
    projectPath: string,
    content: string,
    _lines: string[]
  ): DiscoveredExpert[] {
    const experts: DiscoveredExpert[] = []
    const relativePath = path.relative(projectPath, filePath)

    // Pattern 1: DSPy-style signatures (class with fields)
    const signaturePattern = /class\s+(\w+)\s+(?:extends\s+\w+)?\s*{/g
    let match: RegExpExecArray | null

    while ((match = signaturePattern.exec(content)) !== null) {
      const className = match[1]
      const startPos = match.index
      const lineNum = content.substring(0, startPos).split('\n').length

      // Check if has fields (signature-like)
      const classEnd = this.findClosingBrace(content, startPos)
      const classBody = content.substring(startPos, classEnd)

      if (classBody.includes('field:') || classBody.includes('Field(')) {
        const hasTelemetry = this.checkForTelemetry(classBody)

        experts.push({
          id: `expert-${randomUUID()}`,
          name: className,
          filePath: relativePath,
          language: 'typescript',
          expertType: 'dspy_signature',
          signature: `class ${className}`,
          description: `DSPy-style signature: ${className}`,
          hasTelemetry,
          confidence: 0.9,
          lineStart: lineNum,
          lineEnd: content.substring(0, classEnd).split('\n').length,
          metadata: { classBody: classBody.substring(0, 200) }
        })
      }
    }

    // Pattern 2: AI/ML functions (async functions with AI keywords)
    const aiKeywords = ['predict', 'generate', 'optimize', 'train', 'infer', 'classify', 'embed']
    const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g

    while ((match = functionPattern.exec(content)) !== null) {
      const funcName = match[1]
      const startPos = match.index
      const lineNum = content.substring(0, startPos).split('\n').length

      // Check if function name suggests AI/ML
      const isAIFunction = aiKeywords.some(keyword =>
        funcName.toLowerCase().includes(keyword.toLowerCase())
      )

      if (isAIFunction) {
        const funcEnd = this.findFunctionEnd(content, startPos)
        const funcBody = content.substring(startPos, funcEnd)
        const hasTelemetry = this.checkForTelemetry(funcBody)

        experts.push({
          id: `expert-${randomUUID()}`,
          name: funcName,
          filePath: relativePath,
          language: 'typescript',
          expertType: 'ai_function',
          signature: match[0],
          description: `AI function: ${funcName}`,
          hasTelemetry,
          confidence: 0.8,
          lineStart: lineNum,
          lineEnd: content.substring(0, funcEnd).split('\n').length,
          metadata: { functionBody: funcBody.substring(0, 200) }
        })
      }
    }

    return experts
  }

  /**
   * Scan Python file
   */
  private scanPython(
    filePath: string,
    projectPath: string,
    content: string,
    _lines: string[]
  ): DiscoveredExpert[] {
    const experts: DiscoveredExpert[] = []
    const relativePath = path.relative(projectPath, filePath)

    // Pattern 1: DSPy signatures (classes with dspy.Signature)
    const signaturePattern = /class\s+(\w+)\(dspy\.Signature\):/g
    let match: RegExpExecArray | null

    while ((match = signaturePattern.exec(content)) !== null) {
      const className = match[1]
      const startPos = match.index
      const lineNum = content.substring(0, startPos).split('\n').length

      const classEnd = this.findPythonClassEnd(content, startPos)
      const classBody = content.substring(startPos, classEnd)
      const hasTelemetry = this.checkForTelemetry(classBody)

      experts.push({
        id: `expert-${randomUUID()}`,
        name: className,
        filePath: relativePath,
        language: 'python',
        expertType: 'dspy_signature',
        signature: match[0],
        description: `DSPy Signature: ${className}`,
        hasTelemetry,
        confidence: 0.95,
        lineStart: lineNum,
        lineEnd: content.substring(0, classEnd).split('\n').length,
        metadata: { classBody: classBody.substring(0, 200) }
      })
    }

    // Pattern 2: AI/ML functions (def with AI keywords)
    const aiKeywords = ['predict', 'generate', 'optimize', 'train', 'infer', 'classify', 'embed']
    const functionPattern = /def\s+(\w+)\s*\([^)]*\)/g

    while ((match = functionPattern.exec(content)) !== null) {
      const funcName = match[1]
      const startPos = match.index
      const lineNum = content.substring(0, startPos).split('\n').length

      const isAIFunction = aiKeywords.some(keyword =>
        funcName.toLowerCase().includes(keyword.toLowerCase())
      )

      if (isAIFunction) {
        const funcEnd = this.findPythonFunctionEnd(content, startPos)
        const funcBody = content.substring(startPos, funcEnd)
        const hasTelemetry = this.checkForTelemetry(funcBody)

        experts.push({
          id: `expert-${randomUUID()}`,
          name: funcName,
          filePath: relativePath,
          language: 'python',
          expertType: 'ai_function',
          signature: match[0],
          description: `AI function: ${funcName}`,
          hasTelemetry,
          confidence: 0.8,
          lineStart: lineNum,
          lineEnd: content.substring(0, funcEnd).split('\n').length,
          metadata: { functionBody: funcBody.substring(0, 200) }
        })
      }
    }

    return experts
  }

  /**
   * Find closing brace for class/function
   */
  private findClosingBrace(content: string, startPos: number): number {
    let depth = 0
    let inString = false
    let stringChar = ''

    for (let i = startPos; i < content.length; i++) {
      const char = content[i]
      const prevChar = i > 0 ? content[i - 1] : ''

      // Handle strings
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString && char === stringChar) {
          inString = false
          stringChar = ''
        } else if (!inString) {
          inString = true
          stringChar = char
        }
      }

      if (!inString) {
        if (char === '{') depth++
        if (char === '}') {
          depth--
          if (depth === 0) return i
        }
      }
    }

    return content.length
  }

  /**
   * Find function end (heuristic)
   */
  private findFunctionEnd(content: string, startPos: number): number {
    const openBrace = content.indexOf('{', startPos)
    if (openBrace === -1) return startPos + 100
    return this.findClosingBrace(content, openBrace)
  }

  /**
   * Find Python class end (based on indentation)
   */
  private findPythonClassEnd(content: string, startPos: number): number {
    const lines = content.substring(startPos).split('\n')
    const classIndent = lines[0].search(/\S/)

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '') continue // Skip empty lines

      const indent = line.search(/\S/)
      if (indent !== -1 && indent <= classIndent) {
        // Found line with same or less indentation
        return startPos + lines.slice(0, i).join('\n').length
      }
    }

    return startPos + lines.join('\n').length
  }

  /**
   * Find Python function end
   */
  private findPythonFunctionEnd(content: string, startPos: number): number {
    return this.findPythonClassEnd(content, startPos)
  }

  /**
   * Check if code has telemetry
   */
  private checkForTelemetry(code: string): boolean {
    const telemetryPatterns = [
      'logTelemetry',
      'recordExecution',
      'trackPerformance',
      'saveReflexion',
      'storeExecution'
    ]

    return telemetryPatterns.some(pattern => code.includes(pattern))
  }
}

// ============================================================================
// Discovery Storage
// ============================================================================

class DiscoveryStorage {
  private agentDB: AgentDBManager
  private useSupabase: boolean

  constructor(dbPath?: string) {
    this.agentDB = new AgentDBManager({
      dbPath: dbPath || './data/iris/discovery.db',
      enableCausalReasoning: true,
      enableReflexion: true,
      enableSkillLibrary: true
    })

    this.useSupabase = isSupabaseInitialized()
  }

  /**
   * Store discovered expert
   */
  async storeDiscoveredExpert(expert: DiscoveredExpert): Promise<void> {
    // Generate embedding (mock for now)
    const embedding = expert.embedding || (await this.generateEmbedding(expert))

    // Store in AgentDB
    await this.agentDB.storeExpertEmbedding({
      expertId: expert.id,
      name: expert.name,
      signature: expert.signature,
      embedding,
      performance: expert.confidence,
      metadata: {
        filePath: expert.filePath,
        language: expert.language,
        expertType: expert.expertType,
        hasTelemetry: expert.hasTelemetry,
        lineStart: expert.lineStart,
        lineEnd: expert.lineEnd,
        ...expert.metadata
      }
    })

    // Store in Supabase
    if (this.useSupabase) {
      try {
        await saveReflexion(
          `discovery:${expert.expertType}`,
          {
            name: expert.name,
            description: expert.description,
            filePath: expert.filePath,
            language: expert.language,
            signature: expert.signature,
            hasTelemetry: expert.hasTelemetry
          },
          { confidence: expert.confidence },
          true,
          {
            expertId: expert.id,
            embedding,
            confidence: expert.confidence,
            impactScore: expert.confidence
          }
        )
      } catch (error) {
        console.warn(`⚠️  Supabase storage failed (non-blocking): ${error}`)
      }
    }
  }

  /**
   * Mark expert as instrumented
   */
  async markInstrumented(expertId: string, changes: InstrumentationChange): Promise<void> {
    // Update AgentDB metadata
    const expert = await this.agentDB.getExpert(expertId)
    if (expert) {
      await this.agentDB.storeExpertEmbedding({
        ...expert,
        metadata: {
          ...expert.metadata,
          instrumented: true,
          instrumentedAt: Date.now(),
          changes
        }
      })
    }
  }

  /**
   * Generate embedding for expert
   */
  private async generateEmbedding(expert: DiscoveredExpert): Promise<number[]> {
    // Mock embedding - in production use OpenAI/etc
    const text = `${expert.name} ${expert.description} ${expert.expertType}`
    const embedding = new Array(1536).fill(0)

    for (let i = 0; i < text.length; i++) {
      embedding[i % 1536] += text.charCodeAt(i) / 1000
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }

  close(): void {
    this.agentDB.close()
  }
}

// ============================================================================
// Interactive CLI
// ============================================================================

class InteractiveCLI {
  async presentDiscoveries(experts: DiscoveredExpert[]): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('🔍 IRIS DISCOVERY RESULTS')
    console.log('='.repeat(80))

    // Group by type
    const byType = new Map<string, DiscoveredExpert[]>()
    for (const expert of experts) {
      if (!byType.has(expert.expertType)) {
        byType.set(expert.expertType, [])
      }
      byType.get(expert.expertType)!.push(expert)
    }

    const typeEntries = Array.from(byType.entries())
    for (const [type, typeExperts] of typeEntries) {
      console.log(`\n📊 ${type.toUpperCase()} (${typeExperts.length})`)
      console.log('-'.repeat(80))

      for (const expert of typeExperts.slice(0, 5)) {
        const status = expert.hasTelemetry ? '✅' : '⚠️ '
        console.log(`  ${status} ${expert.name}`)
        console.log(`     File: ${expert.filePath}:${expert.lineStart}`)
        console.log(`     Confidence: ${(expert.confidence * 100).toFixed(0)}%`)
      }

      if (typeExperts.length > 5) {
        console.log(`  ... and ${typeExperts.length - 5} more`)
      }
    }

    console.log('\n' + '='.repeat(80))
  }

  async askInstrumentationApproval(
    missing: DiscoveredExpert[]
  ): Promise<{ approved: boolean; selected?: string[] }> {
    if (missing.length === 0) {
      return { approved: false }
    }

    console.log(`\n⚠️  Found ${missing.length} expert(s) without telemetry`)
    console.log('\nWould you like to auto-instrument them? (y/n)')

    // Simple stdin read (in production use proper readline)
    const readline = await import('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise(resolve => {
      rl.question('> ', (answer: string) => {
        rl.close()
        const approved = answer.trim().toLowerCase() === 'y'
        resolve({ approved })
      })
    })
  }
}

// ============================================================================
// Code Instrumenter
// ============================================================================

class CodeInstrumenter {
  async instrumentExpert(expert: DiscoveredExpert): Promise<InstrumentationChange> {
    const change: InstrumentationChange = {
      expertId: expert.id,
      filePath: expert.filePath,
      insertions: [],
      imports: []
    }

    if (expert.language === 'typescript' || expert.language === 'javascript') {
      // Add import
      change.imports.push(`import { logTelemetry } from '@foxruv/iris/supabase.js'`)

      // Add telemetry call at function end
      change.insertions.push({
        line: expert.lineEnd - 1,
        code: `  await logTelemetry({
    expertId: '${expert.name}',
    version: '1.0.0',
    runId: randomUUID(),
    outcome: 'success',
    metadata: { expertType: '${expert.expertType}' }
  })`
      })
    } else if (expert.language === 'python') {
      // Python telemetry (if available)
      change.imports.push(`from agent_learning_core import log_telemetry`)
      change.insertions.push({
        line: expert.lineEnd - 1,
        code: `    log_telemetry({
        'expert_id': '${expert.name}',
        'version': '1.0.0',
        'outcome': 'success'
    })`
      })
    }

    return change
  }

  async applyChanges(change: InstrumentationChange): Promise<void> {
    // Read file
    const content = fs.readFileSync(change.filePath, 'utf-8')
    const lines = content.split('\n')

    // Add imports at top
    for (const importLine of change.imports) {
      lines.unshift(importLine)
    }

    // Add insertions (in reverse order to preserve line numbers)
    const sortedInsertions = [...change.insertions].sort((a, b) => b.line - a.line)
    for (const insertion of sortedInsertions) {
      lines.splice(insertion.line, 0, insertion.code)
    }

    // Write file
    fs.writeFileSync(change.filePath, lines.join('\n'))
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(): DiscoverOptions | null {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return null
  }

  const options: Partial<DiscoverOptions> = {
    interactive: true,
    dryRun: false,
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--project':
      case '-p':
        options.project = args[++i]
        break
      case '--interactive':
      case '-i':
        options.interactive = args[++i]?.toLowerCase() === 'false' ? false : true
        break
      case '--auto-instrument':
        options.autoInstrument = true
        options.interactive = false
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--output-json':
        options.outputJson = args[++i]
        break
      case '--db-base-path':
        options.dbBasePath = args[++i]
        break
      case '--languages':
        options.languages = args[++i].split(',')
        break
      case '--expert-types':
        options.expertTypes = args[++i].split(',')
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        printHelp()
        process.exit(2)
    }
  }

  if (!options.project) {
    console.error('Error: --project is required')
    printHelp()
    process.exit(2)
  }

  return options as DiscoverOptions
}

function printHelp() {
  console.log(`
IRIS Discover - Autonomous Expert Discovery & Instrumentation

Usage:
  iris discover --project <path> [options]

Options:
  --project, -p <path>      Path to project directory
  --interactive, -i         Interactive mode (default: true)
  --auto-instrument         Auto-instrument without prompts
  --dry-run                 Show what would be done, don't modify
  --verbose, -v             Verbose output
  --output-json <file>      Save discoveries to JSON
  --db-base-path <path>     Base path for AgentDB databases
  --languages <list>        Comma-separated language list (ts,js,py)
  --expert-types <list>     Comma-separated expert types
  --help, -h                Show this help

Examples:
  iris discover --project ../nfl-predictor-api
  iris discover -p ../nfl-predictor-api --dry-run
  iris discover -p ../nfl-predictor-api --auto-instrument
  iris discover -p ../nfl-predictor-api --languages ts,js --verbose
  iris discover -p ../nfl-predictor-api --output-json discoveries.json

Exit Codes:
  0 = Success
  1 = Error
  2 = Invalid arguments
  3 = Scan failed
`)
}

// ============================================================================
// Main Orchestration
// ============================================================================

async function main(options: any = {}) {
  const startTime = Date.now()
  options = options && Object.keys(options).length > 0 ? options : parseArgs()

  if (!options) {
    process.exit(0) // Help was shown
  }

  let storage: DiscoveryStorage | null = null

  try {
    console.log('\n🔍 IRIS Discover - Autonomous Expert Discovery\n')

    // Initialize Supabase if available
    if (!isSupabaseInitialized()) {
      try {
        initSupabaseFromEnv()
        console.log('✅ Supabase initialized')
      } catch {
        console.log('⚠️  Supabase not configured (using local-only mode)')
      }
    }

    // STEP 1: Scan project for experts
    console.log(`\n📂 Scanning project: ${options.project}`)

    const scanner = new CodeScanner({
      verbose: options.verbose,
      languages: options.languages,
      expertTypes: options.expertTypes
    })

    const scanResult = await scanner.scanProject(options.project)

    if (scanResult.errors.length > 0) {
      console.error('\n❌ Scan errors:')
      scanResult.errors.forEach(err => console.error(`  - ${err}`))
    }

    // STEP 2: Store discoveries in AgentDB
    console.log('\n💾 Storing discoveries in AgentDB...')

    const dbBasePath = options.dbBasePath || './data/iris'
    storage = new DiscoveryStorage(path.join(dbBasePath, 'discovery.db'))

    for (const expert of scanResult.experts) {
      await storage.storeDiscoveredExpert(expert)
    }

    console.log(`✅ Stored ${scanResult.experts.length} expert(s)`)

    // STEP 3: Analyze gaps
    const missing = scanResult.experts.filter(e => !e.hasTelemetry)

    // STEP 4: Present results
    const cli = new InteractiveCLI()
    await cli.presentDiscoveries(scanResult.experts)

    console.log('\n' + '='.repeat(80))
    console.log('\n📊 DISCOVERY SUMMARY')
    console.log('-'.repeat(80))
    console.log(`  Total Files Scanned: ${scanResult.summary.totalFiles}`)
    console.log(`  Total Experts Found: ${scanResult.summary.totalExperts}`)
    console.log(`  With Telemetry: ${scanResult.summary.withTelemetry} ✅`)
    console.log(`  Without Telemetry: ${scanResult.summary.withoutTelemetry} ⚠️`)
    console.log()
    console.log('  By Language:')
    for (const [lang, count] of Object.entries(scanResult.summary.byLanguage)) {
      console.log(`    ${lang}: ${count}`)
    }
    console.log()
    console.log('  By Type:')
    for (const [type, count] of Object.entries(scanResult.summary.byType)) {
      console.log(`    ${type}: ${count}`)
    }
    
    // Enhanced explanation of findings
    console.log('\n' + '-'.repeat(80))
    console.log('\n💡 WHAT THIS MEANS')
    console.log('-'.repeat(80))
    
    const aiCount = scanResult.summary.byType['ai_function'] || 0
    const dspyCount = scanResult.summary.byType['dspy_signature'] || 0
    
    if (aiCount > 0 && dspyCount === 0) {
      console.log(`\n  📌 Found ${aiCount} AI functions but no DSPy signatures.`)
      console.log('     AI functions are detected by keywords (predict, generate, optimize, etc.)')
      console.log('     DSPy signatures require explicit class definitions extending dspy.Signature')
      console.log('\n  💡 RECOMMENDATION: Consider converting key AI functions to DSPy signatures')
      console.log('     for automatic prompt optimization. DSPy can improve accuracy by 10-30%.')
    } else if (dspyCount > 0 && aiCount > dspyCount) {
      console.log(`\n  📌 Found ${dspyCount} DSPy signature(s) and ${aiCount} AI functions.`)
      console.log('     Your project has some DSPy optimization but many functions could benefit.')
      console.log('\n  💡 RECOMMENDATION: Prioritize converting high-impact AI functions to DSPy.')
    } else if (dspyCount > 0) {
      console.log(`\n  ✅ Found ${dspyCount} DSPy signature(s) - your project is using prompt optimization!`)
    }
    
    // Telemetry recommendation
    if (missing.length > 0) {
      const telemetryPercent = ((scanResult.summary.withTelemetry / scanResult.summary.totalExperts) * 100).toFixed(0)
      console.log(`\n  📊 Telemetry Coverage: ${telemetryPercent}% (${scanResult.summary.withTelemetry}/${scanResult.summary.totalExperts})`)
      console.log(`\n  ⚠️  ${missing.length} expert(s) lack telemetry tracking.`)
      console.log('     Without telemetry, Iris cannot:')
      console.log('       • Track performance over time')
      console.log('       • Detect drift and degradation')
      console.log('       • Learn from successful patterns')
      console.log('       • Federate learnings across projects')
      console.log('\n  💡 RECOMMENDATION: Add telemetry to track expert performance.')
      console.log('     Run with --auto-instrument to add telemetry automatically, or')
      console.log('     answer "y" when prompted to instrument interactively.')
    }
    
    console.log('\n' + '='.repeat(80))

    if (missing.length === 0) {
      console.log('\n✅ All experts already have telemetry!')
      console.log('   Run `npx iris evaluate` to see performance metrics.\n')
      process.exit(0)
    }

    // STEP 5: Interactive approval or auto-instrument
    let shouldInstrument = options.autoInstrument || false

    if (options.interactive && !options.autoInstrument) {
      const decision = await cli.askInstrumentationApproval(missing)
      shouldInstrument = decision.approved
    }

    if (!shouldInstrument) {
      console.log('\n⏭️  Instrumentation skipped')

      if (options.outputJson) {
        fs.writeFileSync(options.outputJson, JSON.stringify(scanResult, null, 2))
        console.log(`\n💾 Results saved to: ${options.outputJson}`)
      }

      process.exit(0)
    }

    // STEP 6: Instrument experts
    console.log(`\n🔧 Instrumenting ${missing.length} expert(s)...`)

    const instrumenter = new CodeInstrumenter()
    let instrumentedCount = 0

    for (const expert of missing) {
      const fullPath = path.join(options.project, expert.filePath)

      try {
        const changes = await instrumenter.instrumentExpert({ ...expert, filePath: fullPath })

        if (options.dryRun) {
          console.log(`\n  [DRY RUN] Would modify: ${expert.filePath}`)
          console.log(`    Imports: ${changes.imports.length}`)
          console.log(`    Insertions: ${changes.insertions.length}`)
        } else {
          await instrumenter.applyChanges(changes)
          await storage.markInstrumented(expert.id, changes)
          instrumentedCount++
          console.log(`  ✅ ${expert.name} (${expert.filePath})`)
        }
      } catch (error) {
        console.error(`  ❌ Failed to instrument ${expert.name}: ${error}`)
      }
    }

    // STEP 7: Summary
    console.log('\n' + '='.repeat(80))
    if (options.dryRun) {
      console.log('✅ DRY RUN COMPLETE')
      console.log(`   Would instrument ${missing.length} expert(s)`)
    } else {
      console.log('✅ INSTRUMENTATION COMPLETE')
      console.log(`   Instrumented ${instrumentedCount}/${missing.length} expert(s)`)
    }
    console.log('='.repeat(80))

    if (!options.dryRun && instrumentedCount > 0) {
      console.log('\n🎯 Next Steps:')
      console.log('  1. Review the instrumented code')
      console.log('  2. Run your experts/tests')
      console.log('  3. Telemetry will be automatically collected')
      console.log('  4. Use `iris evaluate` to see performance')
    }

    // Export JSON if requested
    if (options.outputJson) {
      const output = {
        ...scanResult,
        instrumented: instrumentedCount,
        dryRun: options.dryRun
      }
      fs.writeFileSync(options.outputJson, JSON.stringify(output, null, 2))
      console.log(`\n💾 Results saved to: ${options.outputJson}`)
    }

    // Log to Supabase
    try {
      await logTelemetry({
        expertId: 'iris-discover-cli',
        version: '1.0.0',
        runId: randomUUID(),
        outcome: 'success',
        metadata: {
          eventType: 'IRIS_DISCOVER_CLI',
          projectPath: options.project,
          totalExperts: scanResult.summary.totalExperts,
          withTelemetry: scanResult.summary.withTelemetry,
          withoutTelemetry: scanResult.summary.withoutTelemetry,
          instrumented: instrumentedCount,
          dryRun: options.dryRun,
          durationMs: Date.now() - startTime
        }
      })
    } catch {
      // Ignore Supabase errors
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n⏱️  Completed in ${duration}s\n`)

    process.exit(0)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`\n❌ Error: ${errorMessage}\n`)

    // Log error to Supabase
    try {
      await logTelemetry({
        expertId: 'iris-discover-cli',
        version: '1.0.0',
        runId: randomUUID(),
        outcome: 'failure',
        metadata: {
          eventType: 'IRIS_DISCOVER_CLI_ERROR',
          error: errorMessage,
          durationMs: Date.now() - startTime
        }
      })
    } catch {
      // Ignore Supabase errors
    }

    process.exit(1)
  } finally {
    if (storage) {
      storage.close()
    }
  }
}

// Run if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMainModule) {
  main()
}

export { main as irisDiscover }
export default main
