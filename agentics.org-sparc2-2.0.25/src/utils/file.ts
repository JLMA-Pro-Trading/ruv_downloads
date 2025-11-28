/**
 * File utility functions for SPARC2
 */

/**
 * Read a file line by line and parse each line as JSON
 * @param path Path to the file
 * @returns Array of parsed JSON objects
 */
export async function readJsonLines(path: string): Promise<any[]> {
  const text = await Deno.readTextFile(path);
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => JSON.parse(line));
}

/**
 * Write an array of objects to a file as JSON lines
 * @param path Path to the file
 * @param data Array of objects to write
 */
export async function writeJsonLines(path: string, data: any[]): Promise<void> {
  const lines = data.map((item) => JSON.stringify(item)).join("\n");
  await Deno.writeTextFile(path, lines);
}

/**
 * Read a file and parse it as JSON
 * @param path Path to the file
 * @returns Parsed JSON object
 */
export async function readJson(path: string): Promise<any> {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text);
}

/**
 * Write an object to a file as JSON
 * @param path Path to the file
 * @param data Object to write
 * @param pretty Whether to pretty-print the JSON
 */
export async function writeJson(path: string, data: any, pretty = false): Promise<void> {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await Deno.writeTextFile(path, text);
}

/**
 * Check if a file exists
 * @param path Path to the file
 * @returns Whether the file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

/**
 * Create a directory if it doesn't exist
 * @param path Path to the directory
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}
