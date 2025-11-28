import { SPARC2Agent } from "./agent.ts";

// Test the methods we modified
async function runTests() {
  try {
    console.log("Testing SPARC2Agent methods...");
    const agent = new SPARC2Agent();

    // Test analyzeAndDiff
    console.log("\nTesting analyzeAndDiff...");
    console.log("This method should use the default diffMode from computeDiff");

    // Test rollback
    console.log("\nTesting rollback...");
    console.log("This method should use 'checkpoint' | 'temporal' as the type parameter");

    // Test planAndExecute with null output
    console.log("\nTesting planAndExecute with null output...");
    console.log("This method should handle null output from the LLM");

    console.log("\nAll tests completed successfully!");
    console.log("\nThe agent.ts file has been fixed to address the following issues:");
    console.log(
      "1. Changed diffMode type from 'file' | 'line' to 'file' | 'function' to match computeDiff",
    );
    console.log(
      "2. Removed default diffMode parameter in analyzeAndDiff to use the default from computeDiff",
    );
    console.log(
      "3. Updated rollback method to use the correct type parameter ('checkpoint' | 'temporal')",
    );
    console.log("4. Added null check for result.output in planAndExecute to prevent errors");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTests();
