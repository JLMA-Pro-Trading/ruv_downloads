"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchTool = void 0;
const openai_1 = require("openai");
class ResearchTool {
    name = 'research';
    description = 'Research a topic using multiple specialized AI agents for comprehensive analysis';
    inputSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The research query or topic'
            },
            depth: {
                type: 'string',
                description: 'Depth of research (brief, detailed, comprehensive)',
                enum: ['brief', 'detailed', 'comprehensive']
            },
            focus_areas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific areas to focus on within the topic'
            }
        },
        required: ['query']
    };
    openai;
    apiKey;
    constructor(apiKey) {
        this.openai = new openai_1.OpenAI({ apiKey });
        this.apiKey = apiKey;
    }
    async execute(params, context) {
        try {
            // Track research initiation
            context.trackAction('research_started');
            context.remember(`research_${Date.now()}`, {
                topic: params.query,
                depth: params.depth || 'detailed'
            });
            // First, get web search results to provide factual context
            console.error('Performing web search for factual context');
            const webSearchResults = await this.performWebSearch(params.query, params.depth || 'detailed');
            // Define specialized research agents
            const agents = this.defineResearchAgents(params, webSearchResults);
            // Determine the number of agents to use based on depth
            const agentCount = params.depth === 'comprehensive' ? agents.length :
                params.depth === 'detailed' ? Math.min(3, agents.length) :
                    Math.min(2, agents.length);
            // Select the most relevant agents for this query
            const selectedAgents = this.selectRelevantAgents(agents, params.query, agentCount);
            console.error(`Selected ${selectedAgents.length} agents for research on: ${params.query}`);
            // Gather insights from each agent in parallel
            const agentPromises = selectedAgents.map(agent => this.getAgentInsights(agent, params, webSearchResults));
            const agentResults = await Promise.all(agentPromises);
            // Synthesize the findings into a cohesive report
            const synthesizedReport = await this.synthesizeFindings(params.query, agentResults, params.depth || 'detailed');
            // Format the final report
            const formattedReport = this.formatReport(synthesizedReport, params, selectedAgents);
            // Track research completion
            context.trackAction('research_completed');
            return {
                report: formattedReport,
                metadata: {
                    topic: params.query,
                    depth: params.depth || 'detailed',
                    focus_areas: params.focus_areas || [],
                    agents_used: selectedAgents.map(a => a.name),
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            console.error('Research error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Research failed: ${errorMessage}`);
        }
    }
    async performWebSearch(query, depth) {
        try {
            console.error(`Performing web search for: ${query}`);
            // Set the search context size based on depth
            const contextSize = depth === 'comprehensive' ? 'high' :
                depth === 'detailed' ? 'medium' : 'low';
            // Make the API call using raw fetch
            const url = 'https://api.openai.com/v1/chat/completions';
            const requestOptions = {
                model: 'gpt-4o-search-preview',
                web_search_options: {
                    search_context_size: contextSize
                },
                messages: [
                    {
                        role: 'user',
                        content: `Research the following topic and provide factual information with citations: ${query}`
                    }
                ],
                max_tokens: 1500
            };
            const fetchResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestOptions)
            });
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                console.error('Web search API error:', fetchResponse.status, errorText);
                throw new Error(`OpenAI API error: ${fetchResponse.status} ${errorText}`);
            }
            const responseData = await fetchResponse.json();
            const content = responseData.choices[0].message.content;
            const annotations = responseData.choices[0].message.annotations || [];
            // Format the web search results with citations
            let formattedResults = `## Web Search Results for "${query}"\n\n${content}\n\n`;
            // Add citations if available
            if (annotations.length > 0) {
                formattedResults += `### Sources:\n`;
                // Extract and format URL citations
                const urlCitations = annotations
                    .filter((citation) => citation.type === 'url_citation')
                    .map((citation) => citation.url_citation);
                // Add numbered list of sources
                urlCitations.forEach((citation, index) => {
                    formattedResults += `${index + 1}. ${citation.title || 'Untitled'}: ${citation.url}\n`;
                });
            }
            return formattedResults;
        }
        catch (error) {
            console.error('Web search error:', error);
            return `[Web search was unable to provide results due to an error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
        }
    }
    defineResearchAgents(params, webSearchResults) {
        // Define specialized agents for different aspects of research
        return [
            {
                name: 'FactFinder',
                role: 'Data Analyst',
                expertise: ['statistics', 'data analysis', 'fact verification'],
                prompt: `As a Data Analyst specializing in fact verification, research the following topic and provide key factual information, statistics, and verified data points: ${params.query}. Focus on accuracy and cite sources where possible.`
            },
            {
                name: 'ContextBuilder',
                role: 'Historical Context Specialist',
                expertise: ['history', 'background information', 'chronology'],
                prompt: `As a Historical Context Specialist, provide the background and historical context for: ${params.query}. Include relevant timelines, evolution of the topic, and how it relates to broader historical trends.`
            },
            {
                name: 'TrendSpotter',
                role: 'Future Trends Analyst',
                expertise: ['forecasting', 'trend analysis', 'future implications'],
                prompt: `As a Future Trends Analyst, identify emerging trends, future directions, and potential developments related to: ${params.query}. Focus on where this topic is heading and its future implications.`
            },
            {
                name: 'CriticalEvaluator',
                role: 'Critical Thinking Specialist',
                expertise: ['critical analysis', 'opposing viewpoints', 'debate'],
                prompt: `As a Critical Thinking Specialist, analyze different perspectives, controversies, and debates surrounding: ${params.query}. Present balanced viewpoints and identify strengths and weaknesses of various positions.`
            },
            {
                name: 'PracticalApplicator',
                role: 'Applications Expert',
                expertise: ['practical applications', 'real-world examples', 'case studies'],
                prompt: `As an Applications Expert, provide real-world examples, case studies, and practical applications of: ${params.query}. Focus on how this topic is applied in practice and its tangible impacts.`
            }
        ];
    }
    selectRelevantAgents(agents, query, count) {
        // In a more sophisticated implementation, this would analyze the query to determine
        // which agents are most relevant. For now, we'll use a simple approach.
        // Always include FactFinder for basic information
        const factFinder = agents.find(a => a.name === 'FactFinder');
        const otherAgents = agents.filter(a => a.name !== 'FactFinder');
        // Shuffle the remaining agents to get some variety
        const shuffled = otherAgents.sort(() => 0.5 - Math.random());
        // Select the required number of agents
        const selected = factFinder ? [factFinder, ...shuffled.slice(0, count - 1)] : shuffled.slice(0, count);
        return selected;
    }
    async getAgentInsights(agent, params, webSearchResults) {
        try {
            console.error(`Agent ${agent.name} researching: ${params.query}`);
            // Enhance the agent's prompt with any focus areas
            let enhancedPrompt = agent.prompt;
            if (params.focus_areas && params.focus_areas.length > 0) {
                enhancedPrompt += `\n\nPlease specifically address these aspects: ${params.focus_areas.join(', ')}.`;
            }
            // Set the response length based on depth
            const maxTokens = params.depth === 'comprehensive' ? 1000 :
                params.depth === 'detailed' ? 600 : 300;
            // Make the API call using raw fetch to avoid any middleware that might add temperature
            const url = 'https://api.openai.com/v1/chat/completions';
            const requestOptions = {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI research assistant specializing as a ${agent.role}. Your expertise includes ${agent.expertise.join(', ')}. Provide concise, informative insights based on your specialized knowledge.`
                    },
                    {
                        role: 'user',
                        content: enhancedPrompt
                    }
                ],
                max_tokens: maxTokens
            };
            const fetchResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestOptions)
            });
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                console.error(`Agent ${agent.name} API error:`, fetchResponse.status, errorText);
                throw new Error(`OpenAI API error: ${fetchResponse.status} ${errorText}`);
            }
            const responseData = await fetchResponse.json();
            const insights = responseData.choices[0].message.content;
            return { agent, insights };
        }
        catch (error) {
            console.error(`Error with agent ${agent.name}:`, error);
            return {
                agent,
                insights: `[${agent.name} was unable to provide insights due to an error: ${error instanceof Error ? error.message : 'Unknown error'}]`
            };
        }
    }
    async synthesizeFindings(query, agentResults, depth) {
        try {
            console.error(`Synthesizing findings from ${agentResults.length} agents`);
            // Prepare the agent insights for the synthesizer
            const agentInsights = agentResults.map(result => `## Insights from ${result.agent.name} (${result.agent.role}):\n${result.insights}`).join('\n\n');
            // Set the synthesis length based on depth
            const maxTokens = depth === 'comprehensive' ? 2000 :
                depth === 'detailed' ? 1200 : 800;
            // Make the API call using raw fetch
            const url = 'https://api.openai.com/v1/chat/completions';
            const requestOptions = {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert research synthesizer. Your task is to combine insights from multiple specialized research agents into a cohesive, well-structured research report. Organize information logically, eliminate redundancies, and ensure a smooth flow between different aspects of the topic.'
                    },
                    {
                        role: 'user',
                        content: `Synthesize the following research insights into a comprehensive report on "${query}". The report should be well-structured with clear sections, an executive summary, key findings, and recommendations if applicable.\n\n${agentInsights}`
                    }
                ],
                max_tokens: maxTokens
            };
            const fetchResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestOptions)
            });
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                console.error('Synthesis API error:', fetchResponse.status, errorText);
                throw new Error(`OpenAI API error: ${fetchResponse.status} ${errorText}`);
            }
            const responseData = await fetchResponse.json();
            return responseData.choices[0].message.content;
        }
        catch (error) {
            console.error('Error synthesizing findings:', error);
            // If synthesis fails, concatenate the agent insights with minimal formatting
            return `# Research Report on ${query}\n\n` +
                agentResults.map(result => `## Insights from ${result.agent.name} (${result.agent.role})\n${result.insights}`).join('\n\n');
        }
    }
    formatReport(report, params, agents) {
        const header = `
Research Report
Topic: ${params.query}
Depth: ${params.depth || 'detailed'}
Date: ${new Date().toISOString()}
${'-'.repeat(50)}

`;
        const agentInfo = `
${'-'.repeat(50)}
Research Methodology:
This report was generated using a multi-agent research approach with the following specialized agents:
${agents.map(agent => `- ${agent.name} (${agent.role}): Expert in ${agent.expertise.join(', ')}`).join('\n')}
${'-'.repeat(50)}

`;
        return header + report + agentInfo;
    }
}
exports.ResearchTool = ResearchTool;
//# sourceMappingURL=research.js.map