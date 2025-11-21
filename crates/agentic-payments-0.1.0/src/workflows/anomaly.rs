//! Anomaly detection workflow for threat identification

use crate::agents::AgentHealth;
use crate::error::{Error, Result};
use crate::workflows::{WorkflowContext, WorkflowResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Anomaly type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnomalyType {
    /// Excessive failures
    HighFailureRate,
    /// Slow response times
    SlowResponseTime,
    /// Suspicious voting patterns
    ByzantineBehavior,
    /// Agent not responding
    Timeout,
    /// Resource exhaustion
    ResourceExhaustion,
}

/// Detected anomaly
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    /// Agent ID
    pub agent_id: Uuid,
    /// Anomaly type
    pub anomaly_type: AnomalyType,
    /// Severity (0.0-1.0)
    pub severity: f64,
    /// Description
    pub description: String,
}

/// Anomaly detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyDetectionResult {
    /// Detected anomalies
    pub anomalies: Vec<Anomaly>,
    /// Agents quarantined
    pub quarantined_agents: Vec<Uuid>,
    /// Detection accuracy
    pub accuracy: f64,
}

/// Autonomous anomaly detection workflow
pub struct AutonomousAnomalyDetection {
    failure_rate_threshold: f64,
    response_time_threshold_ms: f64,
    quarantine_threshold: f64,
}

impl AutonomousAnomalyDetection {
    /// Create a new anomaly detection workflow
    pub fn new(
        failure_rate_threshold: f64,
        response_time_threshold_ms: f64,
        quarantine_threshold: f64,
    ) -> Self {
        Self {
            failure_rate_threshold,
            response_time_threshold_ms,
            quarantine_threshold,
        }
    }

    /// Execute autonomous anomaly detection
    pub async fn execute(
        &self,
        agent_health: Vec<AgentHealth>,
        context: WorkflowContext,
    ) -> Result<WorkflowResult<AnomalyDetectionResult>> {
        let start = Instant::now();

        info!("Starting anomaly detection workflow {}", context.id);

        let mut anomalies = Vec::new();
        let mut quarantined = Vec::new();

        // Analyze each agent's health
        for health in &agent_health {
            let mut agent_anomalies = self.detect_agent_anomalies(health);
            
            // Calculate max severity for this agent
            let max_severity = agent_anomalies
                .iter()
                .map(|a| a.severity)
                .fold(0.0, f64::max);

            // Quarantine if severity exceeds threshold
            if max_severity >= self.quarantine_threshold {
                warn!(
                    "Quarantining agent {} due to severity {}",
                    health.agent_id, max_severity
                );
                quarantined.push(health.agent_id);
            }

            anomalies.append(&mut agent_anomalies);
        }

        let execution_time_ms = start.elapsed().as_millis() as u64;

        // Calculate detection accuracy (simplified)
        let accuracy = if agent_health.is_empty() {
            1.0
        } else {
            1.0 - (anomalies.len() as f64 / (agent_health.len() * 5) as f64).min(1.0)
        };

        info!(
            "Anomaly detection completed: {} anomalies found, {} agents quarantined",
            anomalies.len(),
            quarantined.len()
        );

        let result = AnomalyDetectionResult {
            anomalies,
            quarantined_agents: quarantined,
            accuracy,
        };

        Ok(WorkflowResult::success(context, result, execution_time_ms))
    }

