"use strict";
/**
 * ReAct Agent Example using DSPy.ts
 *
 * This example demonstrates how to use DSPy.ts to create a ReAct (Reasoning + Acting) agent
 * that uses OpenRouter API for language model inference.
 *
 * ## Setup
 * - Set OPENROUTER_API_KEY environment variable with your OpenRouter API key
 * - (Optional) Set OPENROUTER_MODEL to specify the model (default is "anthropic/claude-3-sonnet:beta")
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterLM = exports.pipeline = void 0;
exports.runAgent = runAgent;
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
const tools = [
    {
        name: "Calculator",
        description: "Performs arithmetic calculations. Usage: Calculator[expression]",
        run: (input) => {
            try {
                if (!/^[0-9.+\-*\/()\s]+$/.test(input)) {
                    return "Invalid expression";
                }
                const result = Function("return (" + input + ")")();
                return String(result);
            }
            catch (err) {
                return "Error: " + err.message;
            }
        }
    },
    {
        name: "DateTool",
        description: "Gets current date or performs date calculations. Usage: DateTool[operation]",
        run: (input) => {
            const now = new Date();
            if (input === "now") {
                return now.toISOString();
            }
            if (input.startsWith("add ")) {
                const [_, amount, unit] = input.match(/add (\d+) (days?|months?|years?)/) || [];
                if (!amount || !unit) {
                    return "Invalid format. Use: add X days/months/years";
                }
                const date = new Date(now);
                switch (unit) {
                    case "day":
                    case "days":
                        date.setDate(date.getDate() + parseInt(amount));
                        break;
                    case "month":
                    case "months":
                        date.setMonth(date.getMonth() + parseInt(amount));
                        break;
                    case "year":
                    case "years":
                        date.setFullYear(date.getFullYear() + parseInt(amount));
                        break;
                }
                return date.toISOString();
            }
            return "Unknown operation. Use 'now' or 'add X days/months/years'";
        }
    }
];
// Create ReAct agent module
class ReActModule extends predict_1.PredictModule {
    constructor(tools, maxSteps = 10) {
        super({
            name: 'ReActAgent',
            signature: {
                inputs: [{ name: 'query', type: 'string' }],
                outputs: [{ name: 'answer', type: 'string' }]
            },
            promptTemplate: ({ query }) => {
                const toolDescriptions = this.tools.map(t => `${t.name}: ${t.description}`).join("\n");
                return `You are a smart assistant with access to the following tools:
${toolDescriptions}

When answering the user, you may use the tools to gather information or calculate results.
Follow this format strictly:
Thought: <your reasoning here>
Action: <ToolName>[<tool input>]
Observation: <result of the tool action>
... (you can repeat Thought/Action/Observation as needed) ...
Thought: <final reasoning>
Answer: <your final answer to the user's query>

Only provide one action at a time, and wait for the observation before continuing.
If the answer is directly known or once you have gathered enough information, output the final Answer.

User Query: ${query}

Thought:`;
            }
        });
        this.tools = tools;
        this.maxSteps = maxSteps;
    }
    async run(input) {
        let messages = [{ role: "user", content: this.promptTemplate(input) }];
        let steps = 0;
        while (steps < this.maxSteps) {
            // Get next step from LM
            const lm = (0, index_1.getLM)();
            const response = await lm.generate(messages[messages.length - 1].content, {
                stopSequences: ["Observation:"]
            });
            // Check for final answer
            const answerMatch = response.match(/Answer:\s*(.*)$/);
            if (answerMatch) {
                return { answer: answerMatch[1].trim() };
            }
            // Look for action to perform
            const actionMatch = response.match(/Action:\s*([^\[]+)\[([^\]]+)\]/);
            if (!actionMatch) {
                return { answer: response.trim() };
            }
            // Execute tool
            const [_, toolName, toolInput] = actionMatch;
            const tool = this.tools.find(t => t.name.toLowerCase() === toolName.trim().toLowerCase());
            let observation;
            if (!tool) {
                observation = `Tool "${toolName}" not found`;
            }
            else {
                try {
                    const result = await tool.run(toolInput.trim());
                    observation = String(result);
                }
                catch (err) {
                    observation = `Error: ${err.message}`;
                }
            }
            // Add to conversation
            messages.push({
                role: "user",
                content: response + "\nObservation: " + observation + "\n\nThought:"
            });
            steps++;
        }
        throw new Error("Agent did not produce a final answer within the step limit.");
    }
}
// Get API credentials from environment
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3-sonnet:beta";
if (!API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
}
// Initialize modules
const reactModule = new ReActModule(tools);
// Create the pipeline
const pipeline = new pipeline_1.Pipeline([reactModule], {
    stopOnError: true,
    debug: true,
    maxRetries: 2
});
exports.pipeline = pipeline;
// Configure the LM
const lm = new OpenRouterLM(API_KEY, MODEL);
(0, index_1.configureLM)(lm);
// Main function to run agent
async function runAgent(query) {
    const result = await pipeline.run({ query });
    if (!result.success) {
        throw result.error;
    }
    return result.finalOutput.answer;
}
// Example usage
async function main() {
    const examples = [
        "What is 25 * 48?",
        "What date will it be in 30 days?",
        "If I invest $1000 with 5% annual interest for 3 years, how much will I have? Show your work.",
        "What will be the date 2 months after I get $1234.56 from a 5% return on investment?"
    ];
    console.log("DSPy.ts ReAct Agent Example\n");
    for (const query of examples) {
        try {
            console.log("Query:", query);
            const answer = await runAgent(query);
            console.log("Answer:", answer);
            console.log();
        }
        catch (err) {
            console.error("Error:", err.message);
            console.log();
        }
    }
}
// Run if executed directly
if (process.argv[1] === __filename) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map