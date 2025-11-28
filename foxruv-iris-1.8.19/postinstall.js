import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Install to project's .claude directory (where npm install was run)
const claudeDir = path.join(process.cwd(), '.claude');

const log = (msg) => console.info(`[iris postinstall] ${msg}`);
const warn = (msg) => console.warn(`[iris postinstall] ${msg}`);

function checkAgenticFlow() {
  try {
    execSync('npx agentic-flow --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkAgentDB() {
  try {
    execSync('npx agentdb --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkPython() {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkAxPlatform() {
  // Check global python first
  try {
    execSync('python3 -c "import ax"', { stdio: 'ignore' });
    return true;
  } catch {
    // Check .venv if exists
    try {
      execSync('.venv/bin/python3 -c "import ax"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

function checkDSPy() {
  // Check global python first
  try {
    execSync('python3 -c "import dspy"', { stdio: 'ignore' });
    return true;
  } catch {
    // Check .venv if exists
    try {
      execSync('.venv/bin/python3 -c "import dspy"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

async function cleanupOldFiles() {
  // Remove old flat file locations (pre-1.8.4)
  const oldFiles = [
    path.join(claudeDir, 'agents', 'iris.md'),
    path.join(claudeDir, 'agents', 'council.md'),
    path.join(claudeDir, 'skills', 'iris.md'),
  ];

  // Remove old directories entirely (pre-1.8.4 structures)
  const oldDirs = [
    path.join(claudeDir, 'agents', 'iris-expert'),  // Old agent folder with AGENT.md
  ];

  // Clean up old files
  for (const oldPath of oldFiles) {
    if (fs.existsSync(oldPath)) {
      try {
        await fs.promises.unlink(oldPath);
        log(`Cleaned up old file: ${oldPath}`);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
  }

  // Clean up old directories (recursive delete)
  for (const oldDir of oldDirs) {
    if (fs.existsSync(oldDir)) {
      try {
        await fs.promises.rm(oldDir, { recursive: true, force: true });
        log(`Cleaned up old directory: ${oldDir}`);
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
  }

  // Also check for old SKILL.md in skills/iris/ and clean if needed
  const oldSkillPath = path.join(claudeDir, 'skills', 'iris', 'SKILL.md');
  if (fs.existsSync(oldSkillPath)) {
    try {
      await fs.promises.unlink(oldSkillPath);
      log(`Cleaned up old file: ${oldSkillPath}`);
    } catch (err) {
      // Ignore errors during cleanup
    }
  }
}

async function installAssets() {
  if (!fs.existsSync(claudeDir)) {
    log('Project .claude directory not found; creating it...');
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // Clean up old file locations first
  await cleanupOldFiles();

  // 1. Install Skill (iris/iris.md)
  const skillSource = path.join(__dirname, 'skills', 'iris.md');
  const skillDest = path.join(claudeDir, 'skills', 'iris', 'iris.md');

  if (fs.existsSync(skillSource)) {
    await fs.promises.mkdir(path.dirname(skillDest), { recursive: true });
    await fs.promises.copyFile(skillSource, skillDest);
    log(`Installed Iris skill to ${skillDest}`);
  } else {
    warn('Skill template (skills/iris.md) missing, skipping skill installation.');
  }

  // 2. Install Agent (iris/iris.md)
  const agentSource = path.join(__dirname, 'agents', 'iris.md');
  const agentDest = path.join(claudeDir, 'agents', 'iris', 'iris.md');

  if (fs.existsSync(agentSource)) {
    await fs.promises.mkdir(path.dirname(agentDest), { recursive: true });
    await fs.promises.copyFile(agentSource, agentDest);
    log(`Installed Iris agent to ${agentDest}`);
  } else {
    warn('Agent template (agents/iris.md) missing, skipping agent installation.');
  }

  // 3. Install Council Agent (council/council.md)
  const councilSource = path.join(__dirname, 'agents', 'council.md');
  const councilDest = path.join(claudeDir, 'agents', 'council', 'council.md');

  if (fs.existsSync(councilSource)) {
    await fs.promises.mkdir(path.dirname(councilDest), { recursive: true });
    await fs.promises.copyFile(councilSource, councilDest);
    log(`Installed Council agent to ${councilDest}`);
  } else {
    warn('Council agent template (agents/council.md) missing, skipping.');
  }
}

async function main() {
  try {
    await installAssets();

    // Check for required dependencies
    const hasAgenticFlow = checkAgenticFlow();
    const hasAgentDB = checkAgentDB();
    const hasPython = checkPython();
    const hasAx = checkAxPlatform();
    const hasDSPy = checkDSPy();

    console.log('');
    log('Checking dependencies...');
    console.log('');

    // Node.js dependencies
    log('Node.js Dependencies:');
    if (!hasAgenticFlow) {
      warn('  ❌ agentic-flow not found');
      warn('     Install with: npm install agentic-flow');
    } else {
      log('  ✓ agentic-flow detected');
    }

    if (!hasAgentDB) {
      warn('  ❌ agentdb not found');
      warn('     Install with: npm install agentdb');
    } else {
      log('  ✓ agentdb detected');
    }

    console.log('');

    // Python dependencies (for advanced optimization)
    log('Python Dependencies (for Bayesian/DSPy optimization):');
    if (!hasPython) {
      warn('  ❌ Python 3 not found');
      warn('     Install Python 3.10+ for advanced optimization features');
      warn('     Without Python: Grid Search will be used (slower but works)');
    } else {
      log('  ✓ Python 3 detected');

      if (!hasAx) {
        warn('  ❌ ax-platform not installed');
        warn('     Install with: pip install ax-platform');
        warn('     Enables: Bayesian Optimization (352x faster than Grid Search)');
      } else {
        log('  ✓ ax-platform detected');
      }

      if (!hasDSPy) {
        warn('  ❌ dspy-ai not installed');
        warn('     Install with: pip install dspy-ai');
        warn('     Enables: Prompt Optimization (MIPROv2)');
      } else {
        log('  ✓ dspy-ai detected');
      }
    }

    // Show next steps
    if (process.stdout.isTTY) {
      console.log('');
      log('==================================================================');
      log('🚀 Iris Platform Installed!');
      console.log('');

      // Summary
      const nodeReady = hasAgenticFlow && hasAgentDB;
      const pythonReady = hasPython && hasAx && hasDSPy;

      if (nodeReady && pythonReady) {
        log('✅ All dependencies ready! (Node.js + Python)');
        log('   You have access to ALL optimization features:');
        log('   - Bayesian Optimization (Ax) - 352x faster');
        log('   - Prompt Optimization (DSPy/MIPROv2)');
        log('   - Grid Search (fallback)');
      } else if (nodeReady && !pythonReady) {
        log('✅ Node.js dependencies ready!');
        log('⚠️  Python dependencies missing (see above)');
        log('');
        log('   Current capabilities:');
        log('   - ✅ AgentDB pattern learning');
        log('   - ✅ Decision tracking');
        log('   - ✅ Grid Search optimization (slower)');
        log('');
        log('   To enable advanced optimization:');
        if (!hasPython) {
          log('   1. Install Python 3.10+');
        }
        if (hasPython && !hasAx) {
          log('   1. pip install ax-platform');
        }
        if (hasPython && !hasDSPy) {
          log('   2. pip install dspy-ai');
        }
      } else {
        log('⚠️  Missing dependencies detected (see warnings above)');
      }

      console.log('');
      log('Next steps:');
      log('  1. npx iris init --enhanced     # Activate Intelligence Platform');
      log('  2. npx iris discover            # Find & Classify Project Experts');
      log('  3. Add telemetry tracking       # Use withTelemetry() decorator');
      log('  4. npx iris telemetry status    # Monitor sync status');
      log('  5. npx iris evaluate            # Baseline Performance Check');
      console.log('');
      log('📊 Telemetry Architecture (AgentDB-First):');
      log('  ✅ AgentDB (local) - Primary store, guaranteed persistence');
      log('  ✅ Supabase (cloud) - Optional replica for federated learning');
      log('  📖 Dual-lane: All data local first, cloud sync optional');
      console.log('');
      log('🔧 Telemetry Commands:');
      log('  npx iris telemetry status    # Check sync status & health');
      log('  npx iris telemetry migrate   # Migrate historical AgentDB data');
      log('  npx iris telemetry sync      # Force sync queued events');
      console.log('');
      log('📦 Installed Files:');
      log('  - .claude/agents/iris/iris.md - Iris optimization guide');
      log('  - .claude/agents/council/council.md - AI Council (6-agent consensus)');
      log('  - .claude/skills/iris/iris.md - Comprehensive optimization skill');
      console.log('');
      log('🎯 Quick Start:');
      log('  Tell Claude: "Read .claude/agents/iris.md and help me optimize"');
      log('  Iris becomes your AI optimization guide - you just talk naturally!');
      console.log('');
      log('Documentation:');
      log('  - IRIS_QUICKSTART.md - Getting started guide');
      log('  - CREDENTIALS_GUIDE.md - What credentials you need (very few!)');
      console.log('');
      log('🚨 IMPORTANT: All telemetry stored locally first (AgentDB).');
      log('   Supabase sync is optional. Everything works offline!');
      log('==================================================================');
      console.log('');
    }
  } catch (error) {
    warn(`Postinstall warning: ${error.message}`);
  }
}

main();