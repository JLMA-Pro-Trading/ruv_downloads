// Verify that executeCode was called
assertEquals(executeCodeSpy.calls.length, 1);
assertEquals(executeCodeSpy.calls[0].args[0], "console.log('Hello')");

if (executeCodeSpy.calls[0].args[1]) {
  // Check if options object has language property
  const options = executeCodeSpy.calls[0].args[1];
  assertEquals(
    typeof options === "object" && "language" in options ? options.language : null,
    "typescript",
  );
}
