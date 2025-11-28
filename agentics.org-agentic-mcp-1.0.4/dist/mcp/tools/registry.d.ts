import { MCPTool, Context } from '../../types';
export declare class ToolRegistry {
    private tools;
    constructor();
    registerTool(tool: MCPTool): void;
    executeTool(name: string, params: any, context: Context): Promise<any>;
    getTool(name: string): MCPTool | undefined;
    listTools(): MCPTool[];
    hasTools(): boolean;
    private validateTool;
    private validateParams;
    executeToolWithValidation(name: string, params: any, context: Context): Promise<any>;
    clear(): void;
}
