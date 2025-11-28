"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingManager = exports.GRPOOptimizer = exports.RewardModule = exports.TextGeneratorModule = void 0;
exports.createFineTunedModel = createFineTunedModel;
const module_1 = require("../../src/core/module");
const DEFAULT_DOMAIN_CONFIG = {
    knowledge: {
        'quantum computing': {
            keywords: ['quantum', 'qubit', 'superposition', 'entanglement', 'computation'],
            templates: [
                '{topic} leverages {concept} to perform calculations',
                'In {topic}, {concept} enables powerful {feature}',
                'The key principle of {topic} is {concept}'
            ],
            relationships: {
                'quantum': ['mechanics', 'states', 'algorithms'],
                'qubit': ['superposition', 'entanglement', 'measurement'],
                'computation': ['processing', 'algorithms', 'simulation']
            }
        },
        'machine learning': {
            keywords: ['algorithm', 'model', 'training', 'prediction', 'data'],
            templates: [
                '{topic} uses {concept} to learn from data',
                'Through {concept}, {topic} can achieve {feature}',
                '{topic} is based on {concept} techniques'
            ],
            relationships: {
                'algorithm': ['optimization', 'learning', 'prediction'],
                'model': ['training', 'inference', 'accuracy'],
                'data': ['features', 'patterns', 'analysis']
            }
        },
        'neural networks': {
            keywords: ['neurons', 'layers', 'weights', 'activation', 'learning'],
            templates: [
                '{topic} consist of {concept} that process information',
                'The power of {topic} comes from their {concept}',
                '{topic} learn by adjusting {concept}'
            ],
            relationships: {
                'neurons': ['connections', 'activation', 'processing'],
                'layers': ['deep', 'hidden', 'output'],
                'learning': ['backpropagation', 'optimization', 'training']
            }
        }
    },
    defaultQuality: 0.1,
    minQuality: 0.1,
    maxQuality: 0.95
};
/**
 * Text generation module that can be fine-tuned
 */
class TextGeneratorModule extends module_1.Module {
    constructor(options) {
        super({
            name: options.name,
            signature: {
                inputs: [{ name: 'text', type: 'string', required: true }],
                outputs: [
                    { name: 'generated', type: 'string', required: true },
                    { name: 'quality', type: 'number', required: true }
                ]
            },
            promptTemplate: options.promptTemplate,
            strategy: 'Predict'
        });
        this.options = options;
        const config = options.domainConfig || DEFAULT_DOMAIN_CONFIG;
        this.knowledge = config.knowledge;
        // Initialize weights for all keywords
        this.weights = {};
        Object.values(this.knowledge).forEach(domain => {
            domain.keywords.forEach(keyword => {
                this.weights[keyword] = 0.5 + Math.random() * 0.1;
            });
        });
    }
    findRelevantDomain(input) {
        const inputWords = input.toLowerCase().split(' ');
        for (const [domain, knowledge] of Object.entries(this.knowledge)) {
            if (inputWords.some(word => domain.includes(word))) {
                return [domain, knowledge];
            }
        }
        return null;
    }
    async run(input) {
        this.validateInput(input);
        const domainInfo = this.findRelevantDomain(input.text);
        if (!domainInfo) {
            const config = this.options.domainConfig || DEFAULT_DOMAIN_CONFIG;
            return {
                generated: "I don't have enough knowledge about this topic yet.",
                quality: config.defaultQuality || 0.1
            };
        }
        const [domain, knowledge] = domainInfo;
        // Select keywords based on weights
        const selectedKeywords = knowledge.keywords
            .filter(k => this.weights[k] > 0.5)
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);
        // Select a template
        const template = knowledge.templates[Math.floor(Math.random() * knowledge.templates.length)];
        // Get related concepts
        const relatedConcepts = selectedKeywords
            .map(k => knowledge.relationships[k] || [])
            .flat()
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);
        // Generate response
        const response = template
            .replace('{topic}', domain)
            .replace('{concept}', selectedKeywords.join(' and '))
            .replace('{feature}', relatedConcepts.join(' and '));
        // Calculate quality based on keyword weights and coherence
        const config = this.options.domainConfig || DEFAULT_DOMAIN_CONFIG;
        const quality = Math.min(config.maxQuality || 0.95, Math.max(config.minQuality || 0.1, selectedKeywords.reduce((sum, k) => sum + this.weights[k], 0) / selectedKeywords.length));
        const output = {
            generated: response,
            quality
        };
        this.validateOutput(output);
        return output;
    }
    async getLogProbabilities(output) {
        const words = output.generated.toLowerCase().split(' ');
        return Object.entries(this.weights).map(([keyword, weight]) => {
            const prob = words.includes(keyword) ? Math.log(weight + 1e-8) : Math.log(1e-8);
            return isFinite(prob) ? prob : Math.log(1e-8);
        });
    }
    async updateWeights(gradients) {
        Object.keys(this.weights).forEach((keyword, i) => {
            const gradient = gradients[i] || 0;
            if (!isFinite(gradient))
                return;
            const newWeight = this.weights[keyword] + gradient * 0.1;
            this.weights[keyword] = Math.min(0.95, Math.max(0.1, isFinite(newWeight) ? newWeight : 0.1));
        });
    }
}
exports.TextGeneratorModule = TextGeneratorModule;
/**
 * Reward evaluation module
 */
