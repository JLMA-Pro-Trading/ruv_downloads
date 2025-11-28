#!/usr/bin/env node
import { Command } from 'commander';
import axios from 'axios';
const program = new Command();
program
    .name('aidefence')
    .description('AI Defence CLI - Protect intelligent systems from manipulation')
    .version('2.1.0');
program
    .command('detect')
    .description('Detect threats in text input')
    .argument('<text>', 'Text to analyze for threats')
    .option('-u, --url <url>', 'AIMDS Gateway URL', 'http://localhost:3000')
    .option('-v, --verbose', 'Verbose output')
    .action(async (text, options) => {
    try {
        const response = await axios.post(`${options.url}/api/v1/defend`, {
            action: {
                type: 'analyze',
                text: text
            },
            source: {
                ip: '127.0.0.1',
                userAgent: 'aidefence-cli/2.1.0'
            }
        });
        if (options.verbose) {
            console.log(JSON.stringify(response.data, null, 2));
        }
        else {
            const { threat, confidence, detectionTime } = response.data;
            console.log(`Threat: ${threat}`);
            console.log(`Confidence: ${(confidence * 100).toFixed(2)}%`);
            console.log(`Detection Time: ${detectionTime}ms`);
        }
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error: ${error.message}`);
            if (error.response) {
                console.error(`Status: ${error.response.status}`);
                console.error(`Details: ${JSON.stringify(error.response.data)}`);
            }
        }
        else {
            console.error(`Unexpected error: ${error}`);
        }
        process.exit(1);
    }
});
program
    .command('analyze')
    .description('Analyze text for prompt injection patterns')
    .argument('<text>', 'Text to analyze')
    .option('-u, --url <url>', 'AIMDS Gateway URL', 'http://localhost:3000')
    .option('-d, --deep', 'Enable deep analysis with behavioral and formal verification')
    .action(async (text, options) => {
    try {
        const response = await axios.post(`${options.url}/api/v1/analyze`, {
            text,
            deepAnalysis: options.deep || false
        });
        console.log('Analysis Results:');
        console.log(`- Threat Level: ${response.data.threatLevel}`);
        console.log(`- Patterns Detected: ${response.data.patternsDetected.join(', ')}`);
        console.log(`- PII Found: ${response.data.piiFound ? 'Yes' : 'No'}`);
        console.log(`- Analysis Time: ${response.data.analysisTime}ms`);
        if (options.deep && response.data.formalVerification) {
            console.log('\nFormal Verification:');
            console.log(`- Policy Violations: ${response.data.formalVerification.violations}`);
            console.log(`- Proof Status: ${response.data.formalVerification.proofStatus}`);
        }
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error: ${error.message}`);
        }
        else {
            console.error(`Unexpected error: ${error}`);
        }
        process.exit(1);
    }
});
program
    .command('server')
    .description('Start AIMDS Gateway server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
    .action(async (options) => {
    console.log(`To start the server manually, run:`);
    console.log(`  PORT=${options.port} HOST=${options.host} npm start`);
    process.exit(0);
});
program
    .command('version')
    .description('Display version information')
    .action(() => {
    console.log('AI Defence v2.1.0');
    console.log('Production-ready adversarial defense system');
    console.log('https://ruv.io/aimds');
});
program.parse();
//# sourceMappingURL=cli.js.map