"use strict";
/**
 * Optimizer Example using DSPy.ts
 *
 * This example demonstrates how to use DSPy.ts optimizers to improve module performance
 * by automatically generating and selecting few-shot examples.
 *
 * ## Setup
 * - Set OPENROUTER_API_KEY environment variable with your OpenRouter API key
 * - (Optional) Set OPENROUTER_MODEL to specify the model (default is "anthropic/claude-3-sonnet:beta")
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentimentModule = void 0;
exports.exactMatchMetric = exactMatchMetric;
const index_1 = require("../../src/index");
const predict_1 = require("../../src/modules/predict");
const bootstrap_1 = require("../../src/optimize/bootstrap");
// OpenRouter LM implementation
class OpenRouterLM {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
    }
    async generate(prompt, options) {
        var _a;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: this.model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: options === null || options === void 0 ? void 0 : options.maxTokens,
                temperature: (_a = options === null || options === void 0 ? void 0 : options.temperature) !== null && _a !== void 0 ? _a : 0,
                stop: options === null || options === void 0 ? void 0 : options.stopSequences,
            })
        });
        if (!response.ok) {
            throw new index_1.LMError(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }
}
// Define module to optimize
class SentimentModule extends predict_1.PredictModule {
    constructor() {
        super({
            name: 'SentimentAnalyzer',
            signature: {
                inputs: [{ name: 'text', type: 'string' }],
                outputs: [
                    { name: 'sentiment', type: 'string' },
                    { name: 'confidence', type: 'number' }
                ]
            },
            promptTemplate: ({ text }) => `
        Analyze the sentiment of this text and respond in JSON format:
        "${text}"
        
        Response format:
        {
          "sentiment": "positive|negative|neutral",
          "confidence": 0.XX
        }
      `
        });
    }
}
exports.SentimentModule = SentimentModule;
// Get API credentials from environment
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3-sonnet:beta";
if (!API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
}
// Configure the LM
const lm = new OpenRouterLM(API_KEY, MODEL);
(0, index_1.configureLM)(lm);
// Training data
const trainset = [
    {
        input: { text: "I love this product! It's amazing!" },
        output: { sentiment: "positive", confidence: 0.95 }
    },
    {
        input: { text: "This is the worst experience ever." },
        output: { sentiment: "negative", confidence: 0.9 }
    },
    {
        input: { text: "The weather is okay today." },
        output: { sentiment: "neutral", confidence: 0.8 }
    },
    // Unlabeled examples for bootstrapping
    {
        input: { text: "The service was fantastic and exceeded my expectations!" }
    },
    {
        input: { text: "I'm really disappointed with the quality." }
    }
];
// Metric function
function exactMatchMetric(input, output, expected) {
    if (!expected)
        return 0;
    return output.sentiment === expected.sentiment ? 1 : 0;
}
// Example usage
async function main() {
    console.log("DSPy.ts Optimizer Example\n");
    // Create base module
    const baseModule = new SentimentModule();
    // Create and configure optimizer
    const optimizer = new bootstrap_1.BootstrapFewShot(exactMatchMetric, {
        maxLabeledDemos: 2,
        maxBootstrappedDemos: 2,
        minScore: 0.8,
        debug: true
    });
    // Optimize the module
    console.log("Optimizing module...\n");
    const optimizedModule = await optimizer.compile(baseModule, trainset);
    // Test both modules
    const testExamples = [
        "The customer service was exceptional and they went above and beyond.",
        "I regret purchasing this item, complete waste of money.",
        "The movie was neither great nor terrible, just average."
    ];
    console.log("Testing base module:");
    for (const text of testExamples) {
        try {
            const result = await baseModule.run({ text });
            console.log(`Text: "${text}"`);
            console.log("Result:", result);
            console.log();
        }
        catch (err) {
            console.error("Error:", err.message);
            console.log();
        }
    }
    console.log("\nTesting optimized module:");
    for (const text of testExamples) {
        try {
            const result = await optimizedModule.run({ text });
            console.log(`Text: "${text}"`);
            console.log("Result:", result);
            console.log();
        }
        catch (err) {
            console.error("Error:", err.message);
            console.log();
        }
    }
    // Save the optimized module
    optimizer.save("optimized-sentiment.json");
    console.log("\nOptimized module saved to optimized-sentiment.json");
}
// Run if executed directly
if (process.argv[1] === __filename) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map