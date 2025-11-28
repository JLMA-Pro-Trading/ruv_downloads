/**
 * Iris Instrument Command
 * 
 * Provides guidance on how to instrument AI functions with AgentDB telemetry.
 * 
 * @module scripts/iris/iris-instrument
 */

import chalk from 'chalk';

export default async function instrument(_options: { project?: string }) {
    console.log(chalk.blue('\n⚙️ Iris Instrumentation Guide\n'));
    console.log('To enable Iris to learn from your AI functions, you need to add AgentDB tracking.');
    console.log('This involves adding a few lines of code to your AI function where decisions are made.');
    
    console.log(chalk.yellow('\n--- Manual Instrumentation Steps ---'));
    
    console.log('\n1.  **Import AgentDB:**');
    console.log(chalk.cyan('    import { recordDecision } from "@foxruv/iris/agentdb";'));
    
    console.log('\n2.  **Record Decisions:**');
    console.log('    Inside your AI function (e.g., a trading strategy, a prompt generation function), call `recordDecision` whenever a significant AI decision is made.');
    console.log(chalk.green('\n    Example:'));
    console.log(chalk.yellow('    ```typescript'));
    console.log(chalk.yellow('    async function yourAIStrategy(input: any): Promise<Output> {'));
    console.log(chalk.yellow('        // ... AI logic to make a decision ...'));
    console.log(chalk.yellow('        const decisionOutput = await llm.generate(prompt);'));
    console.log(chalk.yellow('        const outcome = calculateOutcome(decisionOutput); // e.g., profit/loss, accuracy'));
    console.log('');
    console.log(chalk.cyan('        await recordDecision({'));
    console.log(chalk.cyan('            expertId: "your-strategy-v1",'));
    console.log(chalk.cyan('            input: input,'));
    console.log(chalk.cyan('            decision: decisionOutput,'));
    console.log(chalk.cyan('            outcome: outcome,'));
    console.log(chalk.cyan('            metadata: { confidence: 0.9, market_state: "bullish" }'));
    console.log(chalk.cyan('        });'));
    console.log('');
    console.log(chalk.yellow('        return decisionOutput;'));
    console.log(chalk.yellow('    }'));
    console.log(chalk.yellow('    ```'));

    console.log('\n3.  **Define Expert ID:**');
    console.log('    Use a unique `expertId` for each distinct AI function or strategy version. This helps Iris track learning curves.');

    console.log('\n4.  **Verify Tracking:**');
    console.log(chalk.cyan('    npx iris health --detailed'));
    console.log('    Look for "Decisions Tracked" metrics.');

    console.log(chalk.green('\n💡 Tip: The `iris-expert` agent can help you automate this process.'));
    console.log(chalk.cyan('    Spawn the agent and ask: "Show me how to add telemetry to my [function_name] function."'));
    console.log('');
}
