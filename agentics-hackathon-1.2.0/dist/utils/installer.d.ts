/**
 * Tool installation utilities
 */
import type { Tool, InstallProgress } from '../types.js';
export declare function checkToolInstalled(tool: Tool): Promise<boolean>;
export declare function installTool(tool: Tool): Promise<InstallProgress>;
export declare function runCommand(command: string): Promise<string>;
export declare function checkPrerequisites(): Promise<{
    node: boolean;
    npm: boolean;
    python: boolean;
    pip: boolean;
    git: boolean;
}>;
//# sourceMappingURL=installer.d.ts.map