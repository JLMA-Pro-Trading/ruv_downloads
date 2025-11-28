"use strict";
/**
 * Simple Q&A with Chain-of-Thought Demo
 *
 * Demonstrates basic question answering with step-by-step reasoning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = run;
const chain_of_thought_1 = require("../../../src/modules/chain-of-thought");
const openrouter_1 = require("../../../src/lm/providers/openrouter");
const base_1 = require("../../../src/lm/base");
async function run() {
    console.log('🧠 Initializing Chain-of-Thought Q&A System...\n');
    // 1. Configure Language Model
    const lm = new openrouter_1.OpenRouterLM({
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.MODEL || openrouter_1.OpenRouterModels.GPT_3_5_TURBO,
        siteName: 'DSPy.ts Demo',
    });
    await lm.init();
    (0, base_1.configureLM)(lm);
    console.log(`✅ Using model: ${process.env.MODEL || openrouter_1.OpenRouterModels.GPT_3_5_TURBO}\n`);
    // 2. Create Chain-of-Thought module
    const qaSystem = new chain_of_thought_1.ChainOfThought({
        name: 'QASystem',
        signature: {
            inputs: [
                {
                    name: 'question',
                    type: 'string',
                    description: 'The question to answer',
                    required: true,
                },
            ],
            outputs: [
                {
                    name: 'answer',
                    type: 'string',
                    description: 'The answer to the question',
                    required: true,
                },
                {
                    name: 'confidence',
                    type: 'string',
                    description: 'Confidence level (low/medium/high)',
                    required: false,
                },
            ],
        },
    });
    // 3. Demo questions
    const questions = [
        'What is the capital of France?',
        'If a train travels 120 km in 2 hours, what is its average speed?',
        'Why is the sky blue?',
    ];
    console.log('📝 Asking questions with Chain-of-Thought reasoning:\n');
    for (const question of questions) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`Question: ${question}`);
        console.log('═'.repeat(60));
        try {
            const result = await qaSystem.run({ question });
            console.log('\n💭 Reasoning:');
            console.log(result.reasoning);
            console.log('\n✨ Answer:');
            console.log(result.answer);
            if (result.confidence) {
                console.log(`\n📊 Confidence: ${result.confidence}`);
            }
        }
        catch (error) {
            console.error(`\n❌ Error: ${error}`);
        }
    }
    console.log('\n');
}
if (require.main === module) {
    run().catch(console.error);
}
//# sourceMappingURL=simple-qa.js.map