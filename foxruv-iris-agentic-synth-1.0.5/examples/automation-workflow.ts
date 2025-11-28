/**
 * Agentic-Robotics Automation Workflow Example
 *
 * Demonstrates workflow creation, task orchestration, event-driven automation,
 * state management, and error recovery.
 */

// Mock workflow types
interface WorkflowStep {
  id: string;
  action: (context: any) => Promise<any>;
  dependencies?: string[];
  onError?: (error: Error, context: any) => Promise<any>;
  repeat?: (context: any) => boolean;
}

interface WorkflowConfig {
  name: string;
  steps: WorkflowStep[];
  initialState?: any;
  errorHandling?: {
    strategy: 'retry' | 'skip' | 'abort';
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
  };
}

// Mock workflow executor
async function createWorkflow(config: WorkflowConfig) {
  return {
    name: config.name,
    execute: async (input: any = {}) => {
      const context = {
        input,
        state: config.initialState || {},
        results: {},
        retries: 0
      };

      for (const step of config.steps) {
        try {
          const result = await step.action(context);
          context.results[step.id] = result;

          if (result.state) {
            context.state = { ...context.state, ...result.state };
          }
        } catch (error) {
          if (step.onError) {
            await step.onError(error as Error, context);
          } else {
            throw error;
          }
        }
      }

      return context.results;
    }
  };
}

// Example 1: Basic Workflow
async function basicWorkflow() {
  console.log('=== Example 1: Basic Workflow ===\n');

  const workflow = await createWorkflow({
    name: 'prompt-generation',
    steps: [
      {
        id: 'initialize',
        action: async (context) => {
          console.log('Step 1: Initializing...');
          return { initialized: true, timestamp: Date.now() };
        }
      },
      {
        id: 'generate',
        action: async (context) => {
          console.log('Step 2: Generating prompts...');
          const prompts = [
            'Create a story about AI',
            'Explain quantum computing',
            'Design a sustainable city'
          ];
          return { prompts, count: prompts.length };
        }
      },
      {
        id: 'validate',
        action: async (context) => {
          console.log('Step 3: Validating prompts...');
          const prompts = context.results.generate.prompts;
          const valid = prompts.filter((p: string) => p.length > 10);
          return { valid: valid.length, total: prompts.length };
        }
      }
    ]
  });

  const result = await workflow.execute();
  console.log('\nWorkflow completed:', JSON.stringify(result, null, 2));
  console.log('');
}

// Example 2: Task Dependencies
async function taskDependencies() {
  console.log('=== Example 2: Task Dependencies ===\n');

  const workflow = await createWorkflow({
    name: 'dependent-tasks',
    steps: [
      {
        id: 'A',
        action: async () => {
          console.log('Task A: Starting...');
          await new Promise(resolve => setTimeout(resolve, 100));
          return { value: 'A complete' };
        },
        dependencies: []
      },
      {
        id: 'B',
        action: async (context) => {
          console.log('Task B: Starting (depends on A)...');
          const aResult = context.results.A.value;
          return { value: `B complete (after ${aResult})` };
        },
        dependencies: ['A']
      },
      {
        id: 'C',
        action: async (context) => {
          console.log('Task C: Starting (depends on A)...');
          return { value: 'C complete' };
        },
        dependencies: ['A']
      },
      {
        id: 'D',
        action: async (context) => {
          console.log('Task D: Starting (depends on B and C)...');
          return { value: 'D complete' };
        },
        dependencies: ['B', 'C']
      }
    ]
  });

  const result = await workflow.execute();
  console.log('\nExecution order: A -> B, C (parallel) -> D');
  console.log('Results:', JSON.stringify(result, null, 2));
  console.log('');
}

// Example 3: State Management
async function stateManagement() {
  console.log('=== Example 3: State Management ===\n');

  const workflow = await createWorkflow({
    name: 'stateful-evolution',
    initialState: {
      iteration: 0,
      bestScore: 0,
      prompts: []
    },
    steps: [
      {
        id: 'generate',
        action: async (context) => {
          const iteration = context.state.iteration + 1;
          const prompt = `Prompt v${iteration}`;
          const score = 0.5 + Math.random() * 0.5;

          console.log(`Iteration ${iteration}: Generated "${prompt}" (score: ${score.toFixed(2)})`);

          return {
            state: {
              iteration,
              bestScore: Math.max(context.state.bestScore, score),
              prompts: [...context.state.prompts, { prompt, score }]
            }
          };
        },
        repeat: (context) => context.state.iteration < 5
      }
    ]
  });

  const result = await workflow.execute();
  console.log(`\nEvolution complete:`);
  console.log(`  Iterations: ${result.generate.state.iteration}`);
  console.log(`  Best score: ${result.generate.state.bestScore.toFixed(2)}`);
  console.log('');
}

