"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizeTool = void 0;
const openai_1 = require("openai");
class SummarizeTool {
    name = 'summarize';
    description = 'Create concise summaries of text content with key points and insights';
    inputSchema = {
        type: 'object',
        properties: {
            content: {
                type: 'string',
                description: 'The text content to summarize'
            },
            format: {
                type: 'string',
                description: 'Format of the summary',
                enum: ['bullet_points', 'narrative', 'outline'],
                default: 'bullet_points'
            },
            max_length: {
                type: 'number',
                description: 'Maximum length of summary in words',
                default: 250
            },
            include_key_quotes: {
                type: 'boolean',
                description: 'Whether to include important quotes from the original text',
                default: false
            }
        },
        required: ['content']
    };
    openai;
    constructor(apiKey) {
        this.openai = new openai_1.OpenAI({ apiKey });
    }
    async execute(params, context) {
        try {
            // Track summarization start
            context.trackAction('summarization_started');
            context.remember(`summary_${Date.now()}`, {
                content_length: params.content.length,
                format: params.format || 'bullet_points'
            });
            // Construct the summarization prompt
            const prompt = this.constructSummaryPrompt(params);
            // Generate summary using GPT-4
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating clear, concise summaries that capture the essential information and insights from text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });
            const summary = response.choices[0].message.content;
            // Format the summary
            const formattedSummary = this.formatSummary(summary, params);
            // Track summarization completion
            context.trackAction('summarization_completed');
            return {
                summary: formattedSummary,
                metadata: {
                    original_length: params.content.length,
                    summary_length: formattedSummary.length,
                    format: params.format || 'bullet_points',
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            console.error('Summarization error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Summarization failed: ${errorMessage}`);
        }
    }
    constructSummaryPrompt(params) {
        let prompt = `Please summarize the following text:\n\n${params.content}\n\n`;
        prompt += `Format the summary as ${params.format || 'bullet points'}.\n`;
        if (params.max_length) {
            prompt += `Keep the summary under ${params.max_length} words.\n`;
        }
        if (params.include_key_quotes) {
            prompt += `Include 2-3 important quotes from the original text.\n`;
        }
        prompt += `\nPlease include:\n`;
        prompt += `1. Main ideas and key points\n`;
        prompt += `2. Important details and supporting information\n`;
        prompt += `3. Any significant conclusions or implications\n`;
        return prompt;
    }
    formatSummary(summary, params) {
        if (!summary) {
            return 'No summary available.';
        }
        const header = `
Summary
Format: ${params.format || 'bullet points'}
Date: ${new Date().toISOString()}
${'-'.repeat(50)}

`;
        return header + summary;
    }
}
exports.SummarizeTool = SummarizeTool;
//# sourceMappingURL=summarize.js.map