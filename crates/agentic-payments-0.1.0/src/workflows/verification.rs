//! Single signature verification workflow with BFT consensus

use crate::agents::{AgentPool, VerificationTask};
use crate::consensus::{AgentVote, ConsensusResult};
use crate::crypto::Ed25519Signature;
use crate::error::{Error, Result};
use crate::workflows::{WorkflowContext, WorkflowResult};
use ed25519_dalek::VerifyingKey;
use futures::future::join_all;
use std::time::Instant;
use tokio::time::{timeout, Duration};
use tracing::{debug, info};
use uuid::Uuid;

/// Autonomous signature verification workflow
pub struct AutonomousVerificationWorkflow {
    pool: AgentPool,
    consensus_threshold: f64,
    timeout_ms: u64,
}

impl AutonomousVerificationWorkflow {
    /// Create a new autonomous verification workflow
    pub fn new(pool: AgentPool, consensus_threshold: f64, timeout_ms: u64) -> Self {
        Self {
            pool,
            consensus_threshold,
            timeout_ms,
        }
    }

    /// Execute autonomous signature verification with BFT consensus
    pub async fn execute(
        &self,
        message: &[u8],
        signature: &Ed25519Signature,
        public_key: &VerifyingKey,
        context: WorkflowContext,
    ) -> Result<WorkflowResult<ConsensusResult>> {
        let start = Instant::now();

        info!("Starting autonomous verification workflow {}", context.id);

        // Get healthy agents
        let agent_ids = self.pool.get_healthy_agents();
        if agent_ids.is_empty() {
            return Err(Error::PoolExhausted);
        }

        if agent_ids.len() < 3 {
            return Err(Error::Config(
                "BFT requires at least 3 agents".to_string(),
            ));
        }

        debug!("Using {} agents for verification", agent_ids.len());

        // Create verification task
        let task = VerificationTask::new(
            message.to_vec(),
            signature.clone(),
            *public_key,
        );

        // Collect votes from all agents in parallel
        let vote_futures = agent_ids.into_iter().map(|agent_id| {
            let task = task.clone();
            let pool = self.pool.clone();
            let timeout_duration = Duration::from_millis(self.timeout_ms);

            async move {
                Self::collect_agent_vote(pool, agent_id, task, timeout_duration).await
            }
        });

        let votes: Vec<AgentVote> = join_all(vote_futures)
            .await
            .into_iter()
            .flatten()
            .collect();

        if votes.is_empty() {
            let execution_time_ms = start.elapsed().as_millis() as u64;
            return Ok(WorkflowResult::failure(
                context,
                ConsensusResult {
                    reached: false,
                    votes_for: 0,
                    total_votes: 0,
                    threshold: self.consensus_threshold,
                    agents: Vec::new(),
                },
                execution_time_ms,
            ));
        }

        // Calculate BFT consensus
        let result = self.calculate_consensus(&votes)?;

        let execution_time_ms = start.elapsed().as_millis() as u64;

        info!(
            "Verification workflow {} completed: {}/{} votes (threshold: {})",
            context.id, result.votes_for, result.total_votes, self.consensus_threshold
        );

        Ok(WorkflowResult::success(context, result, execution_time_ms))
    }

    /// Collect vote from a single agent
    async fn collect_agent_vote(
        pool: AgentPool,
        agent_id: Uuid,
        task: VerificationTask,
        timeout_duration: Duration,
    ) -> Option<AgentVote> {
        let mut agent_ref = pool.agents.get_mut(&agent_id)?;

        match timeout(timeout_duration, agent_ref.verify(task)).await {
            Ok(result) => {
                if result.is_valid {
                    Some(AgentVote::approve(agent_id))
                } else {
                    Some(AgentVote::reject(
                        agent_id,
                        result.error.unwrap_or_else(|| "Unknown error".to_string()),
                    ))
                }
            }
            Err(_) => {
                Some(AgentVote::reject(agent_id, "Timeout".to_string()))
            }
        }
    }

    /// Calculate BFT consensus from votes
    fn calculate_consensus(&self, votes: &[AgentVote]) -> Result<ConsensusResult> {
        let total_votes = votes.len();
        let votes_for = votes.iter().filter(|v| v.vote).count();
        let required_votes = (total_votes as f64 * self.consensus_threshold).ceil() as usize;
        let reached = votes_for >= required_votes;

        let agents = votes.iter().map(|v| v.agent_id).collect();

        if !reached {
            return Err(Error::ConsensusNotReached {
                votes_for,
                total_votes,
                threshold: self.consensus_threshold,
            });
        }

        Ok(ConsensusResult {
            reached,
            votes_for,
            total_votes,
            threshold: self.consensus_threshold,
            agents,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::AgentIdentity;

    #[tokio::test]
    async fn test_autonomous_verification_success() {
        let pool = AgentPool::new(5);
        let workflow = AutonomousVerificationWorkflow::new(pool, 0.67, 1000);

        let identity = AgentIdentity::generate().unwrap();
        let message = b"test message";
        let signature = identity.sign(message).unwrap();

        let result = workflow
            .execute(message, &signature, &identity.verifying_key(), WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.data.reached);
    }

    #[tokio::test]
    async fn test_autonomous_verification_invalid_signature() {
        let pool = AgentPool::new(5);
        let workflow = AutonomousVerificationWorkflow::new(pool, 0.67, 1000);

        let identity1 = AgentIdentity::generate().unwrap();
        let identity2 = AgentIdentity::generate().unwrap();
        let message = b"test message";
        let signature = identity1.sign(message).unwrap();

        let result = workflow
            .execute(message, &signature, &identity2.verifying_key(), WorkflowContext::default())
            .await;

        assert!(result.is_err());
    }
}