// Example 4: Error Recovery
async function errorRecovery() {
  console.log('=== Example 4: Error Recovery ===\n');

  let attempts = 0;

  const workflow = await createWorkflow({
    name: 'resilient',
    errorHandling: {
      strategy: 'retry',
      maxRetries: 3,
      backoff: 'exponential'
    },
    steps: [
      {
        id: 'risky-operation',
        action: async () => {
          attempts++;
          console.log(`Attempt ${attempts}...`);

          if (attempts < 3) {
            throw new Error('Transient failure');
          }

          return { success: true };
        },
        onError: async (error, context) => {
          console.log(`  ❌ Error: ${error.message}`);

          if (context.retries < 2) {
            const delay = Math.pow(2, context.retries) * 100;
            console.log(`  ⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            context.retries++;
          }
        }
      }
    ]
  });

  const result = await workflow.execute();
  console.log(`\nSuccess after ${attempts} attempts`);
  console.log('');
}

// Example 5: Event-Driven Automation
async function eventDrivenAutomation() {
  console.log('=== Example 5: Event-Driven Automation ===\n');

  // Mock event emitter
  const events: string[] = [];
  const automation = {
    triggers: [
      {
        event: 'prompt-generated',
        condition: (data: any) => data.quality > 0.8,
        action: async (data: any) => {
          events.push(`High quality prompt stored: ${data.text}`);
        }
      },
      {
        event: 'prompt-generated',
        condition: (data: any) => data.quality <= 0.5,
        action: async (data: any) => {
          events.push(`Low quality prompt rejected: ${data.text}`);
        }
      },
      {
        event: 'batch-complete',
        action: async (data: any) => {
          events.push(`Batch of ${data.count} prompts processed`);
        }
      }
    ],
    emit: async (event: string, data: any) => {
      for (const trigger of automation.triggers) {
        if (trigger.event === event) {
          if (!trigger.condition || trigger.condition(data)) {
            await trigger.action(data);
          }
        }
      }
    }
  };

  // Simulate events
  await automation.emit('prompt-generated', { text: 'Amazing prompt', quality: 0.9 });
  await automation.emit('prompt-generated', { text: 'Poor prompt', quality: 0.3 });
  await automation.emit('prompt-generated', { text: 'Decent prompt', quality: 0.6 });
  await automation.emit('batch-complete', { count: 3 });

  console.log('Events processed:');
  events.forEach(e => console.log(`  - ${e}`));
  console.log('');
}

// Example 6: Complex Orchestration
async function complexOrchestration() {
  console.log('=== Example 6: Complex Orchestration ===\n');

  const workflow = await createWorkflow({
    name: 'complex-pipeline',
    initialState: {
      generatedCount: 0,
      validatedCount: 0,
      storedCount: 0
    },
    steps: [
      {
        id: 'batch-generate',
        action: async (context) => {
          console.log('Generating batch of prompts...');
          const count = 10;
          return {
            prompts: Array.from({ length: count }, (_, i) => ({
              id: i,
              text: `Prompt ${i}`,
              quality: Math.random()
            })),
            state: { generatedCount: count }
          };
        }
      },
      {
        id: 'validate',
        action: async (context) => {
          console.log('Validating prompts...');
          const prompts = context.results['batch-generate'].prompts;
          const valid = prompts.filter((p: any) => p.quality > 0.5);
          console.log(`  ${valid.length}/${prompts.length} prompts passed validation`);
          return {
            validPrompts: valid,
            state: { validatedCount: valid.length }
          };
        }
      },
      {
        id: 'store',
        action: async (context) => {
          console.log('Storing valid prompts...');
          const prompts = context.results.validate.validPrompts;
          // Simulate storage
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            state: { storedCount: prompts.length }
          };
        }
      },
      {
        id: 'report',
        action: async (context) => {
          console.log('\nPipeline Report:');
          console.log(`  Generated: ${context.state.generatedCount}`);
          console.log(`  Validated: ${context.state.validatedCount}`);
          console.log(`  Stored: ${context.state.storedCount}`);
          console.log(`  Success rate: ${(context.state.storedCount / context.state.generatedCount * 100).toFixed(1)}%`);
          return { success: true };
        }
      }
    ]
  });

  await workflow.execute();
  console.log('');
}

// Run all examples
async function main() {
  await basicWorkflow();
  await taskDependencies();
  await stateManagement();
  await errorRecovery();
  await eventDrivenAutomation();
  await complexOrchestration();

  console.log('All automation examples completed!');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicWorkflow,
  taskDependencies,
  stateManagement,
  errorRecovery,
  eventDrivenAutomation,
  complexOrchestration
};
