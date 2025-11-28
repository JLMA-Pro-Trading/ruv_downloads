import { MCPTool, Context } from '../../types';

export class HandoffTool implements MCPTool {
  name = 'handoff_to_agent';
  description = 'Transfer the conversation to another specialized agent';
  inputSchema = {
    type: 'object',
    properties: {
      agent_name: {
        type: 'string',
        description: 'The name of the agent to hand off to',
        enum: ['researcher', 'database_expert', 'customer_support']
      },
      reason: {
        type: 'string',
        description: 'The reason for the handoff'
      }
    },
    required: ['agent_name', 'reason']
  };

  async execute(params: {
    agent_name: string;
    reason: string;
  }, context: Context): Promise<any> {
    // Track the handoff action
    context.trackAction('handoff_initiated');
    context.remember(`handoff_${Date.now()}`, {
      to_agent: params.agent_name,
      reason: params.reason
    });

    return {
      status: 'success',
      message: `Handing off to ${params.agent_name} agent. Reason: ${params.reason}`,
      metadata: {
        timestamp: new Date().toISOString(),
        target_agent: params.agent_name,
        reason: params.reason,
        workflow_id: context.getWorkflowId()
      }
    };
  }
}
