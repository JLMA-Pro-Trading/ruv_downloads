//! Agent recovery and self-healing workflows

use crate::agents::{AgentPool, AgentStatus, RecoveryAgent, RecoveryStrategy};
use crate::error::{Error, Result};
use crate::workflows::{WorkflowContext, WorkflowResult};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

/// Recovery workflow result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryWorkflowResult {
    /// Number of agents recovered
    pub agents_recovered: usize,
    /// Number of agents quarantined
    pub agents_quarantined: usize,
    /// Total downtime in milliseconds
    pub total_downtime_ms: u64,
    /// Recovery success rate
    pub success_rate: f64,
}

/// Autonomous agent recovery workflow
pub struct AutonomousRecoveryWorkflow {
    pool: AgentPool,
    recovery_agent: RecoveryAgent,
    max_parallel_recoveries: usize,
}

impl AutonomousRecoveryWorkflow {
    /// Create a new autonomous recovery workflow
    pub fn new(pool: AgentPool, strategy: RecoveryStrategy, max_parallel: usize) -> Self {
        let recovery_agent = RecoveryAgent::new(pool.clone(), strategy);
        
        Self {
            pool,
            recovery_agent,
            max_parallel_recoveries: max_parallel,
        }
    }

    /// Execute autonomous agent recovery
    pub async fn execute(
        &self,
        context: WorkflowContext,
    ) -> Result<WorkflowResult<RecoveryWorkflowResult>> {
        let start = Instant::now();

        info!("Starting agent recovery workflow {}", context.id);

        // Find unhealthy agents
        let unhealthy_ids: Vec<Uuid> = self.find_unhealthy_agents();

        if unhealthy_ids.is_empty() {
            info!("No unhealthy agents found");
            return Ok(WorkflowResult::success(
                context,
                RecoveryWorkflowResult {
                    agents_recovered: 0,
                    agents_quarantined: 0,
                    total_downtime_ms: 0,
                    success_rate: 1.0,
                },
                start.elapsed().as_millis() as u64,
            ));
        }

        warn!("Found {} unhealthy agents, attempting recovery", unhealthy_ids.len());

        // Recover agents in parallel (chunked)
        let mut recovered = 0;
        let mut quarantined = 0;

        for chunk in unhealthy_ids.chunks(self.max_parallel_recoveries) {
            let recovery_futures = chunk.iter().map(|agent_id| {
                let recovery_agent = &self.recovery_agent;
                async move {
                    recovery_agent.recover_agent(agent_id).await
                }
            });

            let results = futures::future::join_all(recovery_futures).await;

            for (agent_id, result) in chunk.iter().zip(results) {
                match result {
                    Ok(_) => {
                        info!("Successfully recovered agent {}", agent_id);
                        recovered += 1;
                    }
                    Err(e) => {
                        error!("Failed to recover agent {}: {}", agent_id, e);
                        quarantined += 1;
                    }
                }
            }
        }

        let total_downtime_ms = start.elapsed().as_millis() as u64;
        let success_rate = recovered as f64 / (recovered + quarantined) as f64;

        info!(
            "Recovery workflow completed: {} recovered, {} quarantined (success rate: {:.1}%)",
            recovered, quarantined, success_rate * 100.0
        );

        let result = RecoveryWorkflowResult {
            agents_recovered: recovered,
            agents_quarantined: quarantined,
            total_downtime_ms,
            success_rate,
        };

        Ok(WorkflowResult::success(
            context,
            result,
            total_downtime_ms,
        ))
    }

    /// Find unhealthy agents in the pool
    fn find_unhealthy_agents(&self) -> Vec<Uuid> {
        self.pool
            .agents
            .iter()
            .filter(|entry| {
                matches!(
                    entry.value().health().status,
                    AgentStatus::Error | AgentStatus::Quarantined
                )
            })
            .map(|entry| *entry.key())
            .collect()
    }

    /// Continuous monitoring and recovery
    pub async fn monitor_and_recover(&self, check_interval_ms: u64) -> Result<()> {
        info!("Starting continuous agent monitoring and recovery");

        loop {
            sleep(Duration::from_millis(check_interval_ms)).await;

            let context = WorkflowContext::default();
            match self.execute(context).await {
                Ok(result) => {
                    if result.data.agents_recovered > 0 {
                        info!("Recovered {} agents", result.data.agents_recovered);
                    }
                }
                Err(e) => {
                    error!("Recovery workflow failed: {}", e);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_recovery_workflow_no_failures() {
        let pool = AgentPool::new(5);
        let workflow = AutonomousRecoveryWorkflow::new(
            pool,
            RecoveryStrategy::Immediate,
            3,
        );

        let result = workflow
            .execute(WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.data.agents_recovered, 0);
        assert_eq!(result.data.success_rate, 1.0);
    }

    #[tokio::test]
    async fn test_recovery_workflow_with_failures() {
        let pool = AgentPool::new(5);
        
        // Mark some agents as errored
        let agent_ids: Vec<Uuid> = pool.agents.iter().map(|e| *e.key()).collect();
        for agent_id in &agent_ids[0..2] {
            pool.update_status(agent_id, AgentStatus::Error).unwrap();
        }

        let workflow = AutonomousRecoveryWorkflow::new(
            pool,
            RecoveryStrategy::Immediate,
            3,
        );

        let result = workflow
            .execute(WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.data.agents_recovered > 0);
    }
}
