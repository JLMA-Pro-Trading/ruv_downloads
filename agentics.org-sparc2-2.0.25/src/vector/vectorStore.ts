/**
 * VectorStore module for SPARC 2.0
 * Provides methods to index diff logs and perform vector searches
 * using OpenAI's vector store API
 */

import { LogEntry } from "../logger.ts";
import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";

// Dynamically import OpenAI to avoid issues in test environments
let OpenAI: any;
try {
  OpenAI = (await import("jsr:@openai/openai")).default;
} catch (error) {
  console.debug("OpenAI import failed, using mock implementation", { error: String(error) });
}

/**
 * Diff entry interface for storing code changes
 */
export interface DiffEntry {
  id: string;
  file: string;
  diff: string;
  metadata: Record<string, unknown>;
}

/**
 * Vector search result interface
 */
export interface VectorSearchResult {
  entry: LogEntry | DiffEntry;
  score: number;
}

// Store ID for the vector store
let vectorStoreId: string | null = null;

// Initialize OpenAI client if API key is available
let openai: any = null;
let apiKey: string | null = null;

// Try to load environment variables
try {
  // Only try to load environment variables if not in test mode
  if (Deno.env.get("DENO_ENV") !== "test") {
    await load({ export: true, allowEmptyValues: true });
  }
  apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("VITE_OPENAI_API_KEY") || null;

  if (apiKey && OpenAI) {
    openai = new OpenAI({
      apiKey,
    });
    console.debug("OpenAI client initialized");
  }
} catch (error) {
  console.debug("Failed to load environment variables", { error: String(error) });
}

/**
 * Initialize the vector store
 * @param name Name for the vector store
 * @returns The vector store ID
 */
export async function initializeVectorStore(name: string = "sparc2-vector-store"): Promise<string> {
  try {
    // If we already have a vector store ID, return it
    if (vectorStoreId !== null) {
      console.debug("Using existing vector store", { id: vectorStoreId });
      return vectorStoreId as string;
    }

    // If OpenAI client is not available, use mock implementation
    if (!openai) {
      vectorStoreId = "mock-vector-store-id";
      console.debug("Using mock vector store", { id: vectorStoreId });
      return vectorStoreId;
    }

    // Create a new vector store
    const vectorStore = await openai.vectorStores.create({ name });
    vectorStoreId = vectorStore.id;

    console.debug("Vector store initialized", { id: vectorStoreId });

    return vectorStoreId as string;
  } catch (error: unknown) {
    console.debug("Failed to initialize vector store, using mock", { error: String(error) });
    vectorStoreId = "mock-vector-store-id" as string;
    return vectorStoreId;
  }
}

/**
 * Store a log entry in the vector database
 * @param entry Log entry to store
 */
export async function vectorStoreLog(entry: LogEntry): Promise<void> {
  try {
    // If OpenAI client is not available, use mock implementation
    if (!openai) {
      console.debug("Vector store: Storing log entry (mock)", entry.message, entry.level);
      return;
    }

    // Ensure vector store is initialized
    const storeId = await initializeVectorStore();

    // Create a text file with the log entry
    const timestamp = new Date().toISOString();
    const content = `Log Entry (${timestamp})
Level: ${entry.level}
Message: ${entry.message}
Metadata: ${JSON.stringify(entry.metadata || {}, null, 2)}`;

    const file = new File(
      [content],
      `log-${Date.now()}.txt`,
      { type: "text/plain" },
    );

    // Upload the file to OpenAI
    const uploadedFile = await openai.files.create({
      file,
      purpose: "assistants",
    });

    // Add the file to the vector store
    await openai.vectorStores.files.create(storeId, {
      file_id: uploadedFile.id,
    });

    console.debug("Log entry stored in vector database", {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message.substring(0, 50) + (entry.message.length > 50 ? "..." : ""),
    });
  } catch (error: unknown) {
    console.debug("Failed to store log entry in vector database, using mock", {
      error: String(error),
    });
    console.debug("Vector store: Storing log entry (mock)", entry.message, entry.level);
  }
}

/**
 * Index a diff entry in the vector database
 * @param entry Diff entry to index
 */
export async function indexDiffEntry(entry: DiffEntry): Promise<void> {
  try {
    // If OpenAI client is not available, use mock implementation
    if (!openai) {
      console.debug("Vector store: Indexing diff entry (mock)", entry.id, entry.file);
      return;
    }

    // Ensure vector store is initialized
    const storeId = await initializeVectorStore();

    // Create a text file with the diff entry
    const content = `Diff Entry (${entry.id})
File: ${entry.file}
Diff:
${entry.diff}
Metadata: ${JSON.stringify(entry.metadata || {}, null, 2)}`;

    const file = new File(
      [content],
      `diff-${entry.id}.txt`,
      { type: "text/plain" },
    );

    // Upload the file to OpenAI
    const uploadedFile = await openai.files.create({
      file,
      purpose: "assistants",
    });

    // Add the file to the vector store
    await openai.vectorStores.files.create(storeId, {
      file_id: uploadedFile.id,
    });

    console.debug("Diff entry indexed in vector database", {
      id: entry.id,
      file: entry.file,
      diffPreview: entry.diff.substring(0, 50) + (entry.diff.length > 50 ? "..." : ""),
    });
  } catch (error: unknown) {
    console.debug("Failed to index diff entry in vector database, using mock", {
      error: String(error),
    });
    console.debug("Vector store: Indexing diff entry (mock)", entry.id, entry.file);
  }
}

