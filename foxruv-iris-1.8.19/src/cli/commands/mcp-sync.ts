/**
 * foxruv-agent mcp sync-index - Synchronize skill index
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { updateIndexMd } from '../templates/index-md.js';

export async function runMcpSync(projectRoot: string): Promise<void> {
  const skillsDir = path.join(projectRoot, 'mcp-skills');

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    console.log(chalk.yellow('\n⚠️  mcp-skills/ directory not found. Run `npx iris init` first.\n'));
    return;
  }

  const spinner = ora('Scanning skill files...').start();

  try {
    // Get all .md files except INDEX.md and _template.md
    const files = await fs.readdir(skillsDir);
    const skillFiles = files.filter(f =>
      f.endsWith('.md') &&
      f !== 'INDEX.md' &&
      !f.startsWith('_')
    );

    const skillIds = skillFiles.map(f => path.basename(f, '.md'));
    spinner.succeed(`Found ${skillIds.length} skill file(s)`);

    // Update INDEX.md
    const updateSpinner = ora('Updating INDEX.md...').start();
    const indexPath = path.join(skillsDir, 'INDEX.md');
    await updateIndexMd(indexPath, skillIds);
    updateSpinner.succeed('INDEX.md synchronized');

    console.log(chalk.blue('\n📋 Skills in index:'));
    skillIds.forEach(id => console.log(chalk.gray(`  • ${id}`)));
    console.log();

  } catch (error) {
    spinner.fail('Sync failed');
    throw error;
  }
}
