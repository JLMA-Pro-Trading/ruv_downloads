/**
 * Agent module for SPARC 2.0
 * Provides the main agent functionality for analyzing and modifying code
 */

import OpenAI from "npm:openai";
import { logDebug, logError, logInfo } from "../logger.ts";
import { applyDiff, computeDiff } from "../diff/diffTracker.ts";
import {
  createCheckpoint,
  createCommit,
  getCurrentBranch,
  isRepoClean,
  rollbackChanges,
} from "../git/gitIntegration.ts";
import { executeCode } from "../sandbox/codeInterpreter.ts";
import { indexDiffEntry } from "../vector/vectorStore.ts";

/**
 * File to process interface
 */
export interface FileToProcess {
  /** Path to the file */
  path: string;
  /** Original content of the file */
  originalContent: string;
}

/**
 * Agent options
 */
export interface AgentOptions {
  /** Model to use for the agent */
  model?: string;
  /** Mode for the agent (automatic, semi, manual, custom) */
  mode?: "automatic" | "semi" | "manual" | "custom" | "interactive";
  /** Diff mode (file, function) */
  diffMode?: "file" | "function";
  /** Processing mode (sequential, parallel, concurrent, swarm) */
  processing?: "sequential" | "parallel" | "concurrent" | "swarm";
  /** Path to the agent configuration file */
  configPath?: string;
}

/**
 * Result of a modification operation
 */
export interface ModificationResult {
  /** Path to the file */
  path: string;
  /** Original content of the file */
  originalContent: string;
  /** Modified content of the file */
  modifiedContent: string;
  /** Commit hash if changes were committed */
  commitHash?: string;
}

/**
 * SPARC 2.0 Agent class
 * Provides methods for analyzing and modifying code
 */
export class SPARC2Agent {
  private openai!: OpenAI; // Using definite assignment assertion
  private model: string;
  private mode: "automatic" | "semi" | "manual" | "custom" | "interactive";
  private diffMode: "file" | "function";
  private processing: "sequential" | "parallel" | "concurrent" | "swarm";

  /**
   * Create a new SPARC 2.0 Agent
   * @param options Agent options
   */
  constructor(options: AgentOptions = {}) {
    this.model = options.model || "gpt-4o";
    this.mode = options.mode || "automatic";
    this.diffMode = options.diffMode || "file";
    this.processing = options.processing || "sequential";
  }

  /**
   * Initialize the agent
   */
  async init(): Promise<void> {
    // Initialize OpenAI client
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }

    this.openai = new OpenAI({
      apiKey,
    });

