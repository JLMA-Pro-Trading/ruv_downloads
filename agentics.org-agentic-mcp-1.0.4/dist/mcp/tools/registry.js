"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
class ToolRegistry {
    tools;
    constructor() {
        this.tools = new Map();
    }
    registerTool(tool) {
        this.validateTool(tool);
        this.tools.set(tool.name, tool);
        if (tool.name === 'summarize') {
            console.error(`Successfully registered tool: ${tool.name}`);
        }
        else {
            console.error('Successfully registered tool:', { name: tool.name });
            console.error('Current tools after registration:', Array.from(this.tools.keys()));
        }
    }
    async executeTool(name, params, context) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool.execute(params, context);
    }
    getTool(name) {
        console.error('Getting tool:', name);
        console.error('Available tools:', Array.from(this.tools.keys()));
        const tool = this.tools.get(name);
        console.error('Found tool:', tool ? tool.name : 'not found');
        return tool;
    }
    listTools() {
        return Array.from(this.tools.values());
    }
    hasTools() {
        return this.tools.size > 0;
    }
    validateTool(tool) {
        if (!tool.name) {
            throw new Error('Tool must have a name');
        }
        if (!tool.description) {
            throw new Error('Tool must have a description');
        }
        if (!tool.inputSchema) {
            throw new Error('Tool must have an input schema');
        }
        if (typeof tool.execute !== 'function') {
            throw new Error('Tool must have an execute function');
        }
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool with name ${tool.name} already exists`);
        }
    }
    validateParams(tool, params) {
        // Basic schema validation
        const schema = tool.inputSchema;
        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in params)) {
                    throw new Error(`Missing required parameter: ${required}`);
                }
            }
        }
        // Type validation for properties
        if (schema.properties) {
            for (const [key, value] of Object.entries(schema.properties)) {
                if (key in params) {
                    const paramValue = params[key];
                    switch (value.type) {
                        case 'string':
                            if (typeof paramValue !== 'string') {
                                throw new Error(`Parameter ${key} must be a string`);
                            }
                            break;
                        case 'number':
                            if (typeof paramValue !== 'number') {
                                throw new Error(`Parameter ${key} must be a number`);
                            }
                            break;
                        case 'boolean':
                            if (typeof paramValue !== 'boolean') {
                                throw new Error(`Parameter ${key} must be a boolean`);
                            }
                            break;
                        case 'object':
                            if (typeof paramValue !== 'object' || paramValue === null) {
                                throw new Error(`Parameter ${key} must be an object`);
                            }
                            break;
                        case 'array':
                            if (!Array.isArray(paramValue)) {
                                throw new Error(`Parameter ${key} must be an array`);
                            }
                            break;
                    }
                }
            }
        }
    }
    async executeToolWithValidation(name, params, context) {
        console.error('Executing tool with validation:', { name, params });
        console.error('Available tools:', Array.from(this.tools.keys()));
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
        }
        console.error('Found tool:', { name: tool.name, description: tool.description });
        this.validateParams(tool, params);
        try {
            console.error('Executing tool with params:', params);
            const result = await tool.execute(params, context);
            console.error('Tool execution successful');
            return result;
        }
        catch (error) {
            console.error('Tool execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Tool execution failed: ${errorMessage}`);
        }
    }
    clear() {
        this.tools.clear();
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=registry.js.map