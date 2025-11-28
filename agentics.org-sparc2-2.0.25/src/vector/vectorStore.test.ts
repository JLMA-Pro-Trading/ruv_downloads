import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  clearVectorStore,
  type DiffEntry,
  indexDiffEntry,
  searchDiffEntries,
  searchLogEntries,
  type VectorSearchResult,
  vectorStoreLog,
} from "./vectorStore.ts";
import { type LogEntry } from "../logger.ts";

// Mock console.debug to capture calls
let debugLogs: string[] = [];
const originalConsoleDebug = console.debug;
const originalConsoleError = console.error;

function setupMocks() {
  debugLogs = [];
  console.debug = (...args: unknown[]) => {
    debugLogs.push(args.map((arg) => String(arg)).join(" "));
  };
  console.error = (...args: unknown[]) => {
    // Suppress error messages in tests
  };
}

function restoreMocks() {
  console.debug = originalConsoleDebug;
  console.error = originalConsoleError;
}

Deno.test("vectorStoreLog stores log entries", async () => {
  setupMocks();

  try {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Test log message",
      metadata: { test: true },
    };

    await vectorStoreLog(logEntry);

    // Verify that console.debug was called with the expected message
    // Find the relevant debug message
    const relevantLog = debugLogs.find((log) => log.includes("Vector store: Storing log entry"));
    assertExists(relevantLog, "Expected debug log about storing log entry was not found");

    // Check that the debug message contains expected information
    assertEquals(relevantLog.includes("Test log message"), true);
    assertEquals(relevantLog.includes("info"), true);
  } finally {
    restoreMocks();
  }
});

Deno.test("indexDiffEntry stores diff entries", async () => {
  setupMocks();

  try {
    const diffEntry: DiffEntry = {
      id: "test-id",
      file: "test-file.ts",
      diff: "- old line\n+ new line",
      metadata: { test: true },
    };

    await indexDiffEntry(diffEntry);

    // Verify that console.debug was called with the expected message
    // Find the relevant debug message
    const relevantLog = debugLogs.find((log) => log.includes("Vector store: Indexing diff entry"));
    assertExists(relevantLog, "Expected debug log about indexing diff entry was not found");

    // Check that the debug message contains expected information
    assertEquals(relevantLog.includes("test-id"), true);
    assertEquals(relevantLog.includes("test-file.ts"), true);
  } finally {
    restoreMocks();
  }
});

Deno.test("searchDiffEntries returns empty array for now", async () => {
  setupMocks();

  try {
    const results = await searchDiffEntries("test query");

    // Verify that console.debug was called with the expected message
    // Find the relevant debug message
    const relevantLog = debugLogs.find((log) =>
      log.includes("Vector store: Searching for diff entries")
    );
    assertExists(relevantLog, "Expected debug log about searching diff entries was not found");

    // Check that the debug message contains expected information
    assertEquals(relevantLog.includes("test query"), true);

    // Verify that the results are an empty array
    assertEquals(results, []);
  } finally {
    restoreMocks();
  }
});

Deno.test("searchLogEntries returns empty array for now", async () => {
  setupMocks();

  try {
    const results = await searchLogEntries("test query");

    // Verify that console.debug was called with the expected message
    // Find the relevant debug message
    const relevantLog = debugLogs.find((log) =>
      log.includes("Vector store: Searching for log entries")
    );
    assertExists(relevantLog, "Expected debug log about searching log entries was not found");

    // Check that the debug message contains expected information
    assertEquals(relevantLog.includes("test query"), true);

    // Verify that the results are an empty array
    assertEquals(results, []);
  } finally {
    restoreMocks();
  }
});

Deno.test("clearVectorStore clears the vector store", async () => {
  setupMocks();

  try {
    await clearVectorStore();

    // Verify that console.debug was called with the expected message
    // Find the relevant debug message
    const relevantLog = debugLogs.find((log) => log.includes("Vector store: Clearing all entries"));
    assertExists(relevantLog, "Expected debug log about clearing vector store was not found");

    // Check that the debug message contains expected information
    assertEquals(relevantLog.includes("Clearing all entries"), true);
  } finally {
    restoreMocks();
  }
});
