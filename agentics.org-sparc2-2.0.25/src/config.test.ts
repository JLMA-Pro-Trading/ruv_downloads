import { assertEquals, assertRejects } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { loadConfig, loadEnvConfig, type SPARCConfig } from "./config.ts";

// Mock environment type
type MockEnv = {
  get: (key: string) => string | undefined;
  toObject: () => Record<string, string>;
};

Deno.test("loadConfig loads valid TOML configuration", async () => {
  const mockToml = `
[execution]
mode = "automatic"
diff_mode = "file"
processing = "parallel"

[logging]
enable = true
vector_logging = true

[rollback]
checkpoint_enabled = true
temporal_rollback = true

[models]
reasoning = "test-model"
instruct = "test-model"
`;

  const originalReadTextFile = Deno.readTextFile;
  Deno.readTextFile = () => Promise.resolve(mockToml);

  try {
    const config = await loadConfig("test.toml");
    assertEquals(config.execution.mode, "automatic");
    assertEquals(config.execution.diff_mode, "file");
    assertEquals(config.models.reasoning, "test-model");
  } finally {
    // Restore original function
    Deno.readTextFile = originalReadTextFile;
  }
});

Deno.test("loadConfig validates required fields", async () => {
  const mockToml = `
[execution]
mode = "automatic"
diff_mode = "file"
processing = "parallel"
`;

  const originalReadTextFile = Deno.readTextFile;
  Deno.readTextFile = () => Promise.resolve(mockToml);

  try {
    let error: Error | undefined;
    try {
      await loadConfig("test.toml");
    } catch (e) {
      error = e as Error;
    }

    if (!error) {
      throw new Error("Expected loadConfig to throw an error but it didn't");
    }

    assertEquals(error.message, "Missing required configuration sections");
  } finally {
    Deno.readTextFile = originalReadTextFile;
  }
});

Deno.test("loadEnvConfig validates required environment variables", async () => {
  // Create mock environment
  const mockEnv: MockEnv = {
    get: (_key: string) => undefined,
    toObject: () => ({}),
  };

  // Save original env
  const originalEnv = globalThis.Deno.env;
  (globalThis.Deno as any).env = mockEnv;

  try {
    await assertRejects(
      async () => await loadEnvConfig(),
      Error,
      "required environment variables",
    );
  } finally {
    // Restore original env
    (globalThis.Deno as any).env = originalEnv;
  }
});

Deno.test("loadEnvConfig returns valid config when all variables present", async () => {
  // Mock environment with all required variables
  const mockEnv: MockEnv = {
    get: (key: string) =>
      ({
        OPENAI_API_KEY: "test-key",
        GITHUB_TOKEN: "test-token",
        GITHUB_ORG: "test-org",
        EDGE_FUNCTION_URL: "http://test.com",
        E2B_API_KEY: "test-key",
        VECTOR_DB_URL: "test-url",
      })[key],
    toObject: () => ({
      OPENAI_API_KEY: "test-key",
      GITHUB_TOKEN: "test-token",
      GITHUB_ORG: "test-org",
      EDGE_FUNCTION_URL: "http://test.com",
      E2B_API_KEY: "test-key",
      VECTOR_DB_URL: "test-url",
    }),
  };

  // Save original env
  const originalEnv = globalThis.Deno.env;
  (globalThis.Deno as any).env = mockEnv;

  try {
    const config = await loadEnvConfig();
    assertEquals(config.OPENAI_API_KEY, "test-key");
    assertEquals(config.GITHUB_TOKEN, "test-token");
    assertEquals(config.GITHUB_ORG, "test-org");
    assertEquals(config.EDGE_FUNCTION_URL, "http://test.com");
    assertEquals(config.E2B_API_KEY, "test-key");
    assertEquals(config.VECTOR_DB_URL, "test-url");
  } finally {
    // Restore original env
    (globalThis.Deno as any).env = originalEnv;
  }
});
