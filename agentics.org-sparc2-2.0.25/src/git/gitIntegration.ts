/**
 * GitIntegration module for SPARC 2.0
 * Provides functions to interact with Git and GitHub for autonomous diff-based code editing
 */

import { logMessage } from "../logger.ts";

/**
 * Options for creating a commit
 */
export interface CommitOptions {
  /** Whether to push the commit to the remote repository */
  push?: boolean;
  /** The remote repository to push to */
  remote?: string;
  /** Additional commit options */
  options?: string[];
}

/**
 * Create a commit using Git CLI commands
 * @param branch Branch name
 * @param filePath File that was modified
 * @param commitMessage Commit message
 * @param options Additional options for the commit
 * @returns The commit hash
 */
export async function createCommit(
  branch: string,
  filePath: string | string[],
  commitMessage: string,
  options: CommitOptions = {},
): Promise<string> {
  // Convert filePath to array if it's a string
  const filePaths = Array.isArray(filePath) ? filePath : [filePath];

  // Stage the files
  for (const path of filePaths) {
    const addCmd = new Deno.Command("git", {
      args: ["add", path],
      stdout: "piped",
      stderr: "piped",
    });

    const addOutput = await addCmd.output();
    if (!addOutput.success) {
      const errorOutput = new TextDecoder().decode(addOutput.stderr);
      await logMessage("error", `Git add failed for ${path}: ${errorOutput}`, { path });
      throw new Error(`Git add failed for ${path}: ${errorOutput}`);
    }
  }

  // Create the commit
  const commitArgs = ["commit", "-m", commitMessage];

  // Add any additional options
  if (options.options) {
    commitArgs.push(...options.options);
  }

  const commitCmd = new Deno.Command("git", {
    args: commitArgs,
    stdout: "piped",
    stderr: "piped",
  });

  const commitOutput = await commitCmd.output();
  if (!commitOutput.success) {
    const errorOutput = new TextDecoder().decode(commitOutput.stderr);
    await logMessage("error", `Git commit failed: ${errorOutput}`, { branch, filePaths });
    throw new Error(`Git commit failed: ${errorOutput}`);
  }

  const commitText = new TextDecoder().decode(commitOutput.stdout);
  const commitHashMatch = commitText.match(/\[([^\]]+)\s+([a-f0-9]+)\]/);
  const commitHash = commitHashMatch ? commitHashMatch[2] : "";

  await logMessage("info", `Commit created for ${filePaths.join(", ")}`, {
    commitHash,
    output: commitText.trim(),
  });

  // Push the commit if requested
  if (options.push) {
    const remote = options.remote || "origin";
    const pushCmd = new Deno.Command("git", {
      args: ["push", remote, branch],
      stdout: "piped",
      stderr: "piped",
    });

    const pushOutput = await pushCmd.output();
    if (!pushOutput.success) {
      const errorOutput = new TextDecoder().decode(pushOutput.stderr);
      await logMessage("error", `Git push failed: ${errorOutput}`, { branch, remote });
      throw new Error(`Git push failed: ${errorOutput}`);
    }

    await logMessage("info", `Pushed commit to ${remote}/${branch}`, { commitHash });
  }

  return commitHash;
}

/**
 * Options for rolling back changes
 */
export interface RollbackOptions {
  /** Whether to create a new branch for the rollback */
  newBranch?: string;
  /** Whether to push the rollback to the remote repository */
  push?: boolean;
  /** The remote repository to push to */
  remote?: string;
}

/**
 * Roll back changes to a specific commit
 * @param commit Commit hash to roll back to
 * @param message Message for the rollback commit
 * @param options Additional options for the rollback
 * @returns The new commit hash
 */