    await logInfo("SPARC2 Agent initialized", {
      model: this.model,
      mode: this.mode,
      diffMode: this.diffMode,
      processing: this.processing,
    });
  }

  /**
   * Analyze and compute diff between two versions of code
   * @param path Path to the file
   * @param oldContent Previous version of code
   * @param newContent New version of code
   * @returns Diff text
   */
  async analyzeAndDiff(path: string, oldContent: string, newContent: string): Promise<string> {
    // Compute diff
    const diff = computeDiff(oldContent, newContent, this.diffMode);

    // If there are no changes, return empty string
    if (diff.changedLines === 0) {
      await logInfo(`No changes detected for ${path}`);
      return "";
    }

    // Log diff
    await logInfo(`Computed diff for ${path}`, {
      changedLines: diff.changedLines,
      diffMode: this.diffMode,
    });

    // Index diff for later search
    await indexDiffEntry({
      id: new Date().toISOString(),
      file: path,
      diff: diff.diffText,
      metadata: {
        changedLines: diff.changedLines,
        diffMode: this.diffMode,
        timestamp: new Date().toISOString(),
      },
    });

    return diff.diffText;
  }

  /**
   * Apply changes to a file and commit them
   * @param path Path to the file
   * @param message Commit message
   * @returns Commit hash
   */
  async applyChanges(path: string, message: string): Promise<string> {
    // Get current branch
    const branch = await getCurrentBranch();

    // Create commit
    const commitHash = await createCommit(branch, path, message);

    await logInfo(`Applied changes to ${path}`, {
      branch,
      commitHash,
    });

    return commitHash;
  }

  /**
   * Create a checkpoint
   * @param name Name of the checkpoint
   * @returns Checkpoint hash
   */
  async createCheckpoint(name: string): Promise<string> {
    const hash = await createCheckpoint(name);

    await logInfo(`Created checkpoint: ${name}`, {
      hash,
    });

    return hash;
  }

  /**
   * Rollback changes
   * @param target Target to rollback to (commit hash, branch, etc.)
   * @param type Type of rollback (checkpoint, temporal)
   */
  async rollback(target: string, type: "checkpoint" | "temporal"): Promise<void> {
    await rollbackChanges(target, type);

    await logInfo(`Rolled back to ${type}: ${target}`);
  }

  /**
   * Check if the repository is clean
   * @returns True if the repository is clean
   */
  async isRepoClean(): Promise<boolean> {
    return isRepoClean();
  }

  /**
   * Plan and execute a task
   * @param task Task description
   * @param files Files to process
   * @returns Results of the modifications
   */
  async planAndExecute(task: string, files: FileToProcess[]): Promise<ModificationResult[]> {
    // Check if repo is clean
    const clean = await this.isRepoClean();
    if (!clean) {
      await logInfo("Repository is not clean, creating checkpoint");
      // Sanitize the task name for Git tag (max 50 chars, alphanumeric and hyphens only)
      const sanitizedTask = task.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().substring(0, 50);
      // Note: A timestamp will be automatically added by the createCheckpoint function to ensure uniqueness
      await this.createCheckpoint(`pre-${sanitizedTask}`);
    }

    // Log task
    await logInfo(`Planning and executing task: ${task}`, {
      files: files.map((f) => f.path),
      mode: this.mode,
      diffMode: this.diffMode,
      processing: this.processing,
    });

    // Create prompt
    const prompt = this.createPrompt(task, files);

    // Call OpenAI API
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant that analyzes code and suggests improvements. Provide your analysis and improvements in a structured format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    // Extract response
    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("No response from OpenAI API");
    }

    // Process response
    const results = await this.processResponse(response, files);

    // Log results
    await logInfo(`Completed task: ${task}`, {
      files: results.map((r) => r.path),
      changedFiles: results.filter((r) => r.originalContent !== r.modifiedContent).length,
    });

    return results;
  }

  /**
   * Create a prompt for the OpenAI API
   * @param task Task description
   * @param files Files to process
   * @returns Prompt text
   */
  private createPrompt(task: string, files: FileToProcess[]): string {
    let prompt = `Task: ${task}\n\n`;
    prompt += "Files to analyze and modify:\n\n";

    for (const file of files) {
      prompt += `File: ${file.path}\n\`\`\`\n${file.originalContent}\n\`\`\`\n\n`;
    }

    prompt +=
      "Please analyze the code and suggest improvements. For each file you want to modify, provide the full updated code in the following format:\n\n";
    prompt += "Analysis:\n[Your analysis here]\n\n";
    prompt += "Plan:\n[Your plan here]\n\n";
    prompt += "File: [file path]\n```[language]\n[full updated code]\n```\n";

    return prompt;
  }

  /**
   * Process the response from the OpenAI API
   * @param response Response text
   * @param files Files that were processed
   * @returns Results of the modifications
   */
  private async processResponse(
    response: string,
    files: FileToProcess[],
  ): Promise<ModificationResult[]> {
    const results: ModificationResult[] = [];

    // Create a map of file paths to their original content
    const fileMap = new Map<string, string>();
    for (const file of files) {
      fileMap.set(file.path, file.originalContent);
    }

    // Extract code blocks from the response
    const codeBlockRegex = /File: ([^\n]+)\n```(?:[^\n]+)?\n([\s\S]*?)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, path, code] = match;
      const trimmedPath = path.trim();

      // Check if the file exists in the input files
      if (!fileMap.has(trimmedPath)) {
        await logWarn(`File not found in input: ${trimmedPath}`);
        continue;
      }

      const originalContent = fileMap.get(trimmedPath)!;
      const modifiedContent = code.trim();

      // Compute diff
      const diff = await this.analyzeAndDiff(trimmedPath, originalContent, modifiedContent);

      // If there are changes, write the file and commit
      if (diff) {
        // Write the file
        await Deno.writeTextFile(trimmedPath, modifiedContent);

        // Commit the changes
        const commitHash = await this.applyChanges(
          trimmedPath,
          `SPARC2: Updated ${trimmedPath}`,
        );

        // Add to results
        results.push({
          path: trimmedPath,
          originalContent,
          modifiedContent,
          commitHash,
        });
      } else {
        // No changes, just add to results
        results.push({
          path: trimmedPath,
          originalContent,
          modifiedContent: originalContent,
        });
      }
    }

    return results;
  }

  /**
   * Execute code in a sandbox
   * @param code Code to execute
   * @param options Execution options
   * @returns Execution result
   */
  async executeCode(
    code: string,
    options?: "python" | "javascript" | "typescript" | {
      language?: "python" | "javascript" | "typescript";
      stream?: boolean;
    },
  ) {
    let language: "python" | "javascript" | "typescript" = "javascript";
    let stream = true;

    if (typeof options === "string") {
      language = options;
    } else if (options && typeof options === "object") {
      language = options.language || language;
      stream = options.stream !== undefined ? options.stream : stream;
    }

    await logInfo(`Executing code`, { language, codeLength: code.length });

    return executeCode(code, { language, stream });
  }
}

/**
 * Log a warning message
 * @param message Message to log
 * @param metadata Additional metadata
 */
async function logWarn(message: string, metadata: Record<string, unknown> = {}) {
  await logDebug(message, metadata);
}
