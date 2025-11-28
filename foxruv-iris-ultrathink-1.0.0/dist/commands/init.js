import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import enquirer from 'enquirer';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

// src/cli/commands/init.ts
var { prompt } = enquirer;
var initCommand = new Command("init").description("Initialize ultrathink configuration").option("-f, --force", "Overwrite existing configuration").option("--skip-prompts", "Skip interactive prompts, use defaults").action(async (options) => {
  const spinner = ora("Initializing ultrathink...").start();
  try {
    const configPath = resolve(process.cwd(), "ultrathink.config.json");
    if (existsSync(configPath) && !options.force) {
      spinner.fail("Configuration file already exists");
      console.log(chalk.yellow("\nUse --force to overwrite existing configuration"));
      process.exit(1);
    }
    spinner.stop();
    let config;
    if (options.skipPrompts) {
      config = getDefaultConfig();
    } else {
      config = await promptForConfig();
    }
    spinner.start("Creating configuration file...");
    if (config.output) {
      await mkdir(resolve(process.cwd(), config.output), { recursive: true });
    }
    await writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
    const gitignorePath = resolve(process.cwd(), ".gitignore");
    if (!existsSync(gitignorePath)) {
      await writeFile(
        gitignorePath,
        "node_modules/\ndist/\n*.log\n.env\n",
        "utf-8"
      );
    }
    const envExamplePath = resolve(process.cwd(), ".env.example");
    await writeFile(
      envExamplePath,
      "# Ultrathink environment variables\n# Copy to .env and fill in your values\n\n# API Keys\n# API_KEY=your_api_key_here\n",
      "utf-8"
    );
    spinner.succeed(chalk.green("Initialization complete!"));
    console.log(chalk.cyan("\nConfiguration created:"));
    console.log(chalk.gray(`  ${configPath}`));
    console.log(chalk.gray(`  ${envExamplePath}`));
    console.log(chalk.cyan("\nNext steps:"));
    console.log(chalk.gray("  1. Copy .env.example to .env and configure"));
    console.log(chalk.gray("  2. Run: ultrathink generate <spec>"));
    console.log(chalk.gray("  3. Run: ultrathink server"));
  } catch (error) {
    spinner.fail(chalk.red("Initialization failed"));
    console.error(chalk.red("Error:"), error instanceof Error ? error.message : error);
    if (options.parent?.opts().debug) {
      console.error(error);
    }
    process.exit(1);
  }
});
async function promptForConfig() {
  console.log(chalk.cyan("\nUltrathink Configuration Setup\n"));
  const answers = await prompt([
    {
      type: "input",
      name: "projectName",
      message: "Project name:",
      initial: "my-ultrathink-project"
    },
    {
      type: "input",
      name: "output",
      message: "Output directory for generated code:",
      initial: "./src/generated"
    },
    {
      type: "confirm",
      name: "generateTypes",
      message: "Generate TypeScript types?",
      initial: true
    },
    {
      type: "confirm",
      name: "validation",
      message: "Enable input validation?",
      initial: true
    },
    {
      type: "select",
      name: "transport",
      message: "Default transport:",
      choices: ["stdio", "http", "sse"],
      initial: 0
    }
  ]);
  return {
    name: answers.projectName,
    version: "0.1.0",
    output: answers.output,
    generation: {
      types: answers.generateTypes,
      validation: answers.validation,
      experimental: false
    },
    server: {
      transport: answers.transport,
      port: 3e3,
      host: "localhost"
    },
    wrappers: []
  };
}
function getDefaultConfig() {
  return {
    name: "my-ultrathink-project",
    version: "0.1.0",
    output: "./src/generated",
    generation: {
      types: true,
      validation: true,
      experimental: false
    },
    server: {
      transport: "stdio",
      port: 3e3,
      host: "localhost"
    },
    wrappers: []
  };
}

export { initCommand };
//# sourceMappingURL=init.js.map
//# sourceMappingURL=init.js.map