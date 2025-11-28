/**
 * E2B Code Interpreter Tests
 *
 * This file contains tests for the E2B Code Interpreter implementation.
 */

import { assertEquals, assertExists } from "https://deno.land/std/testing/asserts.ts";
import {
  createSandbox,
  executeCode,
  installPackages,
  listFiles,
  readFile,
  writeFile,
} from "./codeInterpreter.ts";

// Skip tests if E2B_API_KEY is not set
const apiKey = Deno.env.get("E2B_API_KEY");
const runTests = apiKey !== undefined;

if (!runTests) {
  console.warn("Skipping E2B tests: E2B_API_KEY environment variable is not set");
}

Deno.test({
  name: "E2B Code Interpreter - File Operations",
  ignore: !runTests,
  async fn() {
    // Create a single sandbox for all file operations
    const sandbox = await createSandbox();

    try {
      // Test writing a file
      const testContent = "Hello, E2B!\nThis is a test file.";
      await writeFile("/tmp/test.txt", testContent, {}, sandbox);

      // Test reading the file
      const content = await readFile("/tmp/test.txt", {}, sandbox);
      assertEquals(content, testContent, "File content should match what was written");

      // Test listing files
      const files = await listFiles("/tmp", {}, sandbox);
      assertExists(
        files.find((file) => file === "test.txt"),
        "test.txt should be in the list of files",
      );
    } finally {
      // Clean up
      await sandbox.kill?.();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2B Code Interpreter - Python Execution",
  ignore: !runTests,
  async fn() {
    // Test Python code execution
    const pythonCode = `
x = 10
y = 20
print("Hello from Python!")
print(f"x + y = {x + y}")
`;

    const result = await executeCode(pythonCode, { language: "python" });
    assertEquals(result.error, null, "Python execution should not have errors");

    // Check that the output contains the expected text
    const output = result.logs.stdout.join("\n");
    assertEquals(output.includes("Hello from Python!"), true, "Output should contain greeting");
    assertEquals(output.includes("x + y = 30"), true, "Output should contain calculation result");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2B Code Interpreter - JavaScript Execution",
  ignore: !runTests,
  async fn() {
    // Test JavaScript code execution
    const jsCode = `
const x = 10;
const y = 20;
console.log("Hello from JavaScript!");
console.log(\`x + y = \${x + y}\`);
`;

    const result = await executeCode(jsCode, { language: "javascript" });
    assertEquals(result.error, null, "JavaScript execution should not have errors");

    // Check that the output contains the expected text
    const output = result.logs.stdout.join("\n");
    assertEquals(output.includes("Hello from JavaScript!"), true, "Output should contain greeting");
    assertEquals(output.includes("x + y = 30"), true, "Output should contain calculation result");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2B Code Interpreter - Package Installation",
  ignore: !runTests,
  async fn() {
    // Test package installation
    const result = await installPackages(["numpy"], "python");
    assertEquals(result.error, null, "Package installation should not have errors");

    // Test using the installed package
    const pythonCode = `
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"NumPy array: {arr}")
print(f"Mean: {np.mean(arr)}")
`;

    const execResult = await executeCode(pythonCode, { language: "python" });
    assertEquals(execResult.error, null, "Python execution with NumPy should not have errors");

    // Check that the output contains the expected text
    const output = execResult.logs.stdout.join("\n");
    assertEquals(output.includes("NumPy array:"), true, "Output should contain NumPy array");
    assertEquals(output.includes("Mean:"), true, "Output should contain mean calculation");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
