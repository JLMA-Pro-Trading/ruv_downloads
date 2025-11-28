import {
  Context,
  Message,
  AgentState,
  UserPreferences,
  AuthInfo
} from '../types';

export class MCPContext implements Context {
  conversation: Message[];
  state: AgentState;
  parent?: Context;

  constructor(parent?: Context) {
    this.conversation = [];
    this.parent = parent;
    this.state = {
      preferences: this.getDefaultPreferences(),
      auth: {},
      collected_info: {},
      previous_actions: [],
      resources: {},
      memory: {}
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      language: "en",
      notifications: true,
      theme: "light"
    };
  }

  // Message Management
  addMessage(message: Message): void {
    this.conversation.push(message);
  }

  getConversationHistory(): Message[] {
    return this.conversation;
  }

  // State Management
  setState<K extends keyof AgentState>(key: K, value: AgentState[K]): void {
    this.state[key] = value;
  }

  getState<K extends keyof AgentState>(key: K): AgentState[K] | undefined {
    if (key in this.state) {
      return this.state[key];
    }
    if (this.parent) {
      return this.parent.getState(key);
    }
    return undefined;
  }

  // Resource Management
  setResource(key: string, value: any): void {
    this.state.resources[key] = value;
  }

  getResource(key: string): any {
    return this.state.resources[key] || (this.parent?.getResource(key));
  }

  // Memory Management
  remember(key: string, value: any): void {
    this.state.memory[key] = value;
  }

  recall(key: string): any {
    return this.state.memory[key] || (this.parent?.recall(key));
  }

  // Action Tracking
  trackAction(action: string): void {
    this.state.previous_actions.push(action);
  }

  getActions(): string[] {
    return this.state.previous_actions;
  }

  // Information Collection
  markCollected(field: string): void {
    this.state.collected_info[field] = true;
  }

  isCollected(field: string): boolean {
    return this.state.collected_info[field] || false;
  }

  // Workflow Management
  initializeWorkflow(): void {
    this.state.workflow_id = crypto.randomUUID();
  }

  getWorkflowId(): string | undefined {
    return this.state.workflow_id;
  }

  // Authentication
  setAuth(auth: AuthInfo): void {
    this.state.auth = auth;
  }

  getAuth(): AuthInfo {
    return this.state.auth;
  }

  // Preferences
  setPreferences(prefs: Partial<UserPreferences>): void {
    this.state.preferences = {
      ...this.state.preferences,
      ...prefs
    };
  }

  getPreferences(): UserPreferences {
    return this.state.preferences;
  }

  // Context Hierarchy
  createChild(): Context {
    return new MCPContext(this);
  }

  getParent(): Context | undefined {
    return this.parent;
  }

  // Utility Methods
  clone(): Context {
    const cloned = new MCPContext();
    cloned.conversation = [...this.conversation];
    cloned.state = JSON.parse(JSON.stringify(this.state));
    return cloned;
  }

  clear(): void {
    this.conversation = [];
    this.state = {
      preferences: this.getDefaultPreferences(),
      auth: {},
      collected_info: {},
      previous_actions: [],
      resources: {},
      memory: {}
    };
  }
}
