"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSentimentAnalyzer = createSentimentAnalyzer;
const onnx_1 = require("../../src/lm/onnx");
const module_1 = require("../../src/core/module");
const pipeline_1 = require("../../src/core/pipeline");
const fs = __importStar(require("fs"));
/**
 * Example module using ONNX model for sentiment classification
 */
class SentimentModule extends module_1.Module {
    constructor(modelPath) {
        super({
            name: 'SentimentClassifier',
            signature: {
                inputs: [{ name: 'text', type: 'string', required: true }],
                outputs: [
                    { name: 'sentiment', type: 'string', required: true },
                    { name: 'confidence', type: 'number', required: true }
                ]
            },
            promptTemplate: input => input.text,
            strategy: 'Predict'
        });
        // Load feature names
        this.features = fs.readFileSync('models/feature_names.txt', 'utf-8')
            .split('\n')
            .filter(f => f.length > 0);
        // Create feature map for quick lookup
        this.featureMap = new Map(this.features.map((f, i) => [f, i]));
        this.model = new onnx_1.ONNXModel({
            modelPath,
            executionProvider: 'wasm'
        });
    }
    async init() {
        await this.model.init();
    }
    validateInput(input) {
        super.validateInput(input);
        if (!input.text || input.text.trim().length === 0) {
            throw new Error('Input text cannot be empty');
        }
    }
    textToFeatures(text) {
        const words = text.toLowerCase().split(/\s+/);
        const features = new Float32Array(this.features.length);
        // Count word occurrences
        for (const word of words) {
            const index = this.featureMap.get(word);
            if (index !== undefined) {
                features[index] += 1;
            }
        }
        return features;
    }
    async run(input) {
        this.validateInput(input);
        // Convert text to feature vector
        const features = this.textToFeatures(input.text);
        try {
            // Run inference
            const result = await this.model.run({
                float_input: features
            });
            // Get prediction and confidence
            if (!result) {
                throw new Error('Model returned no result');
            }
            // Debug log the result structure
            console.log('Model output:', JSON.stringify(result, (key, value) => {
                if (value instanceof Float32Array) {
                    return Array.from(value);
                }
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                return value;
            }, 2));
            // Get probabilities tensor
            const probabilities = result.probabilities;
            if (!probabilities || !probabilities.cpuData) {
                throw new Error('Invalid probabilities tensor');
            }
            // Get confidence for positive class (index 1)
            const confidence = probabilities.cpuData[1];
            const normalizedConfidence = Math.max(0, Math.min(1, confidence));
            const sentiment = normalizedConfidence > 0.5 ? 'positive' : 'negative';
            const output = { sentiment, confidence };
            this.validateOutput(output);
            return output;
        }
        catch (error) {
            throw new Error(`Inference failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async cleanup() {
        try {
            await this.model.cleanup();
        }
        catch (error) {
            throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
/**
 * Create and configure a sentiment analysis pipeline
 */
async function createSentimentAnalyzer(modelPath) {
    const analyzer = new SentimentModule(modelPath);
    await analyzer.init();
    const pipeline = new pipeline_1.Pipeline([analyzer], {
        stopOnError: true,
        debug: true
    });
    return [pipeline, analyzer];
}
async function main() {
    var _a;
    const modelPath = process.env.MODEL_PATH || 'models/text-classifier.onnx';
    console.log('Creating sentiment analysis pipeline...\n');
    const [pipeline, analyzer] = await createSentimentAnalyzer(modelPath);
    const inputs = [
        'This product is amazing and works great!',
        'I am very disappointed with the quality.',
        'The customer service was excellent.',
        'Would not recommend to anyone.'
    ];
    console.log('Analyzing sentiments...\n');
    try {
        for (const text of inputs) {
            const result = await pipeline.run({ text });
            if (!result.success || !result.finalOutput) {
                console.log(`Input: "${text}"`);
                console.log(`Error: ${((_a = result.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}\n`);
                continue;
            }
            console.log(`Input: "${text}"`);
            console.log(`Sentiment: ${result.finalOutput.sentiment}`);
            console.log(`Confidence: ${(result.finalOutput.confidence * 100).toFixed(1)}%\n`);
        }
    }
    catch (error) {
        console.error('Pipeline error:', error instanceof Error ? error.message : String(error));
    }
    finally {
        await analyzer.cleanup();
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map