class RewardModule extends module_1.Module {
    constructor(options) {
        super({
            name: options.name,
            signature: {
                inputs: [
                    { name: 'generated', type: 'string', required: true },
                    { name: 'quality', type: 'number', required: true }
                ],
                outputs: [
                    { name: 'reward', type: 'number', required: true },
                    { name: 'feedback', type: 'string', required: true }
                ]
            },
            promptTemplate: options.promptTemplate,
            strategy: 'Predict'
        });
    }
    async run(input) {
        this.validateInput(input);
        const words = input.generated.split(' ');
        // Evaluate multiple aspects
        const lengthScore = Math.min(1, words.length / 15);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const vocabularyScore = uniqueWords.size / words.length;
        const structureScore = input.generated.includes(' and ') ? 0.8 : 0.5;
        const reward = (lengthScore * 0.3 +
            vocabularyScore * 0.3 +
            structureScore * 0.2 +
            input.quality * 0.2);
        const output = {
            reward: Math.min(0.95, Math.max(0.1, reward)),
            feedback: `Length: ${lengthScore.toFixed(2)}, Vocabulary: ${vocabularyScore.toFixed(2)}, Structure: ${structureScore.toFixed(2)}, Quality: ${input.quality.toFixed(2)}`
        };
        this.validateOutput(output);
        return output;
    }
}
exports.RewardModule = RewardModule;
/**
 * GRPO Optimizer implementation
 */
class GRPOOptimizer {
    constructor(config) {
        this.currentStep = 0;
        const defaultConfig = {
            learningRate: 0.001,
            clipEpsilon: 0.2,
            miniBatchSize: 32,
            epochs: 5,
            entropyCoef: 0.01
        };
        this.config = Object.assign(Object.assign({}, defaultConfig), config);
    }
    async update(module, outputs, rewards) {
        if (outputs.length === 0 || rewards.length === 0) {
            return {
                batchId: this.currentStep,
                avgReward: 0,
                policyLoss: 0,
                valueLoss: 0
            };
        }
        const batchSize = outputs.length;
        let totalPolicyLoss = 0;
        let totalValueLoss = 0;
        const normalizedRewards = this.normalizeRewards(rewards.map(r => r.reward));
        for (let epoch = 0; epoch < this.config.epochs; epoch++) {
            for (let i = 0; i < batchSize; i += this.config.miniBatchSize) {
                const batchOutputs = outputs.slice(i, i + this.config.miniBatchSize);
                const batchRewards = normalizedRewards.slice(i, i + this.config.miniBatchSize);
                if (batchOutputs.length === 0)
                    continue;
                const logProbs = await module.getLogProbabilities(batchOutputs[0]);
                const gradients = logProbs.map((prob, i) => {
                    const reward = batchRewards[0] || 0;
                    const gradient = prob * reward * this.config.learningRate;
                    return isFinite(gradient) ? gradient : 0;
                });
                await module.updateWeights(gradients);
                const validGradients = gradients.filter(g => isFinite(g));
                const loss = validGradients.length > 0
                    ? -(validGradients.reduce((a, b) => a + b, 0) / validGradients.length)
                    : 0;
                totalPolicyLoss += loss;
                this.currentStep++;
            }
        }
        const avgReward = rewards.length > 0
            ? rewards.reduce((a, b) => a + b.reward, 0) / rewards.length
            : 0;
        return {
            batchId: this.currentStep,
            avgReward,
            policyLoss: totalPolicyLoss / (this.config.epochs * Math.max(1, batchSize)),
            valueLoss: totalValueLoss / (this.config.epochs * Math.max(1, batchSize))
        };
    }
    normalizeRewards(rewards) {
        if (rewards.length === 0)
            return [];
        const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;
        const variance = rewards.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rewards.length;
        const std = Math.sqrt(variance);
        return rewards.map(r => (r - mean) / (std + 1e-8));
    }
}
exports.GRPOOptimizer = GRPOOptimizer;
/**
 * Training Manager handles the training process
 */