    /// Detect anomalies for a single agent
    fn detect_agent_anomalies(&self, health: &AgentHealth) -> Vec<Anomaly> {
        let mut anomalies = Vec::new();

        // Check failure rate
        if health.total_verifications > 10 {
            let failure_rate = 1.0 - health.success_rate();
            if failure_rate > self.failure_rate_threshold {
                debug!(
                    "Agent {} has high failure rate: {:.2}%",
                    health.agent_id,
                    failure_rate * 100.0
                );
                anomalies.push(Anomaly {
                    agent_id: health.agent_id,
                    anomaly_type: AnomalyType::HighFailureRate,
                    severity: failure_rate,
                    description: format!(
                        "Failure rate {:.1}% exceeds threshold {:.1}%",
                        failure_rate * 100.0,
                        self.failure_rate_threshold * 100.0
                    ),
                });
            }
        }

        // Check response time
        if health.avg_response_time_ms > self.response_time_threshold_ms {
            debug!(
                "Agent {} has slow response time: {:.1}ms",
                health.agent_id, health.avg_response_time_ms
            );
            let severity = (health.avg_response_time_ms / self.response_time_threshold_ms - 1.0)
                .min(1.0);
            anomalies.push(Anomaly {
                agent_id: health.agent_id,
                anomaly_type: AnomalyType::SlowResponseTime,
                severity,
                description: format!(
                    "Avg response time {:.1}ms exceeds threshold {:.1}ms",
                    health.avg_response_time_ms, self.response_time_threshold_ms
                ),
            });
        }

        // Check for timeouts (heartbeat)
        let heartbeat_age = health.last_heartbeat.elapsed().as_secs();
        if heartbeat_age > 60 {
            warn!("Agent {} heartbeat is stale: {}s", health.agent_id, heartbeat_age);
            anomalies.push(Anomaly {
                agent_id: health.agent_id,
                anomaly_type: AnomalyType::Timeout,
                severity: (heartbeat_age as f64 / 120.0).min(1.0),
                description: format!("No heartbeat for {}s", heartbeat_age),
            });
        }

        anomalies
    }

    /// Analyze anomaly trends over time
    pub fn analyze_trends(&self, historical_results: Vec<AnomalyDetectionResult>) -> TrendAnalysis {
        let mut anomaly_counts: HashMap<AnomalyType, usize> = HashMap::new();
        let mut total_quarantined = 0;

        for result in &historical_results {
            for anomaly in &result.anomalies {
                *anomaly_counts.entry(anomaly.anomaly_type).or_insert(0) += 1;
            }
            total_quarantined += result.quarantined_agents.len();
        }

        let total_anomalies: usize = anomaly_counts.values().sum();

        TrendAnalysis {
            total_anomalies,
            anomaly_by_type: anomaly_counts,
            total_quarantined,
            average_accuracy: historical_results
                .iter()
                .map(|r| r.accuracy)
                .sum::<f64>() / historical_results.len() as f64,
        }
    }
}

/// Trend analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    /// Total anomalies detected
    pub total_anomalies: usize,
    /// Anomalies by type
    pub anomaly_by_type: HashMap<AnomalyType, usize>,
    /// Total agents quarantined
    pub total_quarantined: usize,
    /// Average detection accuracy
    pub average_accuracy: f64,
}

impl Default for AutonomousAnomalyDetection {
    fn default() -> Self {
        Self::new(0.1, 100.0, 0.7)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::AgentStatus;
    use std::time::Duration;

    fn create_healthy_agent() -> AgentHealth {
        let mut health = AgentHealth::new(Uuid::new_v4());
        health.record_verification(true, Duration::from_millis(10));
        health.record_verification(true, Duration::from_millis(10));
        health.record_verification(true, Duration::from_millis(10));
        health
    }

    fn create_unhealthy_agent() -> AgentHealth {
        let mut health = AgentHealth::new(Uuid::new_v4());
        for _ in 0..15 {
            health.record_verification(false, Duration::from_millis(200));
        }
        health
    }

    #[tokio::test]
    async fn test_anomaly_detection_healthy() {
        let detector = AutonomousAnomalyDetection::default();
        let agents = vec![create_healthy_agent(); 5];

        let result = detector
            .execute(agents, WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.data.anomalies.len(), 0);
        assert_eq!(result.data.quarantined_agents.len(), 0);
    }

    #[tokio::test]
    async fn test_anomaly_detection_unhealthy() {
        let detector = AutonomousAnomalyDetection::default();
        let agents = vec![create_unhealthy_agent(); 3];

        let result = detector
            .execute(agents, WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.data.anomalies.len() > 0);
        assert!(result.data.quarantined_agents.len() > 0);
    }

    #[tokio::test]
    async fn test_anomaly_detection_mixed() {
        let detector = AutonomousAnomalyDetection::default();
        let mut agents = vec![create_healthy_agent(); 5];
        agents.push(create_unhealthy_agent());

        let result = detector
            .execute(agents, WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.data.anomalies.len() > 0);
    }
}
