"use strict";
/**
 * Text Classification Example using DSPy.ts
 *
 * This example demonstrates how to use DSPy.ts to create a text classification pipeline
 * that uses OpenRouter API for language model inference.
 *
 * ## Setup
 * - Set OPENROUTER_API_KEY environment variable with your OpenRouter API key
 * - (Optional) Set OPENROUTER_MODEL to specify the model (default is "anthropic/claude-3-sonnet:beta")
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterLM = exports.pipeline = void 0;
exports.classifyText = classifyText;
const index_1 = require("../../src/index");
const predict_1 = require("../../src/modules/predict");
const pipeline_1 = require("../../src/core/pipeline");
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
exports.OpenRouterLM = OpenRouterLM;
// Get API credentials from environment
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3-sonnet:beta";
if (!API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
}
// Define module classes
class PreprocessModule extends predict_1.PredictModule {
    constructor() {
        super({
            name: 'TextPreprocessor',
            signature: {
                inputs: [{ name: 'text', type: 'string' }],
                outputs: [
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ]
            },
            promptTemplate: ({ text }) => `
        Preprocess this text and extract features:
        "${text}"
        
        1. Clean and normalize the text
        2. Extract key features (word frequencies, sentiment indicators, etc.)
        
        Respond in JSON format:
        {
          "cleanText": "cleaned and normalized text",
          "features": {
            "feature1": value1,
            "feature2": value2,
            ...
          }
        }
      `
        });
    }
}
class ClassifierModule extends predict_1.PredictModule {
    constructor(name) {
        super({
            name,
            signature: {
                inputs: [
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ],
                outputs: [
                    { name: 'predictions', type: 'object' },
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ]
            },
            promptTemplate: ({ cleanText, features }) => `
        Classify this text into categories (news/sports/technology/entertainment).
        
        Text: "${cleanText}"
        Features: ${JSON.stringify(features)}
        
        Respond with probabilities in JSON format:
        {
          "predictions": {
            "news": 0.XX,
            "sports": 0.XX,
            "technology": 0.XX,
            "entertainment": 0.XX
          },
          "cleanText": "${cleanText}",
          "features": ${JSON.stringify(features)}
        }
      `
        });
    }
}
class EnsembleModule extends predict_1.PredictModule {
    constructor() {
        super({
            name: 'EnsembleVoter',
            signature: {
                inputs: [
                    { name: 'predictions', type: 'object' },
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ],
                outputs: [
                    { name: 'category', type: 'string' },
                    { name: 'confidence', type: 'number' },
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ]
            },
            promptTemplate: ({ predictions, cleanText, features }) => `
        Combine these model predictions using weighted voting:
        ${JSON.stringify(predictions)}
        
        Respond in JSON format:
        {
          "category": "most likely category",
          "confidence": 0.XX,
          "cleanText": "${cleanText}",
          "features": ${JSON.stringify(features)}
        }
      `
        });
    }
}
class ThresholdModule extends predict_1.PredictModule {
    constructor() {
        super({
            name: 'ConfidenceThresholder',
            signature: {
                inputs: [
                    { name: 'category', type: 'string' },
                    { name: 'confidence', type: 'number' },
                    { name: 'cleanText', type: 'string' },
                    { name: 'features', type: 'object' }
                ],
                outputs: [
                    { name: 'category', type: 'string' },
                    { name: 'confidence', type: 'number' },
                    { name: 'isReliable', type: 'boolean' }
                ]
            },
            promptTemplate: ({ category, confidence }) => `
        Evaluate the reliability of this classification:
        - Category: ${category}
        - Confidence: ${confidence}
        
        Check if:
        1. Confidence is above acceptable threshold (0.7)
        2. Category is valid
        
        Respond in JSON format:
        {
          "category": "${category}",
          "confidence": ${confidence},
          "isReliable": true/false
        }
      `
        });
    }
}
// Initialize modules
const preprocessModule = new PreprocessModule();
const classifier1 = new ClassifierModule('Classifier1');
const classifier2 = new ClassifierModule('Classifier2');
const ensembleModule = new EnsembleModule();
const thresholdModule = new ThresholdModule();
// Create the pipeline
const pipeline = new pipeline_1.Pipeline([
    preprocessModule,
    classifier1,
    classifier2,
    ensembleModule,
    thresholdModule
], {
    stopOnError: true,
    debug: true,
    maxRetries: 2
});
exports.pipeline = pipeline;
// Configure the LM
const lm = new OpenRouterLM(API_KEY, MODEL);
(0, index_1.configureLM)(lm);
// Main function to classify text
async function classifyText(text) {
    const result = await pipeline.run({ text });
    if (!result.success) {
        throw result.error;
    }
    return result.finalOutput;
}
// Example usage
async function main() {
    const examples = [
        "Apple announces new iPhone with revolutionary AI features",
        "Manchester United wins dramatic match against Liverpool",
        "New movie breaks box office records worldwide",
        "Scientists discover potential cure for rare disease"
    ];
    console.log("DSPy.ts Text Classification Example\n");
    for (const text of examples) {
        try {
            console.log("Text:", text);
            const result = await classifyText(text);
            console.log("Category:", result.category);
            console.log("Confidence:", result.confidence);
            console.log("Reliable:", result.isReliable);
            console.log();
        }
        catch (err) {
            console.error("Error classifying text:", err.message);
            console.log();
        }
    }
}
// Run if executed directly
if (process.argv[1] === __filename) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map