/**
 * Search for diff entries similar to the query
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @returns Array of matching diff entries with similarity scores
 */
export async function searchDiffEntries(
  query: string,
  maxResults: number = 5,
): Promise<VectorSearchResult[]> {
  try {
    // If OpenAI client is not available, use mock implementation
    if (!openai) {
      console.debug("Vector store: Searching for diff entries (mock)", query);
      return [];
    }

    // Ensure vector store is initialized
    const storeId = await initializeVectorStore();

    // Search the vector store
    const searchResponse = await openai.vectorStores.search(storeId, {
      query,
      max_num_results: maxResults,
    });

    // Transform the results into the expected format
    const results: VectorSearchResult[] = searchResponse.data.map((result: any) => {
      // Extract diff entry information from the content
      const content = result.content[0]?.text || "";

      // Parse the content to extract diff entry information
      const idMatch = content.match(/Diff Entry \((.*?)\)/);
      const fileMatch = content.match(/File: (.*?)$/m);
      const diffMatch = content.match(/Diff:\n([\s\S]*?)Metadata:/);
      const metadataMatch = content.match(/Metadata: ([\s\S]*?)$/);

      const id = idMatch ? idMatch[1] : "";
      const file = fileMatch ? fileMatch[1] : "";
      const diff = diffMatch ? diffMatch[1].trim() : "";
      const metadata = metadataMatch ? JSON.parse(metadataMatch[1]) : {};

      return {
        entry: {
          id,
          file,
          diff,
          metadata,
        } as DiffEntry,
        score: result.score || 0,
      };
    });

    console.debug("Searched for diff entries", {
      query,
      maxResults,
      resultsCount: results.length,
    });

    return results;
  } catch (error: unknown) {
    console.debug("Failed to search diff entries, using mock", { error: String(error) });
    console.debug("Vector store: Searching for diff entries (mock)", query);
    return [];
  }
}

/**
 * Search for log entries similar to the query
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @returns Array of matching log entries with similarity scores
 */
export async function searchLogEntries(
  query: string,
  maxResults: number = 5,
): Promise<VectorSearchResult[]> {
  try {
    // If OpenAI client is not available, use mock implementation
    if (!openai) {
      console.debug("Vector store: Searching for log entries (mock)", query);
      return [];
    }

    // Ensure vector store is initialized
    const storeId = await initializeVectorStore();

    // Search the vector store
    const searchResponse = await openai.vectorStores.search(storeId, {
      query,
      max_num_results: maxResults,
    });

    // Transform the results into the expected format
    const results: VectorSearchResult[] = searchResponse.data.map((result: any) => {
      // Extract log entry information from the content
      const content = result.content[0]?.text || "";

      // Parse the content to extract log entry information
      const timestampMatch = content.match(/Log Entry \((.*?)\)/);
      const levelMatch = content.match(/Level: (.*?)$/m);
      const messageMatch = content.match(/Message: (.*?)$/m);
      const metadataMatch = content.match(/Metadata: ([\s\S]*?)$/);

      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
      const level = levelMatch ? levelMatch[1] : "info";
      const message = messageMatch ? messageMatch[1] : "";
      const metadata = metadataMatch ? JSON.parse(metadataMatch[1]) : {};

      return {
        entry: {
          timestamp,
          level,
          message,
          metadata,
        } as LogEntry,
        score: result.score || 0,
      };
    });

    console.debug("Searched for log entries", {
      query,
      maxResults,
      resultsCount: results.length,
    });

    return results;
  } catch (error: unknown) {
    console.debug("Failed to search log entries, using mock", { error: String(error) });
    console.debug("Vector store: Searching for log entries (mock)", query);
    return [];
  }
}

/**
 * Clear all entries from the vector store
 * Useful for testing or resetting the database
 */
export async function clearVectorStore(): Promise<void> {
  try {
    // If OpenAI client is not available or no vector store ID, use mock implementation
    if (!openai || !vectorStoreId) {
      console.debug("Vector store: Clearing all entries (mock)");
      vectorStoreId = null;
      return;
    }

    // Get all files in the vector store
    const files = await openai.vectorStores.files.list(vectorStoreId);

    // Delete each file
    for (const file of files.data) {
      await openai.vectorStores.files.delete(vectorStoreId, file.id);
    }

    // Reset the vector store ID
    vectorStoreId = null;

    console.debug("Cleared all entries from vector store");
  } catch (error: unknown) {
    console.debug("Failed to clear vector store, using mock", { error: String(error) });
    console.debug("Vector store: Clearing all entries (mock)");
    vectorStoreId = null;
  }
}
export async function searchVectorStore(
  query: string,
  maxResults: number = 10,
): Promise<VectorSearchResult[]> {
  // Split the max results between logs and diffs
  const halfResults = Math.ceil(maxResults / 2);

  // Search both logs and diffs
  const [logResults, diffResults] = await Promise.all([
    searchLogEntries(query, halfResults),
    searchDiffEntries(query, halfResults),
  ]);

  // Combine and sort results by score
  const combinedResults = [...logResults, ...diffResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return combinedResults;
}
