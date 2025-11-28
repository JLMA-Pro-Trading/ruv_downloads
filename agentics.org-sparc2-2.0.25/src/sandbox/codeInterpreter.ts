/**
 * E2B Code Interpreter Implementation
 *
 * This module provides a secure sandbox for executing code using the E2B SDK.
 * It handles code execution, file operations, and package installation.
 */

import { logMessage } from "../logger.ts";

// Import the E2B SDK
import { Sandbox as E2BSandbox } from "npm:@e2b/code-interpreter";

// Re-export the Sandbox type for use in tests
export type Sandbox = E2BSandbox;

/**
 * Type definition for execution result
 */
export interface ExecutionResult {
  /** Output text from the execution */
  text: string;
  /** Any results or artifacts generated during execution */
  results: any[];
  /** Error information if execution failed */
  error?: {
    type: string;
    value: string;
  } | null;
  /** Logs from the execution */
  logs: {
    stdout: string[];
    stderr: string[];
  };
}

/**
 * Options for creating a code interpreter sandbox
 */
export interface CodeInterpreterOptions {
  /** Optional API key to use instead of the environment variable */
  apiKey?: string;
}

/**
 * Options for running code
 */
export interface RunCodeOptions {
  /** Whether to stream output */
  stream?: boolean;
  /** Language to use for execution */
  language?: "python" | "javascript" | "typescript";
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Create a new sandbox instance
 * @param options Options for the sandbox
 * @returns A promise that resolves to the sandbox instance
 */
export async function createSandbox(options: CodeInterpreterOptions = {}): Promise<Sandbox> {
  const apiKey = options.apiKey || Deno.env.get("E2B_API_KEY");
  if (!apiKey) {
    throw new Error("E2B_API_KEY is required either in options or as an environment variable");
  }

  try {
    // Create a new sandbox instance using the factory method
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    const sandbox = await E2BSandbox.create({ apiKey });
    await logMessage("info", "Created code interpreter sandbox");
    return sandbox;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", "Failed to create code interpreter sandbox", { error: errorMessage });
    throw error;
  }
}

/**
 * Execute code in the sandbox
 * @param code The code to execute
 * @param options Options for execution
 * @returns The execution result
 */
export async function executeCode(
  code: string,
  options: {
    stream?: boolean;
    language?: "python" | "javascript" | "typescript";
    timeout?: number;
  } = {},
): Promise<ExecutionResult> {
  const sandbox = await createSandbox();

  try {
    // Prepare the code based on the language
    let preparedCode = code;
    const language = options.language || "python";

    if (language === "typescript" && !code.includes("///@ts-nocheck")) {
      // Add ts-nocheck to avoid TypeScript errors in the sandbox
      preparedCode = "///@ts-nocheck\n" + code;
    }

    if (
      language === "python" && !code.trim().startsWith("!pip") && !code.trim().startsWith("import")
    ) {
      // For Python, ensure basic imports are available
      preparedCode = "import sys\nimport os\n" + preparedCode;
    }

    // Set up execution options
    const execOptions: any = {
      language,
    };

    if (options.stream) {
      execOptions.onStdout = (data: any) => console.log("[stdout]", data);
      execOptions.onStderr = (data: any) => console.error("[stderr]", data);
    }

    // Execute the code with timeout
    let execution: any;
    if (options.timeout) {
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Execution timed out after ${options.timeout}ms`)),
          options.timeout,
        );
      });

      // Race the execution against the timeout
      // @ts-ignore - Ignore TypeScript errors for API compatibility
      execution = await Promise.race([
        sandbox.runCode(preparedCode, execOptions),
        timeoutPromise,
      ]);
    } else {
      // @ts-ignore - Ignore TypeScript errors for API compatibility
      execution = await sandbox.runCode(preparedCode, execOptions);
    }

    // Format the result to match our ExecutionResult interface
    const result: ExecutionResult = {
      text: execution.text || "",
      results: execution.results || [],
      error: execution.error
        ? {
          type: "error",
          value: typeof execution.error === "string"
            ? execution.error
            : JSON.stringify(execution.error),
        }
        : null,
      logs: {
        stdout: Array.isArray(execution.logs?.stdout)
          ? execution.logs.stdout
          : (execution.logs?.stdout ? [execution.logs.stdout] : []),
        stderr: Array.isArray(execution.logs?.stderr)
          ? execution.logs.stderr
          : (execution.logs?.stderr ? [execution.logs.stderr] : []),
      },
    };

    // Log the execution result
    const isError = result.error !== null && result.error !== undefined;
    await logMessage(
      isError ? "error" : "info",
      `Code execution ${isError ? "failed" : "completed"}`,
      {
        error: isError && result.error ? result.error.value : undefined,
        outputLength: result.text.length,
        resultsCount: result.results.length,
      },
    );

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", "Code execution failed", { error: errorMessage });

    // Return an error result
    return {
      text: "",
      results: [],
      error: {
        type: "error",
        value: errorMessage,
      },
      logs: {
        stdout: [],
        stderr: [errorMessage],
      },
    };
  } finally {
    // Always close the sandbox to free resources
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    await sandbox.kill();
  }
}

/**
 * Execute code from a file
 * @param filePath Path to the file to execute
 * @param options Options for execution
 * @returns The execution result
 */
export async function executeFile(
  filePath: string,
  options: {
    stream?: boolean;
    language?: "python" | "javascript" | "typescript";
    timeout?: number;
  } = {},
): Promise<ExecutionResult> {
  try {
    // Read the file content
    const content = await Deno.readTextFile(filePath);

    // Determine language from file extension if not specified
    if (!options.language) {
      const extension = filePath.split(".").pop()?.toLowerCase();
      if (extension === "py") {
        options.language = "python";
      } else if (extension === "js") {
        options.language = "javascript";
      } else if (extension === "ts") {
        options.language = "typescript";
      }
    }

    // Execute the file content
    return await executeCode(content, options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", `Failed to execute file: ${filePath}`, { error: errorMessage });

    // Return an error result
    return {
      text: "",
      results: [],
      error: {
        type: "error",
        value: errorMessage,
      },
      logs: {
        stdout: [],
        stderr: [errorMessage],
      },
    };
  }
}

/**
 * Write a file in the sandbox
 * @param path Path in the sandbox
 * @param content Content to write
 * @param options Options for the sandbox
 */
export async function writeFile(
  path: string,
  content: string,
  options: CodeInterpreterOptions = {},
  existingSandbox?: Sandbox,
): Promise<void> {
  const sandbox = existingSandbox || await createSandbox(options);

  try {
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    await sandbox.files.write(path, content);
    await logMessage("info", `File written to sandbox: ${path}`, { contentLength: content.length });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", `Failed to write file to sandbox: ${path}`, { error: errorMessage });
    throw error;
  } finally {
    if (!existingSandbox) {
      // @ts-ignore - Ignore TypeScript errors for API compatibility
      await sandbox.kill();
    }
  }
}

/**
 * Read a file from the sandbox
 * @param path Path in the sandbox
 * @param options Options for the sandbox
 * @returns The file content
 */
export async function readFile(
  path: string,
  options: CodeInterpreterOptions = {},
  existingSandbox?: Sandbox,
): Promise<string> {
  const sandbox = existingSandbox || await createSandbox(options);

  try {
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    const content = await sandbox.files.read(path);
    await logMessage("info", `File read from sandbox: ${path}`, { contentLength: content.length });
    return content;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", `Failed to read file from sandbox: ${path}`, { error: errorMessage });
    throw error;
  } finally {
    if (!existingSandbox) {
      // @ts-ignore - Ignore TypeScript errors for API compatibility
      await sandbox.kill();
    }
  }
}

/**
 * List files in the sandbox
 * @param path Path in the sandbox
 * @param options Options for the sandbox
 * @returns Array of file names
 */
export async function listFiles(
  path: string,
  options: CodeInterpreterOptions = {},
  existingSandbox?: Sandbox,
): Promise<string[]> {
  const sandbox = existingSandbox || await createSandbox(options);

  try {
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    const entries = await sandbox.files.list(path);
    const files = entries.map((entry: any) => entry.name || entry.path || String(entry));
    await logMessage("info", `Listed files in sandbox: ${path}`, { fileCount: entries.length });
    return files;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", `Failed to list files in sandbox: ${path}`, { error: errorMessage });
    throw error;
  } finally {
    if (!existingSandbox) {
      // @ts-ignore - Ignore TypeScript errors for API compatibility
      await sandbox.kill();
    }
  }
}

/**
 * Install packages in the sandbox
 * @param packages Array of packages to install
 * @param language The language for which to install packages
 * @param options Options for the sandbox
 * @returns The execution result
 */
export async function installPackages(
  packages: string[],
  language: "python" | "javascript" | "typescript" = "python",
  options: CodeInterpreterOptions = {},
): Promise<ExecutionResult> {
  const sandbox = await createSandbox(options);

  try {
    let installCommand: string;

    if (language === "python") {
      installCommand = `!pip install ${packages.join(" ")}`; // Python uses !pip install
    } else if (language === "javascript" || language === "typescript") {
      installCommand = `const { execSync } = require('child_process'); 
try {
  console.log('Installing packages: ${packages.join(", ")}');
  execSync('npm install ${packages.join(" ")}', { stdio: 'inherit' });
  console.log('Packages installed successfully');
} catch (error) {
  console.error('Failed to install packages:', error.message);
}`;
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }

    // @ts-ignore - Ignore TypeScript errors for API compatibility
    const execution = await sandbox.runCode(installCommand, {
      language,
      onStdout: (data: any) => console.log("[stdout]", data),
      onStderr: (data: any) => console.error("[stderr]", data),
    });

    // Format the result to match our ExecutionResult interface
    const result: ExecutionResult = {
      text: execution.text || "",
      results: execution.results || [],
      error: execution.error
        ? {
          type: "error",
          value: typeof execution.error === "string"
            ? execution.error
            : JSON.stringify(execution.error),
        }
        : null,
      logs: {
        stdout: Array.isArray(execution.logs?.stdout)
          ? execution.logs.stdout
          : (execution.logs?.stdout ? [execution.logs.stdout] : []),
        stderr: Array.isArray(execution.logs?.stderr)
          ? execution.logs.stderr
          : (execution.logs?.stderr ? [execution.logs.stderr] : []),
      },
    };

    const isError = result.error !== null && result.error !== undefined;
    await logMessage(
      isError ? "error" : "info",
      `Package installation ${isError ? "failed" : "completed"}`,
      {
        packages,
        language,
        error: isError && result.error ? result.error.value : undefined,
      },
    );

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", "Package installation failed", {
      error: errorMessage,
      packages,
      language,
    });

    // Return an error result
    return {
      text: "",
      results: [],
      error: {
        type: "error",
        value: errorMessage,
      },
      logs: {
        stdout: [],
        stderr: [errorMessage],
      },
    };
  } finally {
    // @ts-ignore - Ignore TypeScript errors for API compatibility
    await sandbox.kill();
  }
}