class TrainingManager {
    constructor(config) {
        this.module = config.module;
        this.optimizer = config.optimizer;
        this.rewardModule = config.rewardModule;
        this.onBatchComplete = config.onBatchComplete;
    }
    async trainOnBatch(batch) {
        const outputs = await Promise.all(batch.map(input => this.module.run(input)));
        const rewards = await Promise.all(outputs.map(output => this.rewardModule.run(output)));
        console.log('\nBatch outputs:');
        outputs.forEach((output, i) => {
            console.log(`\nInput: "${batch[i].text}"`);
            console.log(`Output: "${output.generated}"`);
            console.log(`Reward: ${rewards[i].reward.toFixed(3)}`);
            console.log(`Feedback: ${rewards[i].feedback}`);
        });
        const metrics = await this.optimizer.update(this.module, outputs, rewards);
        if (this.onBatchComplete) {
            this.onBatchComplete(metrics);
        }
        return metrics;
    }
}
exports.TrainingManager = TrainingManager;
/**
 * Create and configure a fine-tuned model
 */
async function createFineTunedModel(trainingData, config) {
    const baseModule = new TextGeneratorModule({
        name: 'TextGenerator',
        promptTemplate: input => `${config.basePrompt}\n\nInput: ${input.text}`
    });
    const rewardModule = new RewardModule({
        name: 'QualityEvaluator',
        promptTemplate: input => `${config.rewardPrompt}\n\nText: ${input.generated}`
    });
    const optimizer = new GRPOOptimizer(config.optimizerConfig);
    const trainer = new TrainingManager({
        module: baseModule,
        optimizer,
        rewardModule,
        onBatchComplete: metrics => {
            console.log('\nTraining metrics:', {
                batchId: metrics.batchId,
                avgReward: metrics.avgReward.toFixed(3),
                policyLoss: metrics.policyLoss.toFixed(3),
                valueLoss: metrics.valueLoss.toFixed(3)
            });
        }
    });
    console.log('\nStarting training...\n');
    // Train on data in multiple epochs
    const epochs = 3;
    for (let epoch = 0; epoch < epochs; epoch++) {
        console.log(`\nEpoch ${epoch + 1}/${epochs}`);
        for (const batch of chunk(trainingData, 1)) {
            await trainer.trainOnBatch(batch.map(example => example.input));
        }
    }
    return baseModule;
}
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
async function main() {
    const trainingData = [
        {
            input: { text: 'Explain quantum computing' },
            output: {
                generated: 'Quantum computing uses quantum mechanics principles for computation',
                quality: 0.95
            }
        },
        {
            input: { text: 'What is machine learning?' },
            output: {
                generated: 'Machine learning is a branch of artificial intelligence',
                quality: 0.9
            }
        },
        {
            input: { text: 'Describe neural networks' },
            output: {
                generated: 'Neural networks are computing systems inspired by biological brains',
                quality: 0.85
            }
        }
    ];
    console.log('Creating and training model...\n');
    const model = await createFineTunedModel(trainingData, {
        basePrompt: 'Generate a high-quality explanation of the given topic.',
        rewardPrompt: 'Evaluate the quality and accuracy of this explanation.',
        optimizerConfig: {
            learningRate: 0.05,
            epochs: 2
        }
    });
    console.log('\nTesting model with new inputs...\n');
    const testInputs = [
        'Explain artificial intelligence',
        'How do quantum computers work?',
        'What are neural networks used for?'
    ];
    for (const text of testInputs) {
        const result = await model.run({ text });
        console.log(`\nInput: "${text}"`);
        console.log(`Output: "${result.generated}"`);
        console.log(`Quality: ${result.quality.toFixed(3)}`);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map