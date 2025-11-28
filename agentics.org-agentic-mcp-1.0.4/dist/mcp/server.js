"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAgentMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const context_1 = require("./context");
const registry_1 = require("./tools/registry");
const research_1 = require("./tools/research");
const database_1 = require("./tools/database");
const support_1 = require("./tools/support");
const summarize_1 = require("./tools/summarize");
const websearch_1 = require("./tools/websearch");
class OpenAIAgentMCPServer {
    server;
    toolRegistry;
    tracingEnabled;
    config;
    constructor(config) {
        this.config = config;
        this.server = new index_js_1.Server({
            name: config.name,
            version: config.version,
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.toolRegistry = new registry_1.ToolRegistry();
        this.tracingEnabled = config.tracing?.enabled || false;
        // Initialize tools based on configuration
        this.initializeTools(config);
        // Set up request handlers
        this.setupRequestHandlers();
        // Set up error handling
        this.setupErrorHandling();
    }
    initializeTools(config) {
        if (this.tracingEnabled) {
            console.error('Initializing tools with config:', {
                enabled: config.tools.enabled,
                openai: !!config.openai.apiKey,
                database: !!config.tools.config?.database
            });
        }
        for (const toolName of config.tools.enabled) {
            if (this.tracingEnabled) {
                console.error(`Attempting to register tool: ${toolName}`);
            }
            try {
                switch (toolName) {
                    case 'research':
                        this.toolRegistry.registerTool(new research_1.ResearchTool(config.openai.apiKey));
                        break;
                    case 'database_query':
                        const dbConfig = config.tools.config.database;
                        this.toolRegistry.registerTool(new database_1.DatabaseTool(dbConfig.projectId, dbConfig.key));
                        break;
                    case 'customer_support':
                        this.toolRegistry.registerTool(new support_1.SupportTool(config.openai.apiKey));
                        break;
                    case 'summarize':
                        const summarizeTool = new summarize_1.SummarizeTool(config.openai.apiKey);
                        if (this.tracingEnabled) {
                            console.error('Attempting to register tool: summarize');
                        }
                        this.toolRegistry.registerTool(summarizeTool);
                        break;
                    case 'websearch':
                        this.toolRegistry.registerTool(new websearch_1.WebSearchTool(config.openai.apiKey));
                        break;
                    default:
                        if (this.tracingEnabled) {
                            console.error(`Unknown tool: ${toolName}`);
                        }
                }
                if (this.tracingEnabled) {
                    console.error(`Successfully registered tool: ${toolName}`);
                }
            }
            catch (error) {
                console.error(`Failed to register tool ${toolName}:`, error);
            }
        }
        if (this.tracingEnabled) {
            console.error('Final registered tools:', this.toolRegistry.listTools().map(t => t.name));
        }
    }
    setupRequestHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const tools = this.toolRegistry.listTools();
            if (this.tracingEnabled) {
                console.error('Available tools:', tools.map(t => t.name));
            }
            return { tools };
        });
        // Execute tool
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            if (this.tracingEnabled) {
                console.error('Executing tool request:', {
                    name: request.params.name,
                    arguments: request.params.arguments
                });
                console.error('Available tools:', this.toolRegistry.listTools().map(t => t.name));
            }
            const context = new context_1.MCPContext();
            try {
                // Initialize workflow if not exists
                if (!context.getWorkflowId()) {
                    context.initializeWorkflow();
                    if (this.tracingEnabled) {
                        console.error(`Initialized workflow: ${context.getWorkflowId()}`);
                    }
                }
                // Validate tool exists
                if (!request.params.name) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, 'Tool name is required');
                }
                // Execute tool with validation
                const result = await this.toolRegistry.executeToolWithValidation(request.params.name, request.params.arguments, context);
                // Check for handoff request
                if (request.params.name === 'handoff_to_agent') {
                    const handoffResult = result;
                    if (handoffResult.status === 'success') {
                        // Create child context for handoff
                        const handoffContext = new context_1.MCPContext(context);
                        handoffContext.setState('workflow_id', context.getWorkflowId());
                        // Execute tool with new agent
                        const targetResult = await this.toolRegistry.executeToolWithValidation(handoffResult.metadata.target_agent, request.params.arguments, handoffContext);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(targetResult)
                                }
                            ]
                        };
                    }
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result)
                        }
                    ]
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (error instanceof types_js_1.McpError) {
                    throw error;
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
            }
        });
    }
    setupErrorHandling() {
        this.server.onerror = (error) => {
            if (this.tracingEnabled) {
                console.error('[MCP Error]', error);
            }
        };
    }
    registerTool(tool) {
        this.toolRegistry.registerTool(tool);
    }
    async serve() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        if (this.tracingEnabled) {
            console.error(`${this.config.name} MCP server running on stdio`);
        }
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
}
exports.OpenAIAgentMCPServer = OpenAIAgentMCPServer;
//# sourceMappingURL=server.js.map