export async function rollbackChanges(
  commit: string,
  message: string = `Rollback to ${commit}`,
  options: RollbackOptions = {},
): Promise<string> {
  // Check if the commit exists
  const revParseCmd = new Deno.Command("git", {
    args: ["rev-parse", "--verify", commit],
    stdout: "piped",
    stderr: "piped",
  });

  const revParseOutput = await revParseCmd.output();
  if (!revParseOutput.success) {
    const errorOutput = new TextDecoder().decode(revParseOutput.stderr);
    await logMessage("error", `Commit ${commit} not found: ${errorOutput}`, { commit });
    throw new Error(`Commit ${commit} not found: ${errorOutput}`);
  }

  // Create a new branch if requested
  if (options.newBranch) {
    const branchCmd = new Deno.Command("git", {
      args: ["checkout", "-b", options.newBranch],
      stdout: "piped",
      stderr: "piped",
    });

    const branchOutput = await branchCmd.output();
    if (!branchOutput.success) {
      const errorOutput = new TextDecoder().decode(branchOutput.stderr);
      await logMessage("error", `Creating new branch failed: ${errorOutput}`, {
        branch: options.newBranch,
      });
      throw new Error(`Creating new branch failed: ${errorOutput}`);
    }
  }

  // Reset to the specified commit
  const resetCmd = new Deno.Command("git", {
    args: ["reset", "--hard", commit],
    stdout: "piped",
    stderr: "piped",
  });

  const resetOutput = await resetCmd.output();
  if (!resetOutput.success) {
    const errorOutput = new TextDecoder().decode(resetOutput.stderr);
    await logMessage("error", `Git reset failed: ${errorOutput}`, { commit });
    throw new Error(`Git reset failed: ${errorOutput}`);
  }

  const resetText = new TextDecoder().decode(resetOutput.stdout);
  await logMessage("info", `Reset to commit ${commit}`, { output: resetText.trim() });

  // Push the changes if requested
  if (options.push) {
    const remote = options.remote || "origin";
    const branch = options.newBranch || await getCurrentBranch();

    const pushCmd = new Deno.Command("git", {
      args: ["push", "--force", remote, branch],
      stdout: "piped",
      stderr: "piped",
    });

    const pushOutput = await pushCmd.output();
    if (!pushOutput.success) {
      const errorOutput = new TextDecoder().decode(pushOutput.stderr);
      await logMessage("error", `Git push failed: ${errorOutput}`, { branch, remote });
      throw new Error(`Git push failed: ${errorOutput}`);
    }

    await logMessage("info", `Pushed rollback to ${remote}/${branch}`, { commit });
  }

  return commit;
}

/**
 * Options for reverting changes
 */
export interface RevertOptions {
  /** Whether to create a new branch for the revert */
  newBranch?: string;
  /** Whether to push the revert to the remote repository */
  push?: boolean;
  /** The remote repository to push to */
  remote?: string;
}

/**
 * Revert changes since a specific date
 * @param target Date or commit to revert to
 * @param options Additional options for the revert
 */
