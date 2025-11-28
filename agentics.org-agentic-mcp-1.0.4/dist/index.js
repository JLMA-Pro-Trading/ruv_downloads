#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const server_1 = require("./mcp/server");
// 🎉 Welcome to OpenAi Agentic MCP, by the Agentics Foundation!
// Created by rUv.
// Let's get started step by step!
// 🔹 Step 1: Load environment variables
(0, dotenv_1.config)();
console.log("🔹 Step 1: Environment variables loaded.");
// 🔹 Step 2: Read necessary environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SB_ACCESS_TOKEN;
if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}
console.log("🔹 Step 2: Environment variables verified.");
// 🔹 Step 3: Initialize OpenAi Agentic MCP Server
const server = new server_1.OpenAIAgentMCPServer({
    name: 'openai-agent',
    version: '1.0.0',
    openai: {
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o-mini'
    },
    tracing: {
        enabled: true,
        level: 'debug'
    },
    tools: {
        enabled: ['research', 'database_query', 'customer_support', 'handoff_to_agent', 'summarize', 'websearch'],
        config: {
            database: {
                projectId: SUPABASE_PROJECT_ID,
                key: SUPABASE_ACCESS_TOKEN
            },
            openai: {
                apiKey: OPENAI_API_KEY
            }
        }
    },
    guardrails: {
        enabled: true,
        rules: []
    }
});
console.log("🔹 Step 3: MCP Server initialized.");
// 🔹 Step 4: Start the MCP Server
console.log("🚀 Starting OpenAi Agentic MCP Server ...");
server.serve().catch(error => {
    console.error("❌ Server error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map