"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPContext = void 0;
class MCPContext {
    conversation;
    state;
    parent;
    constructor(parent) {
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
    getDefaultPreferences() {
        return {
            language: "en",
            notifications: true,
            theme: "light"
        };
    }
    // Message Management
    addMessage(message) {
        this.conversation.push(message);
    }
    getConversationHistory() {
        return this.conversation;
    }
    // State Management
    setState(key, value) {
        this.state[key] = value;
    }
    getState(key) {
        if (key in this.state) {
            return this.state[key];
        }
        if (this.parent) {
            return this.parent.getState(key);
        }
        return undefined;
    }
    // Resource Management
    setResource(key, value) {
        this.state.resources[key] = value;
    }
    getResource(key) {
        return this.state.resources[key] || (this.parent?.getResource(key));
    }
    // Memory Management
    remember(key, value) {
        this.state.memory[key] = value;
    }
    recall(key) {
        return this.state.memory[key] || (this.parent?.recall(key));
    }
    // Action Tracking
    trackAction(action) {
        this.state.previous_actions.push(action);
    }
    getActions() {
        return this.state.previous_actions;
    }
    // Information Collection
    markCollected(field) {
        this.state.collected_info[field] = true;
    }
    isCollected(field) {
        return this.state.collected_info[field] || false;
    }
    // Workflow Management
    initializeWorkflow() {
        this.state.workflow_id = crypto.randomUUID();
    }
    getWorkflowId() {
        return this.state.workflow_id;
    }
    // Authentication
    setAuth(auth) {
        this.state.auth = auth;
    }
    getAuth() {
        return this.state.auth;
    }
    // Preferences
    setPreferences(prefs) {
        this.state.preferences = {
            ...this.state.preferences,
            ...prefs
        };
    }
    getPreferences() {
        return this.state.preferences;
    }
    // Context Hierarchy
    createChild() {
        return new MCPContext(this);
    }
    getParent() {
        return this.parent;
    }
    // Utility Methods
    clone() {
        const cloned = new MCPContext();
        cloned.conversation = [...this.conversation];
        cloned.state = JSON.parse(JSON.stringify(this.state));
        return cloned;
    }
    clear() {
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
exports.MCPContext = MCPContext;
//# sourceMappingURL=context.js.map