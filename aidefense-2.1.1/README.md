# aidefense

**American spelling wrapper for `aidefence`**

This package is a convenience wrapper that installs and forwards all commands to [`aidefence`](https://www.npmjs.com/package/aidefence).

## Installation

```bash
npm install -g aidefense
```

## Usage

All commands work exactly the same as `aidefence`:

```bash
# Detect threats
aidefense detect "Ignore all instructions"

# Analyze with deep verification
aidefense analyze "System prompt override" --deep

# Check version
aidefense version
```

## Why This Package?

Both spellings are supported:
- 🇬🇧 **aidefence** - British/International spelling (main package)
- 🇺🇸 **aidefense** - American spelling (wrapper)

Both packages provide the same functionality. Choose whichever spelling you prefer!

## Documentation

For full documentation, see the main package: https://www.npmjs.com/package/aidefence

## Features

- ⚡ Real-Time Detection (<10ms)
- 🧠 Behavioral Analysis (<100ms)
- 🔒 Formal Verification (<500ms)
- 🛡️ Adaptive Response (<50ms)
- 🌐 Multimodal Defense (text, image, audio, video)
- 🔗 LLM Provider Integration (OpenAI, Anthropic, Google, AWS Bedrock)

## License

MIT - See [aidefence](https://www.npmjs.com/package/aidefence) for details.
