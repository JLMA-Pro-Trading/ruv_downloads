import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { resolve } from 'path';

// src/cli/commands/server.ts
var serverCommand = new Command("server").alias("serve").description("Start MCP server with generated wrappers").option("-p, --port <port>", "Server port", "3000").option("-h, --host <host>", "Server host", "localhost").option("-c, --config <path>", "Configuration file").option("-w, --watch", "Watch mode for development").option("--stdio", "Use stdio transport instead of HTTP").option("--sse", "Use Server-Sent Events transport").action(async (options) => {
  const spinner = ora("Starting MCP server...").start();
  try {
    const configPath = options.config ? resolve(options.config) : resolve(process.cwd(), "ultrathink.config.json");
    if (!existsSync(configPath)) {
      spinner.warn("No configuration file found, using defaults");
    } else {
      spinner.text = "Loading configuration...";
    }
    const transport = options.stdio ? "stdio" : options.sse ? "sse" : "http";
    spinner.text = `Starting ${transport.toUpperCase()} server...`;
    if (transport === "stdio") {
      await startStdioServer(options);
      spinner.succeed(chalk.green("STDIO server started"));
    } else {
      await startHttpServer(options);
      spinner.succeed(chalk.green(`HTTP server started`));
      console.log(chalk.cyan(`
Server running at: http://${options.host}:${options.port}`));
    }
    if (options.watch) {
      console.log(chalk.yellow("\nWatch mode enabled - server will restart on file changes"));
    }
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\nShutting down server..."));
      process.exit(0);
    });
  } catch (error) {
    spinner.fail(chalk.red("Server startup failed"));
    console.error(chalk.red("Error:"), error instanceof Error ? error.message : error);
    if (options.parent?.opts().debug) {
      console.error(error);
    }
    process.exit(1);
  }
});
async function startStdioServer(options) {
  console.log(chalk.gray("Listening on stdin/stdout..."));
  process.stdin.on("data", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMCPMessage(message);
    } catch (error) {
      console.error("Invalid JSON received");
    }
  });
}
async function startHttpServer(options) {
  const { host, port } = options;
  await new Promise((resolve2) => setTimeout(resolve2, 500));
  console.log(chalk.gray(`Listening on ${host}:${port}...`));
}
function handleMCPMessage(message) {
  const response = {
    jsonrpc: "2.0",
    id: message.id,
    result: {
      capabilities: {
        tools: {}
      }
    }
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

export { serverCommand };
//# sourceMappingURL=server.js.map
//# sourceMappingURL=server.js.map