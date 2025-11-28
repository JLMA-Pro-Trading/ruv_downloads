"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.use_mcp_tool = void 0;
exports.use_mcp_tool = jest.fn().mockImplementation(async (params) => {
    switch (params.tool_name) {
        case 'research':
            return {
                result: 'Mocked research results about ' + params.arguments.query,
                metadata: {
                    model: 'gpt-4o-search-preview',
                    timestamp: new Date().toISOString()
                }
            };
        case 'database_query':
            return {
                data: [
                    { id: 1, name: 'Test User 1' },
                    { id: 2, name: 'Test User 2' }
                ],
                metadata: {
                    timestamp: new Date().toISOString(),
                    rowCount: 2
                }
            };
        case 'customer_support':
            return {
                response: 'Here are the steps to reset your password...',
                metadata: {
                    category: params.arguments.context?.category || 'general',
                    priority: params.arguments.priority || 'medium',
                    timestamp: new Date().toISOString(),
                    interactionId: `support_${Date.now()}`
                }
            };
        default:
            throw new Error(`Tool not found: ${params.tool_name}`);
    }
});
//# sourceMappingURL=client.js.map