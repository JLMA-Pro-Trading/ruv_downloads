/**
 * Relaxed Supabase types to avoid schema drift build failures.
 * These aliases are intentionally broad; tighten as the schema stabilizes.
 */
export type ModelRunLogRow = Record<string, any>;
export type ModelRunLogInsert = Record<string, any>;
export type ModelRunLog = ModelRunLogRow;
export type DecisionDraftRow = Record<string, any>;
export type DecisionDraftInsert = Record<string, any>;
export type DecisionDraftRecord = DecisionDraftRow & {
    status?: 'pending' | 'approved' | 'rejected';
    source?: string;
    type?: string;
};
export type ConsensusLineage = Record<string, any>;
export type ConsensusLineageInsert = Record<string, any>;
export type StoredIrisReport = Record<string, any>;
export type StoredIrisReportInsert = Record<string, any>;
export type ExpertSignatureRow = Record<string, any>;
export type ExpertSignatureInsert = Record<string, any>;
export type ExpertSignature = ExpertSignatureRow;
export type ReflexionBankRow = Record<string, any>;
export type ReflexionBankInsert = Record<string, any>;
export type ReflexionEntry = ReflexionBankRow;
export type SignatureVersion = Record<string, any>;
export type StoredPattern = Record<string, any>;
//# sourceMappingURL=types.d.ts.map