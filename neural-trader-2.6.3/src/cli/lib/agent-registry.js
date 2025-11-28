/**
 * Agent Registry - Agent type definitions and management
 * STUB IMPLEMENTATION - To be completed
 */

class AgentRegistry {
  constructor() {
    this.agentTypes = new Map([
      ['trader', { name: 'Trader', description: 'Trading execution agent' }],
      ['analyzer', { name: 'Analyzer', description: 'Market analysis agent' }],
      ['risk-manager', { name: 'Risk Manager', description: 'Risk management agent' }],
      ['monitor', { name: 'Monitor', description: 'System monitoring agent' }]
    ]);

    this.instances = new Map();
  }

  /**
   * Register agent type
   */
  registerType(type, definition) {
    this.agentTypes.set(type, definition);

    return {
      success: true,
      type,
      definition
    };
  }

  /**
   * Get agent type definition
   */
  getType(type) {
    return this.agentTypes.get(type) || null;
  }

  /**
   * List all agent types
   */
  listTypes() {
    return Array.from(this.agentTypes.entries()).map(([type, def]) => ({
      type,
      ...def
    }));
  }

  /**
   * Register agent instance
   */
  register(agentId, agent) {
    this.instances.set(agentId, {
      ...agent,
      registeredAt: new Date()
    });

    return {
      success: true,
      agentId
    };
  }

  /**
   * Unregister agent instance
   */
  unregister(agentId) {
    const existed = this.instances.delete(agentId);

    return {
      success: existed,
      message: existed ? 'Agent unregistered' : 'Agent not found'
    };
  }

  /**
   * Get agent instance
   */
  get(agentId) {
    return this.instances.get(agentId) || null;
  }

  /**
   * List all registered instances
   */
  list() {
    return Array.from(this.instances.values());
  }

  /**
   * Find agents by type
   */
  findByType(type) {
    return Array.from(this.instances.values())
      .filter(agent => agent.type === type);
  }
}

module.exports = { AgentRegistry };
