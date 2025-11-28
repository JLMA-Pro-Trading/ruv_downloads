import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { applyDiff, computeDiff } from "./diffTracker.ts";

Deno.test("computeDiff in file mode detects simple changes", () => {
  const oldText = "line1\nline2\nline3";
  const newText = "line1\nlineX\nline3";

  const result = computeDiff(oldText, newText, "file");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "-line2");
  assertStringIncludes(result.diffText, "+lineX");
  assertEquals(result.changedLines, 1);
});

Deno.test("computeDiff in file mode handles multiple changes", () => {
  const oldText = "line1\nline2\nline3\nline4\nline5";
  const newText = "lineA\nline2\nlineC\nline4\nlineE";

  const result = computeDiff(oldText, newText, "file");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "-line1");
  assertStringIncludes(result.diffText, "+lineA");
  assertStringIncludes(result.diffText, "-line3");
  assertStringIncludes(result.diffText, "+lineC");
  assertStringIncludes(result.diffText, "-line5");
  assertStringIncludes(result.diffText, "+lineE");
  assertEquals(result.changedLines, 3);
});

Deno.test("computeDiff in file mode handles additions", () => {
  const oldText = "line1\nline2\nline3";
  const newText = "line1\nline2\nline3\nline4";

  const result = computeDiff(oldText, newText, "file");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "+line4");
  assertEquals(result.changedLines, 1);
});

Deno.test("computeDiff in file mode handles removals", () => {
  const oldText = "line1\nline2\nline3";
  const newText = "line1\nline3";

  const result = computeDiff(oldText, newText, "file");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "-line2");
  assertEquals(result.changedLines, 1);
});

Deno.test("computeDiff in file mode handles empty inputs", () => {
  // Old text is empty
  let result = computeDiff("", "line1\nline2", "file");
  assertStringIncludes(result.diffText, "+line1");
  assertStringIncludes(result.diffText, "+line2");

  // New text is empty
  result = computeDiff("line1\nline2", "", "file");
  assertStringIncludes(result.diffText, "-line1");
  assertStringIncludes(result.diffText, "-line2");

  // Both texts are empty
  result = computeDiff("", "", "file");
  assertEquals(result.diffText, "");
  assertEquals(result.changedLines, 0);
});

Deno.test("computeDiff in function mode detects function changes", () => {
  const oldText = `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`;

  const newText = `
function foo() {
  return 1;
}

function bar() {
  return 3;
}
`;

  const result = computeDiff(oldText, newText, "function");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "function bar");
  assertStringIncludes(result.diffText, "-  return 2;");
  assertStringIncludes(result.diffText, "+  return 3;");
});

Deno.test("computeDiff in function mode detects added functions", () => {
  const oldText = `
function foo() {
  return 1;
}
`;

  const newText = `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`;

  const result = computeDiff(oldText, newText, "function");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "function bar");
  assertStringIncludes(result.diffText, "+function bar() {");
  assertStringIncludes(result.diffText, "+  return 2;");
  assertStringIncludes(result.diffText, "+}");
});

Deno.test("computeDiff in function mode detects removed functions", () => {
  const oldText = `
function foo() {
  return 1;
}

function bar() {
  return 2;
}
`;

  const newText = `
function foo() {
  return 1;
}
`;

  const result = computeDiff(oldText, newText, "function");

  // Check that the diff contains the expected changes
  assertStringIncludes(result.diffText, "function bar");
  assertStringIncludes(result.diffText, "-function bar() {");
  assertStringIncludes(result.diffText, "-  return 2;");
  assertStringIncludes(result.diffText, "-}");
});

Deno.test("applyDiff correctly applies changes", () => {
  const originalText = "line1\nline2\nline3\nline4\nline5";

  // Create a diff that changes line2 to lineX and removes line4
  const diff = `@@ -1,5 +1,4 @@
 line1
-line2
+lineX
 line3
-line4
 line5`;

  const newText = applyDiff(originalText, diff);
  assertEquals(newText, "line1\nlineX\nline3\nline5");
});

Deno.test("applyDiff handles multiple hunks", () => {
  const originalText = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8";

  // Create a diff with two separate hunks
  const diff = `@@ -1,3 +1,3 @@
 line1
-line2
+lineX
 line3
@@ -6,3 +6,3 @@
 line6
-line7
+lineY
 line8`;

  const newText = applyDiff(originalText, diff);
  assertEquals(newText, "line1\nlineX\nline3\nline4\nline5\nline6\nlineY\nline8");
});

Deno.test("applyDiff handles additions", () => {
  const originalText = "line1\nline2\nline3";

  // Create a diff that adds a new line
  const diff = `@@ -1,3 +1,4 @@
 line1
 line2
+lineX
 line3`;

  const newText = applyDiff(originalText, diff);
  assertEquals(newText, "line1\nline2\nlineX\nline3");
});

Deno.test("applyDiff handles removals", () => {
  const originalText = "line1\nline2\nline3";

  // Create a diff that removes a line
  const diff = `@@ -1,3 +1,2 @@
 line1
-line2
 line3`;

  const newText = applyDiff(originalText, diff);
  assertEquals(newText, "line1\nline3");
});

Deno.test("applyDiff handles empty inputs", () => {
  // Empty original text
  let newText = applyDiff("", "@@ -0,0 +1,2 @@\n+line1\n+line2");
  assertEquals(newText, "line1\nline2");

  // Empty diff
  newText = applyDiff("line1\nline2", "");
  assertEquals(newText, "line1\nline2");
});

Deno.test("applyDiff handles invalid diff format gracefully", () => {
  const originalText = "line1\nline2\nline3";

  // Create an invalid diff
  const diff = "This is not a valid diff format";

  // Should not change the original text
  const newText = applyDiff(originalText, diff);
  assertEquals(newText, originalText);
});

Deno.test("round trip: computeDiff and applyDiff work together", () => {
  const originalText = "line1\nline2\nline3\nline4\nline5";
  const modifiedText = "line1\nlineX\nline3\nlineY\nline5";

  // Compute diff
  const result = computeDiff(originalText, modifiedText, "file");

  // Apply diff
  const newText = applyDiff(originalText, result.diffText);

  // Should get back the modified text
  assertEquals(newText, modifiedText);
});