export async function revertChanges(
  target: string,
  options: RevertOptions = {},
): Promise<void> {
  // Check if the target is a valid date or commit
  try {
    // Try to parse as a date
    new Date(target);
  } catch (error) {
    // If not a date, check if it's a valid commit
    const revParseCmd = new Deno.Command("git", {
      args: ["rev-parse", "--verify", target],
      stdout: "piped",
      stderr: "piped",
    });

    const revParseOutput = await revParseCmd.output();
    if (!revParseOutput.success) {
      const errorOutput = new TextDecoder().decode(revParseOutput.stderr);
      await logMessage("error", `Invalid target: ${errorOutput}`, { target });
      throw new Error(`Invalid target: ${errorOutput}`);
    }
  }

  // Get commits since the target date
  const logCmd = new Deno.Command("git", {
    args: ["log", "--since", target, "--format=%H"],
    stdout: "piped",
    stderr: "piped",
  });

  const logOutput = await logCmd.output();
  if (!logOutput.success) {
    const errorOutput = new TextDecoder().decode(logOutput.stderr);
    await logMessage("error", `Git log failed: ${errorOutput}`, { target });
    throw new Error(`Git log failed: ${errorOutput}`);
  }

  const logText = new TextDecoder().decode(logOutput.stdout);

  const commits = logText.trim().split("\n").filter(Boolean);

  if (commits.length === 0) {
    await logMessage("info", `No commits found since ${target}`);
    return;
  }

  // Create a new branch if requested
  if (options.newBranch) {
    const branchCmd = new Deno.Command("git", {
      args: ["checkout", "-b", options.newBranch],
      stdout: "piped",
      stderr: "piped",
    });

    const branchOutput = await branchCmd.output();
    if (!branchOutput.success) {
      const errorOutput = new TextDecoder().decode(branchOutput.stderr);
      await logMessage("error", `Creating new branch failed: ${errorOutput}`, {
        branch: options.newBranch,
      });
      throw new Error(`Creating new branch failed: ${errorOutput}`);
    }
  }

  // Create a revert commit for each commit
  for (const commit of commits) {
    const revertCmd = new Deno.Command("git", {
      args: ["revert", "--no-edit", commit],
      stdout: "piped",
      stderr: "piped",
    });

    const revertOutput = await revertCmd.output();
    if (!revertOutput.success) {
      const errorOutput = new TextDecoder().decode(revertOutput.stderr);
      await logMessage("error", `Git revert failed for ${commit}: ${errorOutput}`, { commit });
      throw new Error(`Git revert failed for ${commit}: ${errorOutput}`);
    }
  }

  // Push the changes if requested
  if (options.push) {
    const remote = options.remote || "origin";
    const branch = options.newBranch || await getCurrentBranch();

    const pushCmd = new Deno.Command("git", {
      args: ["push", remote, branch],
      stdout: "piped",
      stderr: "piped",
    });

    const pushOutput = await pushCmd.output();
    if (!pushOutput.success) {
      const errorOutput = new TextDecoder().decode(pushOutput.stderr);
      await logMessage("error", `Git push failed: ${errorOutput}`, { branch, remote });
      throw new Error(`Git push failed: ${errorOutput}`);
    }
  }
}

/**
 * Create a checkpoint tag
 * @param name Name of the checkpoint
 * @returns The commit hash of the checkpoint
 */
export async function createCheckpoint(name: string): Promise<string> {
  // Add a timestamp to make the tag name unique
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uniqueName = `${name}-${timestamp}`;

  // Create a tag for the checkpoint
  const tagCmd = new Deno.Command("git", {
    args: ["tag", uniqueName],
    stdout: "piped",
    stderr: "piped",
  });

  const tagOutput = await tagCmd.output();
  if (!tagOutput.success) {
    const errorOutput = new TextDecoder().decode(tagOutput.stderr);
    await logMessage("error", `Creating checkpoint tag failed: ${errorOutput}`, {
      name: uniqueName,
    });
    throw new Error(`Creating checkpoint tag failed: ${errorOutput}`);
  }

  // Get the commit hash for the tag
  const revParseCmd = new Deno.Command("git", {
    args: ["rev-parse", uniqueName],
    stdout: "piped",
    stderr: "piped",
  });

  const revParseOutput = await revParseCmd.output();
  if (!revParseOutput.success) {
    const errorOutput = new TextDecoder().decode(revParseOutput.stderr);
    await logMessage("error", `Getting checkpoint commit hash failed: ${errorOutput}`, {
      name: uniqueName,
    });
    throw new Error(`Getting checkpoint commit hash failed: ${errorOutput}`);
  }

  const commitHash = new TextDecoder().decode(revParseOutput.stdout).trim();

  await logMessage("info", `Created checkpoint ${uniqueName} at commit ${commitHash}`);

  return commitHash;
}

/**
 * Get the current branch name
 * @returns The current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  if (!output.success) {
    const errorOutput = new TextDecoder().decode(output.stderr);
    await logMessage("error", `Getting current branch failed: ${errorOutput}`);
    throw new Error(`Getting current branch failed: ${errorOutput}`);
  }

  const branch = new TextDecoder().decode(output.stdout).trim();

  return branch;
}

/**
 * Check if the repository is clean (no uncommitted changes)
 * @returns True if the repository is clean
 */
export async function isRepoClean(): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["status", "--porcelain"],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  if (!output.success) {
    const errorOutput = new TextDecoder().decode(output.stderr);
    await logMessage("error", `Checking repo status failed: ${errorOutput}`);
    throw new Error(`Checking repo status failed: ${errorOutput}`);
  }

  const statusText = new TextDecoder().decode(output.stdout);

  return statusText.trim() === "";
}
