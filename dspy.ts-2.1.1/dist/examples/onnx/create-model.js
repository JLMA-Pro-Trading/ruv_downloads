"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentimentClassifier = void 0;
exports.createModel = createModel;
exports.initializeWeights = initializeWeights;
const mock_pytorch_1 = require("./mock-pytorch");
const fs_1 = require("fs");
/**
 * Simple sentiment classifier model
 */
class SentimentClassifier {
    constructor(inputSize, hiddenSize) {
        this.fc1 = new mock_pytorch_1.nn.Linear(inputSize, hiddenSize);
        this.relu = new mock_pytorch_1.nn.ReLU();
        this.fc2 = new mock_pytorch_1.nn.Linear(hiddenSize, 2); // 2 classes: negative, positive
    }
    forward(x) {
        let out = this.fc1.forward(x);
        out = this.relu.forward(out);
        out = this.fc2.forward(out);
        return out;
    }
    to(deviceType) {
        // Mock implementation
        this.fc1.to(deviceType);
        this.relu.to(deviceType);
        this.fc2.to(deviceType);
    }
    eval() {
        // Mock implementation
    }
}
exports.SentimentClassifier = SentimentClassifier;
/**
 * Create and export a sentiment classifier model
 */
async function createModel() {
    try {
        // Model parameters
        const inputSize = 11; // Vocabulary size from create_onnx_model.py
        const hiddenSize = 16;
        // Create model
        const model = new SentimentClassifier(inputSize, hiddenSize);
        model.eval(); // Set to evaluation mode
        // Create dummy input for tracing
        const dummyInput = (0, mock_pytorch_1.tensor)(Array(inputSize).fill(0), { requiresGrad: false });
        // Export to ONNX
        const modelPath = 'models/sentiment-classifier.onnx';
        await (0, mock_pytorch_1.load)(modelPath); // Placeholder for ONNX export
        console.log(`Model exported to ${modelPath}`);
        // Save vocabulary
        const vocabulary = [
            'this', 'is', 'great', 'terrible', 'love', 'hate',
            'product', 'amazing', 'works', 'disappointed', 'quality'
        ];
        (0, fs_1.writeFileSync)('models/feature_names.txt', vocabulary.join('\n'));
        console.log('Vocabulary saved to models/feature_names.txt');
    }
    catch (error) {
        console.error('Failed to create model:', error);
        throw error;
    }
}
/**
 * Initialize model with pre-trained weights
 */
async function initializeWeights(model) {
    try {
        // Example weights initialization
        // In practice, these would come from training
        const fc1Weights = (0, mock_pytorch_1.tensor)([
        // ... weight values ...
        ]);
        const fc2Weights = (0, mock_pytorch_1.tensor)([
        // ... weight values ...
        ]);
        model.fc1.copy_(fc1Weights);
        model.fc2.copy_(fc2Weights);
    }
    catch (error) {
        console.error('Failed to initialize weights:', error);
        throw error;
    }
}
if (require.main === module) {
    createModel().catch(console.error);
}
//# sourceMappingURL=create-model.js.map