"use strict";
/**
 * ReAct Module
 *
 * Implements the ReAct (Reasoning + Acting) pattern where the model
 * alternates between reasoning about the problem and taking actions
 * using available tools.
 *
 * Based on: ReAct: Synergizing Reasoning and Acting in Language Models
 * (Yao et al., 2022)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReAct = void 0;
const module_1 = require("../core/module");
const lm_1 = require("../lm");
/**
 * ReAct module for reasoning and acting
 */
class ReAct extends module_1.Module {
    /**
     * Create a ReAct module
     */
    constructor(config) {
        super({
            name: config.name,
            signature: config.signature,
            strategy: 'ReAct',
        });
        this.tools = new Map(config.tools.map((t) => [t.name.toLowerCase(), t]));
        this.maxIterations = config.maxIterations || 10;
        // Extend signature to include reasoning and steps
        this.extendSignature();
    }
    /**
     * Extend signature with ReAct outputs
     */
    extendSignature() {
        const hasReasoning = this.signature.outputs.some((f) => f.name === 'reasoning');
        const hasSteps = this.signature.outputs.some((f) => f.name === 'steps');
        if (!hasReasoning) {
            this.signature.outputs.unshift({
                name: 'reasoning',
                type: 'string',
                description: 'Complete reasoning trace',
                required: true,
            });
        }
        if (!hasSteps) {
            this.signature.outputs.unshift({
                name: 'steps',
                type: 'object',
                description: 'ReAct steps taken',
                required: true,
            });
        }
    }
    /**
     * Execute the ReAct loop
     */
    async run(input) {
        // Validate input
        this.validateInput(input);
        // Get language model
        const lm = (0, lm_1.getLM)();
        if (!lm) {
            throw new Error('No language model configured. Call configureLM() first.');
        }
        const steps = [];
        let iteration = 0;
        let finalAnswer = null;
        // ReAct loop
        while (iteration < this.maxIterations && !finalAnswer) {
            iteration++;
            // Generate thought
            const thoughtPrompt = this.buildThoughtPrompt(input, steps);
            const thoughtResponse = await lm.generate(thoughtPrompt, {
                temperature: 0.7,
                maxTokens: 200,
            });
            const thought = this.extractThought(thoughtResponse);
            steps.push({
                type: 'thought',
                content: thought,
                stepNumber: iteration,
            });
            // Check if we have a final answer
            const answerMatch = thought.match(/(?:final answer|answer):\s*(.+)/i);
            if (answerMatch) {
                finalAnswer = this.parseAnswer(answerMatch[1], steps);
                break;
            }
            // Generate action
            const actionPrompt = this.buildActionPrompt(input, steps);
            const actionResponse = await lm.generate(actionPrompt, {
                temperature: 0.3,
                maxTokens: 100,
            });
            const action = this.extractAction(actionResponse);
            if (!action) {
                // No action, continue to next iteration
                continue;
            }
            steps.push({
                type: 'action',
                content: action.input,
                tool: action.tool,
                stepNumber: iteration,
            });
            // Execute tool
            const observation = await this.executeTool(action.tool, action.input);
            steps.push({
                type: 'observation',
                content: observation,
                stepNumber: iteration,
            });
        }
        // Build final output
        const reasoning = this.buildReasoningTrace(steps);
        if (!finalAnswer) {
            // Max iterations reached without answer
            finalAnswer = this.extractFallbackAnswer(input, steps);
        }
        const output = Object.assign(Object.assign({}, finalAnswer), { reasoning,
            steps });
        // Validate output
        this.validateOutput(output);
        return output;
    }
    /**
     * Build thought generation prompt
     */
    buildThoughtPrompt(input, steps) {
        const parts = [];
        parts.push('You are a ReAct agent that alternates between thinking and acting.');
        parts.push('');
        // Task description
        parts.push('Task:');
        parts.push(this.signature.outputs
            .filter((o) => !['reasoning', 'steps'].includes(o.name))
            .map((o) => `- ${o.name}: ${o.description || 'provide this output'}`)
            .join('\n'));
        parts.push('');
        // Available tools
        parts.push('Available tools:');
        for (const tool of this.tools.values()) {
            parts.push(`- ${tool.name}: ${tool.description}`);
        }
        parts.push('');
        // Input
        parts.push('Input:');
        for (const field of this.signature.inputs) {
            parts.push(`${field.name}: ${JSON.stringify(input[field.name])}`);
        }
        parts.push('');
        // Previous steps
        if (steps.length > 0) {
            parts.push('Previous steps:');
            for (const step of steps.slice(-6)) {
                // Last 6 steps
                parts.push(`${step.type.toUpperCase()}: ${step.content}`);
            }
            parts.push('');
        }
        parts.push('Think about what to do next. If you have enough information, provide your final answer starting with "Final Answer:". Otherwise, explain what you need to do.');
        return parts.join('\n');
    }
    /**
     * Build action generation prompt
     */
    buildActionPrompt(input, steps) {
        var _a;
        const parts = [];
        parts.push('Based on your thought, what action should you take?');
        parts.push('');
        parts.push('Available tools:');
        for (const tool of this.tools.values()) {
            parts.push(`- ${tool.name}: ${tool.description}`);
        }
        parts.push('');
        const lastThought = ((_a = steps[steps.length - 1]) === null || _a === void 0 ? void 0 : _a.content) || '';
        parts.push(`Your last thought: ${lastThought}`);
        parts.push('');
        parts.push('Choose a tool and provide input in this format:');
        parts.push('ReActTool: <tool_name>');
        parts.push('Input: <input_for_tool>');
        return parts.join('\n');
    }
    /**
     * Extract thought from response
     */
    extractThought(response) {
        // Clean up response
        let thought = response.trim();
        // Remove "Thought:" prefix if present
        thought = thought.replace(/^thought:\s*/i, '');
        return thought;
    }
    /**
     * Extract action from response
     */
    extractAction(response) {
        // Parse line by line to extract tool and input
        const lines = response.split('\n');
        let tool = '';
        let input = '';
        for (const line of lines) {
            const toolMatch = line.match(/tool:\s*(\w+)/i);
            const inputMatch = line.match(/(?:input|with):\s*(.+)/i);
            if (toolMatch) {
                tool = toolMatch[1].trim().toLowerCase();
            }
            if (inputMatch) {
                input = inputMatch[1].trim();
            }
        }
        if (tool && this.tools.has(tool)) {
            return { tool, input: input || '' };
        }
        return null;
    }
    /**
     * Execute a tool
     */
    async executeTool(toolName, input) {
        const tool = this.tools.get(toolName.toLowerCase());
        if (!tool) {
            return `Error: ReActTool '${toolName}' not found`;
        }
        try {
            const result = await tool.execute(input);
            return result;
        }
        catch (error) {
            return `Error executing tool: ${error}`;
        }
    }
    /**
     * Parse final answer from thought
     */
    parseAnswer(answerText, steps) {
        const result = {};
        // Try to extract structured data
        for (const field of this.signature.outputs) {
            if (['reasoning', 'steps'].includes(field.name))
                continue;
            // Look for field in answer
            const pattern = new RegExp(`${field.name}\\s*[:=]\\s*([^\\n]+)`, 'i');
            const match = answerText.match(pattern);
            if (match) {
                let value = match[1].trim().replace(/^["']|["']$/g, '');
                // Type conversion
                if (field.type === 'number') {
                    result[field.name] = parseFloat(value) || 0;
                }
                else if (field.type === 'boolean') {
                    result[field.name] = value.toLowerCase() === 'true';
                }
                else {
                    result[field.name] = value;
                }
            }
            else {
                // Use answer text as primary field
                if (this.signature.outputs.indexOf(field) === 2) {
                    // First output field after reasoning and steps
                    result[field.name] = answerText.trim();
                }
            }
        }
        return result;
    }
    /**
     * Build reasoning trace from steps
     */
    buildReasoningTrace(steps) {
        const parts = [];
        for (const step of steps) {
            if (step.type === 'thought') {
                parts.push(`Thought ${step.stepNumber}: ${step.content}`);
            }
            else if (step.type === 'action') {
                parts.push(`Action ${step.stepNumber}: ${step.tool} - ${step.content}`);
            }
            else if (step.type === 'observation') {
                parts.push(`Observation ${step.stepNumber}: ${step.content}`);
            }
        }
        return parts.join('\n');
    }
    /**
     * Extract fallback answer when max iterations reached
     */
    extractFallbackAnswer(input, steps) {
        const result = {};
        // Use the last observation or thought as the answer
        const lastMeaningfulStep = steps
            .reverse()
            .find((s) => s.type === 'observation' || s.type === 'thought');
        if (lastMeaningfulStep) {
            const primaryField = this.signature.outputs.find((f) => !['reasoning', 'steps'].includes(f.name));
            if (primaryField) {
                result[primaryField.name] = lastMeaningfulStep.content;
            }
        }
        return result;
    }
}
exports.ReAct = ReAct;
//# sourceMappingURL=react.js.map