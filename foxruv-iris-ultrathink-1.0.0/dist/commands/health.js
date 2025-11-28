import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';

// src/cli/commands/health.ts
var healthCommand = new Command("health").alias("check").description("Check health of MCP servers and configuration").option("-c, --config <path>", "Configuration file", "./ultrathink.config.json").option("--verbose", "Show detailed information").action(async (options) => {
  console.log(chalk.cyan("\n=== Ultrathink Health Check ===\n"));
  const checks = {
    config: false,
    node: false,
    dependencies: false,
    servers: false
  };
  const configSpinner = ora("Checking configuration...").start();
  try {
    const configPath = resolve(options.config);
    if (existsSync(configPath)) {
      const config = JSON.parse(await readFile(configPath, "utf-8"));
      if (config.wrappers && Array.isArray(config.wrappers)) {
        checks.config = true;
        configSpinner.succeed(chalk.green(`Configuration OK (${config.wrappers.length} wrappers)`));
        if (options.verbose) {
          config.wrappers.forEach((w) => {
            console.log(chalk.gray(`  - ${w.name} (${w.enabled ? "enabled" : "disabled"})`));
          });
        }
      } else {
        configSpinner.warn("Configuration exists but has no wrappers");
      }
    } else {
      configSpinner.fail("Configuration file not found");
      console.log(chalk.gray(`  Run: ultrathink init`));
    }
  } catch (error) {
    configSpinner.fail("Invalid configuration");
    if (options.verbose) {
      console.error(chalk.red("  Error:"), error);
    }
  }
  const nodeSpinner = ora("Checking Node.js version...").start();
  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0]);
    if (major >= 18) {
      checks.node = true;
      nodeSpinner.succeed(chalk.green(`Node.js ${nodeVersion}`));
    } else {
      nodeSpinner.fail(`Node.js ${nodeVersion} (>= 18.0.0 required)`);
    }
  } catch (error) {
    nodeSpinner.fail("Could not determine Node.js version");
  }
  const depsSpinner = ora("Checking dependencies...").start();
  try {
    const packagePath = resolve(process.cwd(), "package.json");
    if (existsSync(packagePath)) {
      const pkg = JSON.parse(await readFile(packagePath, "utf-8"));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
      checks.dependencies = true;
      depsSpinner.succeed(chalk.green(`Dependencies OK (${deps} packages)`));
    } else {
      depsSpinner.warn("No package.json found");
    }
  } catch (error) {
    depsSpinner.fail("Could not check dependencies");
  }
  const serversSpinner = ora("Checking MCP servers...").start();
  try {
    const configPath = resolve(options.config);
    if (existsSync(configPath)) {
      const config = JSON.parse(await readFile(configPath, "utf-8"));
      const wrappers = config.wrappers || [];
      let healthyServers = 0;
      for (const wrapper of wrappers.filter((w) => w.enabled !== false)) {
        const isHealthy = await checkServerHealth(wrapper);
        if (isHealthy) {
          healthyServers++;
          if (options.verbose) {
            console.log(chalk.gray(`  \u2713 ${wrapper.name}`));
          }
        } else {
          if (options.verbose) {
            console.log(chalk.gray(`  \u2717 ${wrapper.name}`));
          }
        }
      }
      if (healthyServers === wrappers.length) {
        checks.servers = true;
        serversSpinner.succeed(chalk.green(`All servers healthy (${healthyServers}/${wrappers.length})`));
      } else {
        serversSpinner.warn(`Some servers unhealthy (${healthyServers}/${wrappers.length})`);
      }
    } else {
      serversSpinner.info("No configuration to check");
    }
  } catch (error) {
    serversSpinner.fail("Could not check servers");
    if (options.verbose) {
      console.error(chalk.red("  Error:"), error);
    }
  }
  console.log(chalk.cyan("\n=== Summary ===\n"));
  const allHealthy = Object.values(checks).every((v) => v);
  const healthyCount = Object.values(checks).filter((v) => v).length;
  if (allHealthy) {
    console.log(chalk.green(`\u2713 All checks passed (${healthyCount}/${Object.keys(checks).length})
`));
    process.exit(0);
  } else {
    console.log(chalk.yellow(`\u26A0 Some checks failed (${healthyCount}/${Object.keys(checks).length})
`));
    process.exit(1);
  }
});
async function checkServerHealth(wrapper) {
  return new Promise((resolve2) => {
    try {
      const proc = spawn(wrapper.command, wrapper.args || [], {
        env: { ...process.env, ...wrapper.env },
        stdio: ["pipe", "pipe", "pipe"]
      });
      let responded = false;
      const timeout = setTimeout(() => {
        if (!responded) {
          proc.kill();
          resolve2(false);
        }
      }, 5e3);
      proc.stdout.on("data", () => {
        responded = true;
        clearTimeout(timeout);
        proc.kill();
        resolve2(true);
      });
      proc.on("error", () => {
        clearTimeout(timeout);
        resolve2(false);
      });
      proc.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "ultrathink", version: "0.1.0" }
        }
      }) + "\n");
    } catch (error) {
      resolve2(false);
    }
  });
}

export { healthCommand };
//# sourceMappingURL=health.js.map
//# sourceMappingURL=health.js.map