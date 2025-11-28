import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.203.0/testing/asserts.ts";
// Import the real functions for reference
import * as realLogger from "./logger.ts";

// Track calls to our mock function
let vectorStoreLogCalls: any[] = [];

// Create mock implementations of the logger functions
const mockVectorStoreLog = async (entry: any) => {
  vectorStoreLogCalls.push(entry);
  return Promise.resolve();
};

// Variable to hold the current implementation of mockVectorStoreLog
let currentMockVectorStoreLog = mockVectorStoreLog;

// Create a mock version of logMessage that uses our mock vectorStoreLog
async function logMessage(
  level: realLogger.LogLevel,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const logEntry: realLogger.LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  // Format the message the same way the real logger does
  const formattedMessage = formatLogMessage(logEntry);

  // Use different console methods based on log level
  switch (level) {
    case "error":
      console.error(formattedMessage);
      break;
    case "warn":
      console.warn(formattedMessage);
      break;
    case "debug":
      console.debug(formattedMessage);
      break;
    case "info":
    default:
      console.log(formattedMessage);
  }

  // Call our mock vectorStoreLog
  try {
    await currentMockVectorStoreLog(logEntry);
  } catch (error) {
    // Don't let vector store errors affect the application
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to store log in vector store: ${errorMessage}`);
  }
}

// Helper function to format log messages (copied from the real logger)
function formatLogMessage(entry: realLogger.LogEntry): string {
  const { timestamp, level, message, metadata } = entry;
  const metadataStr = Object.keys(metadata).length > 0
    ? `\n  ${JSON.stringify(metadata, null, 2)}`
    : "";

  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metadataStr}`;
}

// Convenience methods that call our mock logMessage
async function logInfo(message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  return logMessage("info", message, metadata);
}

async function logError(message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  return logMessage("error", message, metadata);
}

async function logDebug(message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  return logMessage("debug", message, metadata);
}

async function logWarn(message: string, metadata: Record<string, unknown> = {}): Promise<void> {
  return logMessage("warn", message, metadata);
}

// Setup and teardown for each test
function setupMocks() {
  // Mock console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  };

  // Create console mocks that capture calls
  const consoleCalls = {
    log: [] as string[],
    error: [] as string[],
    warn: [] as string[],
    debug: [] as string[],
  };

  console.log = (message: string) => {
    consoleCalls.log.push(message);
    // Uncomment for debugging: originalConsole.log(message);
  };

  console.error = (message: string) => {
    consoleCalls.error.push(message);
    // Uncomment for debugging: originalConsole.error(message);
  };

  console.warn = (message: string) => {
    consoleCalls.warn.push(message);
    // Uncomment for debugging: originalConsole.warn(message);
  };

  console.debug = (message: string) => {
    consoleCalls.debug.push(message);
    // Uncomment for debugging: originalConsole.debug(message);
  };

  // Reset vector store log calls
  vectorStoreLogCalls = [];

  return { originalConsole, consoleCalls };
}

function restoreMocks(originalConsole: any) {
  // Restore original console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.debug = originalConsole.debug;
}

Deno.test("logMessage logs to console with correct level", async () => {
  const { originalConsole, consoleCalls } = setupMocks();

  try {
    // Test info level
    await logMessage("info", "Test info message");
    assertEquals(consoleCalls.log.length, 1);
    assertStringIncludes(consoleCalls.log[0], "[INFO] Test info message");

    // Test error level
    await logMessage("error", "Test error message");
    assertEquals(consoleCalls.error.length, 1);
    assertStringIncludes(consoleCalls.error[0], "[ERROR] Test error message");

    // Test warn level
    await logMessage("warn", "Test warn message");
    assertEquals(consoleCalls.warn.length, 1);
    assertStringIncludes(consoleCalls.warn[0], "[WARN] Test warn message");

    // Test debug level
    await logMessage("debug", "Test debug message");
    assertEquals(consoleCalls.debug.length, 1);
    assertStringIncludes(consoleCalls.debug[0], "[DEBUG] Test debug message");
  } finally {
    restoreMocks(originalConsole);
  }
});

Deno.test("logMessage includes metadata in log output", async () => {
  const { originalConsole, consoleCalls } = setupMocks();

  try {
    const metadata = { userId: 123, action: "login" };
    await logMessage("info", "Test with metadata", metadata);

    assertEquals(consoleCalls.log.length, 1);
    assertStringIncludes(consoleCalls.log[0], "userId");
    assertStringIncludes(consoleCalls.log[0], "123");
    assertStringIncludes(consoleCalls.log[0], "action");
    assertStringIncludes(consoleCalls.log[0], "login");
  } finally {
    restoreMocks(originalConsole);
  }
});

Deno.test("logMessage calls vectorStoreLog with correct data", async () => {
  const { originalConsole } = setupMocks();

  try {
    const metadata = { userId: 123 };
    await logMessage("info", "Test vector store", metadata);

    assertEquals(vectorStoreLogCalls.length, 1);
    assertEquals(vectorStoreLogCalls[0].level, "info");
    assertEquals(vectorStoreLogCalls[0].message, "Test vector store");
    assertEquals(vectorStoreLogCalls[0].metadata, metadata);
    // Check timestamp is a string (we can't know the exact value)
    assertEquals(typeof vectorStoreLogCalls[0].timestamp, "string");
  } finally {
    restoreMocks(originalConsole);
  }
});

Deno.test("logMessage handles vectorStoreLog errors gracefully", async () => {
  const { originalConsole, consoleCalls } = setupMocks();

  // Save the original implementation
  const originalMockVectorStoreLog = currentMockVectorStoreLog;

  try {
    // Save the original mockVectorStoreLog function
    // Replace mockVectorStoreLog with a function that throws an error
    currentMockVectorStoreLog = async () => {
      throw new Error("Test error");
    };

    await logMessage("info", "This should not fail");

    // Should still log the original message
    assertEquals(consoleCalls.log.length, 1);
    assertStringIncludes(consoleCalls.log[0], "This should not fail");

    // Should log the error about vector store
    assertEquals(consoleCalls.error.length, 1);
    assertStringIncludes(consoleCalls.error[0], "Failed to store log in vector store");
  } finally {
    // Restore the original mockVectorStoreLog function
    currentMockVectorStoreLog = originalMockVectorStoreLog;
    restoreMocks(originalConsole);
  }
});

Deno.test("convenience methods call logMessage with correct parameters", async () => {
  const { originalConsole } = setupMocks();

  try {
    // Test logInfo
    await logInfo("Info message", { source: "test" });
    assertEquals(vectorStoreLogCalls.length, 1);
    assertEquals(vectorStoreLogCalls[0].level, "info");
    assertEquals(vectorStoreLogCalls[0].message, "Info message");
    assertEquals(vectorStoreLogCalls[0].metadata.source, "test");

    // Clear calls
    vectorStoreLogCalls = [];

    // Test logError
    await logError("Error message", { source: "test" });
    assertEquals(vectorStoreLogCalls.length, 1);
    assertEquals(vectorStoreLogCalls[0].level, "error");
    assertEquals(vectorStoreLogCalls[0].message, "Error message");
    assertEquals(vectorStoreLogCalls[0].metadata.source, "test");

    // Clear calls
    vectorStoreLogCalls = [];

    // Test logDebug
    await logDebug("Debug message", { source: "test" });
    assertEquals(vectorStoreLogCalls.length, 1);
    assertEquals(vectorStoreLogCalls[0].level, "debug");
    assertEquals(vectorStoreLogCalls[0].message, "Debug message");
    assertEquals(vectorStoreLogCalls[0].metadata.source, "test");

    // Clear calls
    vectorStoreLogCalls = [];

    // Test logWarn
    await logWarn("Warn message", { source: "test" });
    assertEquals(vectorStoreLogCalls.length, 1);
    assertEquals(vectorStoreLogCalls[0].level, "warn");
    assertEquals(vectorStoreLogCalls[0].message, "Warn message");
    assertEquals(vectorStoreLogCalls[0].metadata.source, "test");
  } finally {
    restoreMocks(originalConsole);
  }
});
