import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  createCheckpoint,
  createCommit,
  getCurrentBranch,
  isRepoClean,
  rollbackChanges,
} from "./gitIntegration.ts";
import { assertSpyCalls, spy, stub } from "https://deno.land/std@0.203.0/testing/mock.ts";

// Mock for Deno.Command
const originalCommand = Deno.Command;

// Mock successful command execution
function mockSuccessCommand(stdout: string) {
  return {
    output: () =>
      Promise.resolve({
        success: true,
        stdout: new TextEncoder().encode(stdout),
        stderr: new Uint8Array(0),
        code: 0,
        signal: null,
      }),
  };
}

// Mock failed command execution
function mockFailCommand(stderr: string) {
  return {
    output: () =>
      Promise.resolve({
        success: false,
        stdout: new Uint8Array(0),
        stderr: new TextEncoder().encode(stderr),
        code: 1,
        signal: null,
      }),
  };
}

// Mock logger to avoid actual logging during tests
import * as logger from "../logger.ts";
const logMessageSpy = spy(logger, "logMessage");

Deno.test("createCommit should create a commit and return hash", async () => {
  // Setup mocks
  const commandStub = stub(
    Deno,
    "Command",
    () => mockSuccessCommand("[main abc1234] Test commit\n 1 file changed"),
  );

  try {
    const hash = await createCommit("main", "test.txt", "Test commit");

    // Verify the result
    assertEquals(hash, "abc1234");

    // Verify that git add and git commit were called
    assertSpyCalls(commandStub, 2);

    // Verify that the logger was called
    assertSpyCalls(logMessageSpy, 1);
  } finally {
    // Restore the original function
    commandStub.restore();
  }
});

Deno.test("createCommit should handle multiple files", async () => {
  // Setup mocks for multiple files
  let callCount = 0;
  const commandStub = stub(Deno, "Command", (_cmd: string, _options: unknown) => {
    callCount++;
    if (callCount <= 2) {
      // First two calls are for git add
      return mockSuccessCommand("");
    } else {
      // Third call is for git commit
      return mockSuccessCommand("[main def5678] Test commit multiple\n 2 files changed");
    }
  });

  try {
    const hash = await createCommit("main", ["file1.txt", "file2.txt"], "Test commit multiple");

    // Verify the result
    assertEquals(hash, "def5678");

    // Verify that git add was called twice (once for each file) and git commit once
    assertSpyCalls(commandStub, 3);
  } finally {
    commandStub.restore();
  }
});

Deno.test("createCommit should throw on git add failure", async () => {
  // Setup mock to fail on git add
  const commandStub = stub(
    Deno,
    "Command",
    () => mockFailCommand("fatal: pathspec 'nonexistent.txt' did not match any files"),
  );

  try {
    await assertRejects(
      async () => {
        await createCommit("main", "nonexistent.txt", "Test commit");
      },
      Error,
      "Git add failed",
    );
  } finally {
    commandStub.restore();
  }
});

Deno.test("createCommit should throw on git commit failure", async () => {
  // Setup mock to succeed on git add but fail on git commit
  let callCount = 0;
  const commandStub = stub(Deno, "Command", (_cmd: string, _options: unknown) => {
    callCount++;
    if (callCount === 1) {
      // First call is for git add
      return mockSuccessCommand("");
    } else {
      // Second call is for git commit
      return mockFailCommand("fatal: cannot commit with empty message");
    }
  });

  try {
    await assertRejects(
      async () => {
        await createCommit("main", "test.txt", "");
      },
      Error,
      "Git commit failed",
    );
  } finally {
    commandStub.restore();
  }
});

