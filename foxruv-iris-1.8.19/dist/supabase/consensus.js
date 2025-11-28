/**
 * Consensus lineage utilities for tracking multi-expert decisions
 */
import { getSupabase, getProjectId, getTenantId, isSupabaseInitialized } from './client.js';
import { withRetry } from './retry-wrapper.js';
/**
 * Record a consensus decision from multiple experts
 */
export async function recordConsensusLineage(sectionTag, contributingExperts, finalDecision, confidence, options) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const project = getProjectId();
        const tenantId = getTenantId();
        const { data, error } = await supabase
            .from('consensus_lineage')
            .insert({
            tenant_id: tenantId,
            project,
            section_tag: sectionTag,
            task_id: options?.taskId,
            run_id: options?.runId,
            contributing_experts: contributingExperts,
            winning_version: options?.winningVersion,
            confidence,
            final_decision: finalDecision,
            disagreement_score: options?.disagreementScore,
            reasoning_chains: options?.reasoningChains,
            metadata: options?.metadata,
        })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get consensus history for a section/tag
 */
export async function getConsensusHistory(sectionTag, limit = 50) {
    // Return empty array if Supabase not initialized (fallback mode)
    if (!isSupabaseInitialized()) {
        return [];
    }
    return await withRetry(async () => {
        const supabase = getSupabase();
        const project = getProjectId();
        const { data, error } = await supabase
            .from('consensus_lineage')
            .select('*')
            .eq('project', project)
            .eq('section_tag', sectionTag)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        return data || [];
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get consensus decision by task or run ID
 */
export async function getConsensusForTask(taskId) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const project = getProjectId();
        const { data, error } = await supabase
            .from('consensus_lineage')
            .select('*')
            .eq('project', project)
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data;
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Calculate consensus from expert votes
 * Uses weighted voting based on confidence
 */
export function calculateConsensus(experts, votingStrategy = 'weighted') {
    if (experts.length === 0) {
        throw new Error('No experts provided for consensus');
    }
    if (votingStrategy === 'highest-confidence') {
        const winner = experts.reduce((prev, current) => current.confidence > prev.confidence ? current : prev);
        return {
            winningVote: winner.vote,
            winningExpert: winner.expertId,
            confidence: winner.confidence,
            disagreementScore: calculateDisagreement(experts),
        };
    }
    if (votingStrategy === 'majority') {
        const voteCounts = new Map();
        experts.forEach((e) => {
            const voteKey = JSON.stringify(e.vote);
            voteCounts.set(voteKey, (voteCounts.get(voteKey) || 0) + 1);
        });
        const [winningVoteKey, _count] = Array.from(voteCounts.entries()).reduce((a, b) => b[1] > a[1] ? b : a);
        const winningVote = JSON.parse(winningVoteKey);
        const winnersWithVote = experts.filter((e) => JSON.stringify(e.vote) === winningVoteKey);
        const avgConfidence = winnersWithVote.reduce((sum, e) => sum + e.confidence, 0) /
            winnersWithVote.length;
        return {
            winningVote,
            winningExpert: winnersWithVote[0].expertId,
            confidence: avgConfidence,
            disagreementScore: calculateDisagreement(experts),
        };
    }
    // Weighted voting (default)
    const totalWeight = experts.reduce((sum, e) => sum + e.confidence, 0);
    const votes = new Map();
    experts.forEach((e) => {
        const voteKey = JSON.stringify(e.vote);
        const current = votes.get(voteKey) || { weight: 0, experts: [] };
        current.weight += e.confidence;
        current.experts.push(e.expertId);
        votes.set(voteKey, current);
    });
    const [winningVoteKey, winningData] = Array.from(votes.entries()).reduce((a, b) => b[1].weight > a[1].weight ? b : a);
    return {
        winningVote: JSON.parse(winningVoteKey),
        winningExpert: winningData.experts[0],
        confidence: winningData.weight / totalWeight,
        disagreementScore: calculateDisagreement(experts),
    };
}
/**
 * Calculate disagreement score (0 = unanimous, 1 = maximum conflict)
 */
function calculateDisagreement(experts) {
    if (experts.length <= 1)
        return 0;
    const votes = new Map();
    experts.forEach((e) => {
        const voteKey = JSON.stringify(e.vote);
        votes.set(voteKey, (votes.get(voteKey) || 0) + 1);
    });
    const uniqueVotes = votes.size;
    // Normalized entropy-based disagreement
    const total = experts.length;
    let entropy = 0;
    for (const count of votes.values()) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(uniqueVotes);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
}
/**
 * Get expert participation stats
 */
export async function getExpertParticipationStats(expertId, options) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const project = getProjectId();
        let query = supabase
            .from('consensus_lineage')
            .select('*')
            .eq('project', project);
        if (options?.startDate) {
            query = query.gte('created_at', options.startDate.toISOString());
        }
        if (options?.endDate) {
            query = query.lte('created_at', options.endDate.toISOString());
        }
        const { data, error } = await query;
        if (error)
            throw error;
        if (!data || data.length === 0) {
            return {
                totalConsensus: 0,
                timesWon: 0,
                avgConfidence: 0,
                avgDisagreement: 0,
                winRate: 0,
            };
        }
        // Filter consensus where expert participated
        const participated = data.filter((c) => c.contributing_experts.some((e) => e.expertId === expertId || e.expert_id === expertId));
        const totalConsensus = participated.length;
        if (totalConsensus === 0) {
            return {
                totalConsensus: 0,
                timesWon: 0,
                avgConfidence: 0,
                avgDisagreement: 0,
                winRate: 0,
            };
        }
        // Count times this expert's vote was the winning vote
        const timesWon = participated.filter((c) => {
            const expertContribution = c.contributing_experts.find((e) => e.expertId === expertId || e.expert_id === expertId);
            if (!expertContribution)
                return false;
            // Simple heuristic: expert won if their vote matches final decision
            return JSON.stringify(expertContribution.vote) === JSON.stringify(c.final_decision);
        }).length;
        const avgConfidence = participated.reduce((sum, c) => {
            const expert = c.contributing_experts.find((e) => e.expertId === expertId || e.expert_id === expertId);
            return sum + (expert?.confidence || 0);
        }, 0) / totalConsensus;
        const avgDisagreement = participated.reduce((sum, c) => sum + (c.disagreement_score || 0), 0) /
            totalConsensus;
        const winRate = timesWon / totalConsensus;
        return {
            totalConsensus,
            timesWon,
            avgConfidence,
            avgDisagreement,
            winRate,
        };
    }, { maxRetries: 3, timeoutMs: 30000 });
}
