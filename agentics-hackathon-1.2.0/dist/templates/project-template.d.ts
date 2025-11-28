/**
 * Project template for initializing new hackathon projects
 */
export declare const PACKAGE_JSON_TEMPLATE: (projectName: string, teamName?: string) => {
    name: string;
    version: string;
    description: string;
    type: string;
    main: string;
    scripts: {
        build: string;
        dev: string;
        start: string;
        lint: string;
        test: string;
    };
    keywords: string[];
    author: string;
    license: string;
    dependencies: {};
    devDependencies: {
        typescript: string;
        '@types/node': string;
    };
};
export declare const TSCONFIG_TEMPLATE: {
    compilerOptions: {
        target: string;
        module: string;
        moduleResolution: string;
        lib: string[];
        outDir: string;
        rootDir: string;
        strict: boolean;
        esModuleInterop: boolean;
        skipLibCheck: boolean;
        forceConsistentCasingInFileNames: boolean;
        declaration: boolean;
        sourceMap: boolean;
    };
    include: string[];
    exclude: string[];
};
export declare const INDEX_TS_TEMPLATE = "/**\n * Agentics TV5 Hackathon Project\n *\n * This is your project's main entry point.\n * Start building your agentic AI solution here!\n */\n\nasync function main() {\n  console.log('\uD83D\uDE80 Welcome to the Agentics TV5 Hackathon!');\n  console.log('\uD83D\uDCD6 Documentation: https://agentics.org/hackathon');\n  console.log('\uD83D\uDCAC Discord: https://discord.agentics.org');\n  console.log('');\n  console.log('Start building your agentic AI solution...');\n\n  // Your code here!\n}\n\nmain().catch(console.error);\n";
export declare const GITIGNORE_TEMPLATE = "# Dependencies\nnode_modules/\n\n# Build output\ndist/\nbuild/\n*.tsbuildinfo\n\n# Environment\n.env\n.env.local\n.env.*.local\n\n# IDE\n.idea/\n.vscode/\n*.swp\n*.swo\n\n# OS\n.DS_Store\nThumbs.db\n\n# Logs\n*.log\nnpm-debug.log*\n\n# Testing\ncoverage/\n\n# Temporary\ntmp/\ntemp/\n";
export declare const PROJECT_README_TEMPLATE: (projectName: string, teamName?: string, track?: string) => string;
//# sourceMappingURL=project-template.d.ts.map