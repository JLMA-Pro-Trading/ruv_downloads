"use strict";
// Mock MCP client functions
jest.mock('../mcp/client');
// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.SUPABASE_URL = 'test-url';
process.env.SUPABASE_KEY = 'test-key';
//# sourceMappingURL=setup.js.map