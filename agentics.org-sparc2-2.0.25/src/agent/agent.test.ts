// Create a stub for diffTracker.computeDiff
const computeDiffStub = stub(diffTracker, "computeDiff", () => ({
  hunks: [],
  diffText: "",
  changedLines: 0,
}));

// Create a stub for OpenAI
const openaiStub = stub(
  OpenAI.prototype,
  "chat",
  () => new MockOpenAI().chat,
);

// Create agent
const agent = new SPARC2Agent();

// Call planAndExecute
const results = await agent.planAndExecute("Analyze code", [file]);

// Verify results
assertEquals(results.length, 1);
assertEquals(results[0].path, "test.ts");
assertEquals(results[0].originalContent, "function hello() { return 'Hello, world!'; }");
assertEquals(results[0].modifiedContent, "function hello() { return 'Hello, world!'; }");
assertEquals(results[0].originalContent === results[0].modifiedContent, true);

// Verify logs
assertSpyCalls(logMessageSpy, 2);
assertEquals(logMessageSpy.calls[0].args[0], "info");
assertEquals(logMessageSpy.calls[1].args[0], "info");
assertEquals(logMessageSpy.calls[1].args[1], "No changes detected for test.ts");
