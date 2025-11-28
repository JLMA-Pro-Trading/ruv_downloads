import { AgentDBManager } from '../storage/agentdb-integration.js';
import type { DecisionDraftRecord } from '../types/supabase-types.js';
export declare class DraftDecisionStore {
    private readonly db;
    private readonly prefix;
    constructor(db?: AgentDBManager);
    createDraft(draft: DecisionDraftRecord): Promise<DecisionDraftRecord>;
    updateStatus(id: string, status: DecisionDraftRecord['status']): Promise<DecisionDraftRecord | null>;
    getDraft(id: string): Promise<DecisionDraftRecord | null>;
    listDrafts(status?: DecisionDraftRecord['status']): Promise<DecisionDraftRecord[]>;
}
//# sourceMappingURL=DraftDecisionStore.d.ts.map