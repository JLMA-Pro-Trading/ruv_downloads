"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIPROv2Module = void 0;
const module_1 = require("../../src/core/module");
class MIPROv2Module extends module_1.Module {
    constructor(model) {
        super({
            name: "MIPROv2Module",
            signature: {
                inputs: [
                    { name: "text", type: "string", description: "The input text to process" },
                    { name: "context", type: "string", description: "Optional context for processing" }
                ],
                outputs: [
                    { name: "result", type: "string", description: "The processed output text" },
                    { name: "confidence", type: "number", description: "Confidence score of the output" }
                ]
            },
            promptTemplate: (input) => input.context ?
                `Context: ${input.context}\nInput: ${input.text}` :
                `Input: ${input.text}`,
            strategy: "Predict"
        });
        this.minLength = 10;
        this.maxLength = 100;
        this.model = model;
    }
    async run(input) {
        try {
            // Generate prompt
            const prompt = this.promptTemplate(input);
            // Generate output using the model
            const output = await this.model.generate(prompt);
            // Calculate confidence score
            const confidence = this.calculateConfidence(output);
            return {
                result: output,
                confidence
            };
        }
        catch (error) {
            console.error("Error in MIPROv2Module:", error);
            return {
                result: "Error processing input",
                confidence: 0
            };
        }
    }
    calculateConfidence(output) {
        const length = output.length;
        if (length < this.minLength)
            return 0.3;
        if (length > this.maxLength)
            return 0.7;
        return 0.3 + (0.4 * (length - this.minLength) / (this.maxLength - this.minLength));
    }
}
exports.MIPROv2Module = MIPROv2Module;
//# sourceMappingURL=mipro-v2-pipeline.js.map