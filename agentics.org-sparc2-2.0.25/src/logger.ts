/**
 * Logger module for SPARC 2.0
 * Provides logging functionality with vector store integration for searchable logs
 */

import { vectorStoreLog } from "./vector/vectorStore.ts";

// Internal property for testing - allows tests to mock the vectorStoreLog function
// @ts-ignore: This is used by tests to inject mocks
export let _vectorStoreLogImpl = vectorStoreLog;

/**
 * Log level type
 */
export type LogLevel = "info" | "error" | "debug" | "warn";

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown>;
}

/**
 * Log a message with specified level and optional metadata
 * @param level Log level (info, error, debug, warn)
 * @param message Log message
 * @param metadata Additional metadata to include with the log
 */
export async function logMessage(
  level: LogLevel,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  // Output to console with appropriate formatting
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

  // Save log to vector store for later search and analysis
  try {
    // Use the internal implementation which can be mocked in tests
    await _vectorStoreLogImpl(logEntry);
  } catch (error) {
    // Don't let vector store errors affect the application
    // Properly handle the unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to store log in vector store: ${errorMessage}`);
  }
}

/**
 * Format a log entry for console output
 * @param entry Log entry to format
 * @returns Formatted log message
 */
function formatLogMessage(entry: LogEntry): string {
  const { timestamp, level, message, metadata } = entry;
  const metadataStr = Object.keys(metadata).length > 0
    ? `\n  ${JSON.stringify(metadata, null, 2)}`
    : "";

  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metadataStr}`;
}

/**
 * Convenience method for info logs
 * @param message Log message
 * @param metadata Additional metadata
 */
export async function logInfo(
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  return logMessage("info", message, metadata);
}

/**
 * Convenience method for error logs
 * @param message Log message
 * @param metadata Additional metadata
 */
export async function logError(
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  return logMessage("error", message, metadata);
}

/**
 * Convenience method for debug logs
 * @param message Log message
 * @param metadata Additional metadata
 */
export async function logDebug(
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  return logMessage("debug", message, metadata);
}

/**
 * Convenience method for warning logs
 * @param message Log message
 * @param metadata Additional metadata
 */
export async function logWarn(
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  return logMessage("warn", message, metadata);
}
