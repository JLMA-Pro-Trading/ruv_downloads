"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchTool = void 0;
const openai_1 = require("openai");
class WebSearchTool {
    name = 'websearch';
    description = 'Search the web for the latest information on any topic';
    inputSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query'
            },
            context_size: {
                type: 'string',
                description: 'Amount of context to retrieve from the web',
                enum: ['low', 'medium', 'high'],
                default: 'medium'
            },
            country: {
                type: 'string',
                description: 'Two-letter ISO country code for location-based results'
            },
            city: {
                type: 'string',
                description: 'City name for location-based results'
            },
            region: {
                type: 'string',
                description: 'Region/state name for location-based results'
            }
        },
        required: ['query']
    };
    openai;
    constructor(apiKey) {
        this.openai = new openai_1.OpenAI({ apiKey });
    }
    async execute(params, context) {
        try {
            // Track search initiation
            context.trackAction('websearch_started');
            // Prepare web search options
            const webSearchOptions = {
                search_context_size: params.context_size || 'medium'
            };
            // Add location if provided
            if (params.country || params.city || params.region) {
                webSearchOptions.user_location = {
                    type: 'approximate',
                    approximate: {}
                };
                if (params.country)
                    webSearchOptions.user_location.approximate.country = params.country;
                if (params.city)
                    webSearchOptions.user_location.approximate.city = params.city;
                if (params.region)
                    webSearchOptions.user_location.approximate.region = params.region;
            }
            // Prepare request options - explicitly only include supported parameters
            const requestOptions = {
                model: 'gpt-4o-search-preview',
                web_search_options: webSearchOptions,
                messages: [
                    {
                        role: 'user',
                        content: params.query
                    }
                ]
            };
            // Log the request for debugging
            console.error('WebSearch request options:', JSON.stringify(requestOptions, null, 2));
            // Make the API call using raw fetch to avoid any middleware that might add temperature
            const apiKey = process.env.OPENAI_API_KEY;
            const url = 'https://api.openai.com/v1/chat/completions';
            const fetchResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestOptions)
            });
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                console.error('OpenAI API error:', fetchResponse.status, errorText);
                throw new Error(`OpenAI API error: ${fetchResponse.status} ${errorText}`);
            }
            const responseData = await fetchResponse.json();
            // Extract content and citations
            const content = responseData.choices[0].message.content;
            const annotations = responseData.choices[0].message.annotations || [];
            // Format the response
            const formattedResponse = this.formatResponse(content, params.query, annotations);
            // Track search completion
            context.trackAction('websearch_completed');
            return {
                result: formattedResponse,
                metadata: {
                    query: params.query,
                    context_size: params.context_size || 'medium',
                    citations_count: annotations.length,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            console.error('Web search error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Web search failed: ${errorMessage}`);
        }
    }
    formatResponse(content, query, annotations = []) {
        if (!content) {
            return 'No search results available.';
        }
        const header = `
Web Search Results
Query: ${query}
Date: ${new Date().toISOString()}
${'-'.repeat(50)}

`;
        let formattedResponse = header + content;
        // Add citations section if available
        if (annotations.length > 0) {
            formattedResponse += `\n\n${'-'.repeat(50)}\nSources:\n`;
            // Extract and format URL citations
            const urlCitations = annotations
                .filter(citation => citation.type === 'url_citation')
                .map(citation => citation.url_citation);
            // Add numbered list of sources
            urlCitations.forEach((citation, index) => {
                formattedResponse += `${index + 1}. ${citation.title || 'Untitled'}: ${citation.url}\n`;
            });
        }
        return formattedResponse;
    }
}
exports.WebSearchTool = WebSearchTool;
//# sourceMappingURL=websearch.js.map