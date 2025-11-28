/**
 * Agent Executor
 * Executes agent flows based on configuration
 */

import { logMessage } from "../../logger.ts";
import {
  AgentConfig,
  AgentContext,
  AgentFlow,
  AgentStep,
  Assistant,
  ChatMessage,
} from "../types.ts";
import { OpenAIProvider } from "../providers/openai-provider.ts";
import { TOOL_DEFINITIONS, TOOLS } from "./tools.ts";

/**
 * Agent executor for running agent flows
 */
export class AgentExecutor {
  private config: AgentConfig;
  private assistants: Record<string, Assistant> = {};

  /**
   * Create a new agent executor
   * @param config Agent configuration
   */
  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Execute an agent flow
   * @param flowName Name of the flow to execute
   * @param context Initial context for the flow
   * @returns The final context after execution
   */
  async executeFlow(flowName: string, context: AgentContext): Promise<AgentContext> {
    const flow = this.config.flows[flowName];

    if (!flow) {
      throw new Error(`Flow not found: ${flowName}`);
    }

    await logMessage("info", `Executing agent flow: ${flowName}`, {
      flowName,
      description: flow.description,
    });

    // Start with the first step
    let currentStep = Object.keys(flow.steps)[0];
    let currentContext = { ...context };

    // Execute steps until we reach the end
    while (currentStep) {
      const step = flow.steps[currentStep];

      await logMessage("info", `Executing step: ${currentStep}`, {
        stepName: currentStep,
        description: step.description,
      });

      // Execute the step
      currentContext = await this.executeStep(step, currentContext);

      // Determine the next step
      const nextStep = flow.transitions[currentStep];

      if (!nextStep) {
        // End of flow
        break;
      }

      currentStep = nextStep;
    }

    await logMessage("info", `Completed agent flow: ${flowName}`, {
      flowName,
      description: flow.description,
    });

    return currentContext;
  }

  /**
   * Execute a single step in a flow
   * @param step The step to execute
   * @param context The current context
   * @returns The updated context
   */
  private async executeStep(step: AgentStep, context: AgentContext): Promise<AgentContext> {
    try {
      if (step.useAssistant) {
        // Use an assistant for this step
        return await this.executeAssistantStep(step, context);
      } else {
        // Use a simple LLM call for this step
        return await this.executeLLMStep(step, context);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", `Failed to execute step: ${step.name}`, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Execute a step using a simple LLM call
   * @param step The step to execute
   * @param context The current context
   * @returns The updated context
   */
  private async executeLLMStep(step: AgentStep, context: AgentContext): Promise<AgentContext> {
    const provider = step.provider;

    // Prepare messages
    const messages: ChatMessage[] = [];

    // Add system message if provided
    if (step.systemPrompt) {
      messages.push({
        role: "system",
        content: step.systemPrompt,
      });
    }

    // Add context message
    messages.push({
      role: "user",
      content: context.input || "",
    });

    // Get completion from provider
    const response = await provider.getChatCompletion(messages, {
      model: step.model,
    });

    // Update context with response
    return {
      ...context,
      output: response.content,
      [step.name]: {
        input: context.input,
        output: response.content,
      },
    };
  }

  /**
   * Execute a step using an assistant
   * @param step The step to execute
   * @param context The current context
   * @returns The updated context
   */
  private async executeAssistantStep(
    step: AgentStep,
    context: AgentContext,
  ): Promise<AgentContext> {
    const provider = step.provider;

    if (!provider.supportsAssistants()) {
      throw new Error(`Provider ${provider.getName()} does not support assistants`);
    }

    if (!(provider instanceof OpenAIProvider)) {
      throw new Error(`Only OpenAI provider supports assistants currently`);
    }

    // Get or create assistant
    let assistant = this.assistants[step.name];

    if (!assistant) {
      assistant = await provider.createAssistant({
        name: `${this.config.name} - ${step.name}`,
        description: step.description || "",
        model: step.model,
        instructions: step.assistantInstructions || "",
        tools: step.tools?.map((toolName) => TOOL_DEFINITIONS[toolName]) || [],
      });

      this.assistants[step.name] = assistant;
    }

    // Create a thread
    const thread = await provider.getClient().beta.threads.create();

    // Add message to thread
    await provider.getClient().beta.threads.messages.create(thread.id, {
      role: "user",
      content: context.input || "",
    });

    // Run the assistant
    const run = await provider.getClient().beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    // Wait for the run to complete
    let runStatus = await provider.getClient().beta.threads.runs.retrieve(thread.id, run.id);

    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      // Check for tool calls
      if (
        runStatus.status === "requires_action" &&
        runStatus.required_action?.type === "submit_tool_outputs"
      ) {
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];

        for (const toolCall of toolCalls) {
          const output = await this.executeToolCall(toolCall, context);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output,
          });
        }

        // Submit tool outputs
        await provider.getClient().beta.threads.runs.submitToolOutputs(thread.id, run.id, {
          tool_outputs: toolOutputs,
        });
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check status again
      runStatus = await provider.getClient().beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === "failed") {
      throw new Error(`Assistant run failed: ${runStatus.last_error?.message || "Unknown error"}`);
    }

    // Get the assistant's response
    const messages = await provider.getClient().beta.threads.messages.list(thread.id);
    const assistantMessages = messages.data.filter((msg) => msg.role === "assistant");

    if (assistantMessages.length === 0) {
      throw new Error("No response from assistant");
    }

    // Get the latest message
    const latestMessage = assistantMessages[0];
    let output = "";

    for (const content of latestMessage.content) {
      if (content.type === "text") {
        output += content.text.value;
      }
    }

    // Update context with response
    return {
      ...context,
      output,
      [step.name]: {
        input: context.input,
        output,
      },
    };
  }

  /**
   * Execute a tool call
   * @param toolCall The tool call to execute
   * @param context The current context
   * @returns The tool call output
   */
  private async executeToolCall(toolCall: any, context: AgentContext): Promise<string> {
    if (toolCall.type !== "function") {
      throw new Error(`Unsupported tool call type: ${toolCall.type}`);
    }

    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    // Execute the tool
    const tool = TOOLS[name];

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await tool(parsedArgs, context);
  }
}
