/**
 * Code Scanner - TypeScript AST Analysis for Expert Discovery
 *
 * Scans TypeScript codebases to discover expert classes, prediction methods,
 * and telemetry integration using the TypeScript Compiler API.
 */
export interface DiscoveredExpert {
    className: string;
    filePath: string;
    relativePath: string;
    methods: DiscoveredMethod[];
    imports: ImportInfo[];
    hasTelemetry: boolean;
    hasSupabaseInit: boolean;
    lineNumber: number;
    exportType?: 'default' | 'named' | 'none';
    extendsClass?: string;
    implementsInterfaces?: string[];
}
export interface DiscoveredMethod {
    name: string;
    isAsync: boolean;
    parameters: Parameter[];
    returnType: string;
    lineNumber: number;
    isPredictionMethod: boolean;
    isPublic: boolean;
    isStatic: boolean;
    jsDocComment?: string;
}
export interface Parameter {
    name: string;
    type: string;
    isOptional: boolean;
    hasDefault: boolean;
    defaultValue?: string;
}
export interface ImportInfo {
    moduleName: string;
    importedNames: string[];
    isDefault: boolean;
    isNamespace: boolean;
    lineNumber: number;
}
export interface ScanResult {
    projectPath: string;
    experts: DiscoveredExpert[];
    totalFiles: number;
    scannedFiles: number;
    scanTime: number;
    errors: ScanError[];
    timestamp: Date;
}
export interface ScanError {
    filePath: string;
    error: string;
    lineNumber?: number;
    stack?: string;
}
export interface ScanOptions {
    include?: string[];
    exclude?: string[];
    followSymlinks?: boolean;
    verbose?: boolean;
}
/**
 * Scan an entire project for expert classes and prediction methods
 */
export declare function scanProject(projectPath: string, options?: ScanOptions): Promise<ScanResult>;
/**
 * Scan a single TypeScript file for expert classes
 */
export declare function scanFile(filePath: string, projectRoot?: string): Promise<DiscoveredExpert[]>;
/**
 * Check if a class name matches expert patterns
 */
export declare function isExpertClass(className: string): boolean;
/**
 * Check if a method name is a prediction method
 */
export declare function isPredictionMethod(methodName: string): boolean;
/**
 * Generate a summary report from scan results
 */
export declare function generateSummary(result: ScanResult): string;
/**
 * Filter experts by criteria
 */
export declare function filterExperts(experts: DiscoveredExpert[], criteria: {
    hasTelemetry?: boolean;
    hasSupabaseInit?: boolean;
    hasPredictionMethods?: boolean;
    minMethods?: number;
}): DiscoveredExpert[];
//# sourceMappingURL=code-scanner.d.ts.map