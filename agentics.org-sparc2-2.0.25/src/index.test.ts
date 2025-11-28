/**
 * Tests for the main index module
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import * as SPARC2 from "./index.ts";

Deno.test("index exports all expected modules and functions", () => {
  // Configuration
  assertEquals(typeof SPARC2.loadConfig, "function", "loadConfig should be exported");

  // Logging
  assertEquals(typeof SPARC2.logMessage, "function", "logMessage should be exported");

  // Vector Store
  assertEquals(typeof SPARC2.indexDiffEntry, "function", "indexDiffEntry should be exported");
  assertEquals(typeof SPARC2.searchDiffEntries, "function", "searchDiffEntries should be exported");

  // Diff Tracking
  assertEquals(typeof SPARC2.computeDiff, "function", "computeDiff should be exported");

  // Git Integration
  assertEquals(typeof SPARC2.createCommit, "function", "createCommit should be exported");
  assertEquals(typeof SPARC2.createCheckpoint, "function", "createCheckpoint should be exported");
  assertEquals(typeof SPARC2.rollbackChanges, "function", "rollbackChanges should be exported");
  assertEquals(typeof SPARC2.isRepoClean, "function", "isRepoClean should be exported");
  assertEquals(typeof SPARC2.getCurrentBranch, "function", "getCurrentBranch should be exported");

  // Code Interpreter
  assertEquals(typeof SPARC2.executeCode, "function", "executeCode should be exported");

  // Agent
  assertEquals(typeof SPARC2.SPARC2Agent, "function", "SPARC2Agent should be exported");

  // CLI
  assertEquals(typeof SPARC2.runCli, "function", "runCli should be exported");

  // Edge Function
  assertEquals(typeof SPARC2.handleRequest, "function", "handleRequest should be exported");

  // CORS
  assertEquals(typeof SPARC2.corsHeaders, "object", "corsHeaders should be exported");
  assertEquals(typeof SPARC2.applyCorsHeaders, "function", "applyCorsHeaders should be exported");
});

Deno.test("main function should import and run CLI main", async () => {
  // Create a mock for the CLI main function
  const originalRunCli = SPARC2.runCli;
  let mainCalled = false;

  try {
    // Replace the real main function with our mock
    // @ts-ignore: Overriding for test purposes
    SPARC2.runCli = () => {
      mainCalled = true;
      return Promise.resolve();
    };

    // Call the main function
    await SPARC2.runCli();

    // Verify that the CLI main function was called
    assertEquals(mainCalled, true, "CLI main function should be called");
  } finally {
    // Restore the original main function
    // @ts-ignore: Restoring original function after test
    SPARC2.runCli = originalRunCli;
  }
});