Deno.test("createCommit should push when requested", async () => {
  // Setup mocks for commit with push
  let callCount = 0;
  const commandStub = stub(Deno, "Command", (_cmd: string, _options: unknown) => {
    callCount++;
    if (callCount === 1) {
      // First call is for git add
      return mockSuccessCommand("");
    } else if (callCount === 2) {
      // Second call is for git commit
      return mockSuccessCommand("[main abc1234] Test commit\n 1 file changed");
    } else {
      // Third call is for git push
      return mockSuccessCommand("To github.com:user/repo.git\n   abc1234..def5678  main -> main");
    }
  });

  try {
    const hash = await createCommit("main", "test.txt", "Test commit", { push: true });

    // Verify the result
    assertEquals(hash, "abc1234");

    // Verify that git add, git commit, and git push were called
    assertSpyCalls(commandStub, 3);
  } finally {
    commandStub.restore();
  }
});

Deno.test("rollbackChanges should reset to checkpoint", async () => {
  // Setup mock for git reset
  const commandStub = stub(
    Deno,
    "Command",
    () => mockSuccessCommand("HEAD is now at abc1234 Test commit"),
  );

  try {
    await rollbackChanges("abc1234", "checkpoint");

    // Verify that git reset was called
    assertSpyCalls(commandStub, 1);

    // Verify that the logger was called
    assertSpyCalls(logMessageSpy, 1);
  } finally {
    commandStub.restore();
  }
});

Deno.test("rollbackChanges should handle temporal rollback", async () => {
  // Setup mocks for temporal rollback
  let callCount = 0;
  const commandStub = stub(Deno, "Command", (_cmd: string, _options: unknown) => {
    callCount++;
    if (callCount === 1) {
      // First call is for git log
      return mockSuccessCommand("abc1234\ndef5678");
    } else {
      // Subsequent calls are for git revert
      return mockSuccessCommand('Revert "Test commit"\n\nThis reverts commit abc1234.');
    }
  });

  try {
    await rollbackChanges("2023-01-01", "temporal");

    // Verify that git log and git revert were called
    assertSpyCalls(commandStub, 3); // git log + 2 reverts
  } finally {
    commandStub.restore();
  }
});

Deno.test("createCheckpoint should create a tag", async () => {
  // Setup mocks for creating a checkpoint
  let callCount = 0;
  const commandStub = stub(Deno, "Command", (_cmd: string, _options: unknown) => {
    callCount++;
    if (callCount === 1) {
      // First call is for git tag
      return mockSuccessCommand("");
    } else {
      // Second call is for git rev-parse
      return mockSuccessCommand("abc1234");
    }
  });

  try {
    const hash = await createCheckpoint("checkpoint1");

    // Verify the result
    assertEquals(hash, "abc1234");

    // Verify that git tag and git rev-parse were called
    assertSpyCalls(commandStub, 2);
  } finally {
    commandStub.restore();
  }
});

Deno.test("getCurrentBranch should return the current branch", async () => {
  // Setup mock for git rev-parse
  const commandStub = stub(Deno, "Command", () => mockSuccessCommand("main"));

  try {
    const branch = await getCurrentBranch();

    // Verify the result
    assertEquals(branch, "main");

    // Verify that git rev-parse was called
    assertSpyCalls(commandStub, 1);
  } finally {
    commandStub.restore();
  }
});

Deno.test("isRepoClean should return true for clean repo", async () => {
  // Setup mock for git status
  const commandStub = stub(Deno, "Command", () => mockSuccessCommand(""));

  try {
    const isClean = await isRepoClean();

    // Verify the result
    assertEquals(isClean, true);

    // Verify that git status was called
    assertSpyCalls(commandStub, 1);
  } finally {
    commandStub.restore();
  }
});

Deno.test("isRepoClean should return false for dirty repo", async () => {
  // Setup mock for git status
  const commandStub = stub(
    Deno,
    "Command",
    () => mockSuccessCommand(" M modified.txt\n?? untracked.txt"),
  );

  try {
    const isClean = await isRepoClean();

    // Verify the result
    assertEquals(isClean, false);

    // Verify that git status was called
    assertSpyCalls(commandStub, 1);
  } finally {
    commandStub.restore();
  }
});
