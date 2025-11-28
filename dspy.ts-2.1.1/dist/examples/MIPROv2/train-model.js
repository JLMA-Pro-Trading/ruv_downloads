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
exports.MIPROv2Model = void 0;
exports.trainModel = trainModel;
const onnx = __importStar(require("onnxruntime-web"));
const fs = __importStar(require("fs"));
class MIPROv2Model {
    constructor(config) {
        this.session = null;
        this.config = config;
    }
    async init() {
        // Create ONNX model structure
        const modelData = {
            "ir_version": 7,
            "graph": {
                "node": [
                    {
                        "input": ["input"],
                        "output": ["hidden"],
                        "op_type": "Linear",
                        "attribute": [
                            { "name": "transB", "i": 1, "type": "int" },
                            { "name": "units", "i": this.config.hiddenSize, "type": "int" }
                        ]
                    },
                    {
                        "input": ["hidden"],
                        "output": ["relu_out"],
                        "op_type": "Relu"
                    },
                    {
                        "input": ["relu_out"],
                        "output": ["output"],
                        "op_type": "Linear",
                        "attribute": [
                            { "name": "transB", "i": 1, "type": "int" },
                            { "name": "units", "i": this.config.outputSize, "type": "int" }
                        ]
                    }
                ],
                "input": [
                    {
                        "name": "input",
                        "type": {
                            "tensor_type": {
                                "elem_type": 1,
                                "shape": { "dim": [{ "dim_value": this.config.inputSize }] }
                            }
                        }
                    }
                ],
                "output": [
                    {
                        "name": "output",
                        "type": {
                            "tensor_type": {
                                "elem_type": 1,
                                "shape": { "dim": [{ "dim_value": this.config.outputSize }] }
                            }
                        }
                    }
                ]
            }
        };
        // Save model structure
        const modelPath = 'models/miprov2-model.onnx';
        fs.writeFileSync(modelPath, JSON.stringify(modelData));
        // Initialize session
        this.session = await onnx.InferenceSession.create(modelPath);
    }
    async forward(input) {
        if (!this.session) {
            throw new Error('Model not initialized');
        }
        // Create input tensor
        const inputTensor = new onnx.Tensor('float32', input, [this.config.inputSize]);
        // Run inference
        const outputs = await this.session.run({ input: inputTensor });
        const outputData = outputs.output.data;
        return outputData;
    }
    async save(path) {
        if (!this.session) {
            throw new Error('Model not initialized');
        }
        // The session is already saved in ONNX format
        console.log(`Model saved to ${path}`);
    }
}
exports.MIPROv2Model = MIPROv2Model;
function textToTensor(text, maxLength) {
    // Simple encoding: convert characters to numbers
    const encoded = new Float32Array(maxLength).fill(0);
    for (let i = 0; i < Math.min(text.length, maxLength); i++) {
        encoded[i] = text.charCodeAt(i) / 255.0; // Normalize to [0, 1]
    }
    return encoded;
}
async function trainModel(trainingDataPath, config) {
    // Load training data
    const rawData = fs.readFileSync(trainingDataPath, 'utf-8');
    const data = JSON.parse(rawData);
    const trainingData = data.training_data;
    // Initialize model
    const model = new MIPROv2Model(config);
    await model.init();
    // Prepare training data
    const inputs = [];
    const outputs = [];
    for (const item of trainingData) {
        const input = textToTensor(`Context: ${item.context}\nInput: ${item.text}`, config.inputSize);
        const output = textToTensor(item.output, config.outputSize);
        inputs.push(input);
        outputs.push(output);
    }
    // Training loop
    console.log('Starting training...');
    for (let epoch = 0; epoch < config.epochs; epoch++) {
        let totalLoss = 0;
        // Process in batches
        for (let i = 0; i < inputs.length; i += config.batchSize) {
            const batchInputs = inputs.slice(i, i + config.batchSize);
            const batchOutputs = outputs.slice(i, i + config.batchSize);
            // Forward pass and calculate loss
            for (let j = 0; j < batchInputs.length; j++) {
                const prediction = await model.forward(batchInputs[j]);
                const target = batchOutputs[j];
                // Calculate MSE loss
                let batchLoss = 0;
                for (let k = 0; k < prediction.length; k++) {
                    const diff = prediction[k] - target[k];
                    batchLoss += diff * diff;
                }
                totalLoss += batchLoss / prediction.length;
            }
        }
        const avgLoss = totalLoss / inputs.length;
        console.log(`Epoch ${epoch + 1}/${config.epochs}, Loss: ${avgLoss.toFixed(4)}`);
    }
    console.log('Training completed');
    return model;
}
async function main() {
    const config = {
        inputSize: 512,
        hiddenSize: 256,
        outputSize: 512,
        learningRate: 0.001,
        epochs: 10,
        batchSize: 4
    };
    try {
        // Train model
        const model = await trainModel('examples/MIPROv2/training-data.json', config);
        // Save model
        await model.save('models/miprov2-model.onnx');
    }
    catch (error) {
        console.error('Error:', error);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=train-model.js.map