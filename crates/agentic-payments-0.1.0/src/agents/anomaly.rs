//! Anomaly detection agent for statistical threat detection

use super::{Agent, AgentHealth, AgentMetrics, AgentState};
use crate::error::{Error, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Anomaly detection event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyEvent {
    pub event_id: Uuid,
    pub agent_id: Uuid,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub anomaly_type: AnomalyType,
    pub severity: Severity,
    pub description: String,
    pub metric_value: f64,
    pub threshold: f64,
}

/// Type of anomaly detected
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnomalyType {
    /// High failure rate
    HighFailureRate,
    /// Unusual processing time
    ProcessingTimeAnomaly,
    /// Suspicious pattern
    SuspiciousPattern,
    /// Threshold exceeded
    ThresholdExceeded,
}

/// Severity level of anomaly
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

/// Statistical baseline for anomaly detection
#[derive(Debug, Clone)]
struct StatisticalBaseline {
    mean: f64,
    std_dev: f64,
    samples: VecDeque<f64>,
    max_samples: usize,
}

impl StatisticalBaseline {
    fn new(max_samples: usize) -> Self {
        Self {
            mean: 0.0,
            std_dev: 0.0,
            samples: VecDeque::with_capacity(max_samples),
            max_samples,
        }
    }

    fn add_sample(&mut self, value: f64) {
        if self.samples.len() >= self.max_samples {
            self.samples.pop_front();
        }
        self.samples.push_back(value);
        self.recalculate();
    }

    fn recalculate(&mut self) {
        if self.samples.is_empty() {
            return;
        }

        // Calculate mean
        let sum: f64 = self.samples.iter().sum();
        self.mean = sum / self.samples.len() as f64;

        // Calculate standard deviation
        let variance: f64 = self.samples
            .iter()
            .map(|x| {
                let diff = x - self.mean;
                diff * diff
            })
            .sum::<f64>()
            / self.samples.len() as f64;

        self.std_dev = variance.sqrt();
    }

    fn is_anomaly(&self, value: f64, num_std_devs: f64) -> bool {
        if self.samples.len() < 10 {
            return false; // Need sufficient samples
        }

        let threshold = self.mean + (num_std_devs * self.std_dev);
        value > threshold
    }
}

/// Anomaly detection configuration
#[derive(Debug, Clone)]
pub struct AnomalyConfig {
    /// Standard deviations for anomaly threshold
    pub std_dev_threshold: f64,
    /// Maximum failure rate before triggering anomaly (0.0 to 1.0)
    pub max_failure_rate: f64,
    /// Maximum samples to keep for baseline
    pub baseline_samples: usize,
}

impl Default for AnomalyConfig {
    fn default() -> Self {
        Self {
            std_dev_threshold: 3.0, // 3-sigma rule
            max_failure_rate: 0.1,  // 10%
            baseline_samples: 100,
        }
    }
}

/// Anomaly detection agent
pub struct AnomalyDetectionAgent {
    state: AgentState,
    config: Arc<RwLock<AnomalyConfig>>,
    processing_time_baseline: Arc<RwLock<StatisticalBaseline>>,
    failure_rate_baseline: Arc<RwLock<StatisticalBaseline>>,
    detected_anomalies: Arc<RwLock<Vec<AnomalyEvent>>>,
    shutdown: Arc<RwLock<bool>>,
}

impl AnomalyDetectionAgent {
    /// Create a new anomaly detection agent
    pub fn new() -> Self {
        let config = AnomalyConfig::default();
        Self {
            state: AgentState::new(),
            config: Arc::new(RwLock::new(config.clone())),
            processing_time_baseline: Arc::new(RwLock::new(StatisticalBaseline::new(
                config.baseline_samples,
            ))),
            failure_rate_baseline: Arc::new(RwLock::new(StatisticalBaseline::new(
                config.baseline_samples,
            ))),
            detected_anomalies: Arc::new(RwLock::new(Vec::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Create with custom configuration
    pub fn with_config(config: AnomalyConfig) -> Self {
        Self {
            state: AgentState::new(),
            processing_time_baseline: Arc::new(RwLock::new(StatisticalBaseline::new(
                config.baseline_samples,
            ))),
            failure_rate_baseline: Arc::new(RwLock::new(StatisticalBaseline::new(
                config.baseline_samples,
            ))),
            config: Arc::new(RwLock::new(config)),
            detected_anomalies: Arc::new(RwLock::new(Vec::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Record processing time sample
    pub async fn record_processing_time(&self, duration_ms: f64) -> Result<Option<AnomalyEvent>> {
        let mut baseline = self.processing_time_baseline.write().await;
        let config = self.config.read().await;

        let is_anomaly = baseline.is_anomaly(duration_ms, config.std_dev_threshold);

        baseline.add_sample(duration_ms);

        if is_anomaly {
            let event = AnomalyEvent {
                event_id: Uuid::new_v4(),
                agent_id: self.state.agent_id,
                timestamp: chrono::Utc::now(),
                anomaly_type: AnomalyType::ProcessingTimeAnomaly,
                severity: Severity::Medium,
                description: format!(
                    "Processing time {:.2}ms exceeds baseline {:.2}ms + {:.1}σ",
                    duration_ms, baseline.mean, config.std_dev_threshold
                ),
                metric_value: duration_ms,
                threshold: baseline.mean + (config.std_dev_threshold * baseline.std_dev),
            };

            let mut anomalies = self.detected_anomalies.write().await;
            anomalies.push(event.clone());

            Ok(Some(event))
        } else {
            Ok(None)
        }
    }

    /// Record failure rate sample
    pub async fn record_failure_rate(&self, failure_rate: f64) -> Result<Option<AnomalyEvent>> {
        let mut baseline = self.failure_rate_baseline.write().await;
        let config = self.config.read().await;

        let is_anomaly = failure_rate > config.max_failure_rate;

        baseline.add_sample(failure_rate);

        if is_anomaly {
            let event = AnomalyEvent {
                event_id: Uuid::new_v4(),
                agent_id: self.state.agent_id,
                timestamp: chrono::Utc::now(),
                anomaly_type: AnomalyType::HighFailureRate,
                severity: if failure_rate > config.max_failure_rate * 2.0 {
                    Severity::Critical
                } else {
                    Severity::High
                },
                description: format!(
                    "Failure rate {:.2}% exceeds threshold {:.2}%",
                    failure_rate * 100.0,
                    config.max_failure_rate * 100.0
                ),
                metric_value: failure_rate,
                threshold: config.max_failure_rate,
            };

            let mut anomalies = self.detected_anomalies.write().await;
            anomalies.push(event.clone());

            Ok(Some(event))
        } else {
            Ok(None)
        }
    }

    /// Get all detected anomalies
    pub async fn get_anomalies(&self) -> Vec<AnomalyEvent> {
        let anomalies = self.detected_anomalies.read().await;
        anomalies.clone()
    }

    /// Get anomalies by severity
    pub async fn get_anomalies_by_severity(&self, min_severity: Severity) -> Vec<AnomalyEvent> {
        let anomalies = self.detected_anomalies.read().await;
        anomalies
            .iter()
            .filter(|a| a.severity >= min_severity)
            .cloned()
            .collect()
    }

    /// Clear anomalies older than specified duration
    pub async fn clear_old_anomalies(&self, max_age_seconds: i64) {
        let mut anomalies = self.detected_anomalies.write().await;
        let cutoff = chrono::Utc::now() - chrono::Duration::seconds(max_age_seconds);
        anomalies.retain(|a| a.timestamp > cutoff);
    }

    /// Update configuration
    pub async fn update_config(&self, config: AnomalyConfig) {
        let mut c = self.config.write().await;
        *c = config;
    }

    /// Run heartbeat loop
    async fn heartbeat_loop(state: AgentState, shutdown: Arc<RwLock<bool>>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));

        loop {
            interval.tick().await;

            if *shutdown.read().await {
                break;
            }

            state.update_heartbeat().await;
            state.update_health(AgentHealth::Healthy).await;
        }
    }
}

impl Default for AnomalyDetectionAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for AnomalyDetectionAgent {
    fn agent_id(&self) -> Uuid {
        self.state.agent_id
    }

    fn agent_type(&self) -> &'static str {
        "AnomalyDetectionAgent"
    }

    async fn health_check(&self) -> Result<AgentHealth> {
        let health = self.state.health.read().await;
        Ok(*health)
    }

    async fn get_metrics(&self) -> Result<AgentMetrics> {
        let metrics = self.state.metrics.read().await;
        Ok(metrics.clone())
    }

    async fn start(&self) -> Result<()> {
        let state = self.state.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            Self::heartbeat_loop(state, shutdown).await;
        });

        Ok(())
    }

    async fn shutdown(&self) -> Result<()> {
        self.state.update_health(AgentHealth::ShuttingDown).await;
        let mut shutdown = self.shutdown.write().await;
        *shutdown = true;
        Ok(())
    }

    async fn heartbeat(&self) -> Result<()> {
        self.state.update_heartbeat().await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_anomaly_agent_creation() {
        let agent = AnomalyDetectionAgent::new();
        assert_eq!(agent.agent_type(), "AnomalyDetectionAgent");
    }

    #[tokio::test]
    async fn test_processing_time_anomaly() {
        let agent = AnomalyDetectionAgent::new();
        agent.start().await.unwrap();

        // Establish baseline with normal values
        for _ in 0..20 {
            agent.record_processing_time(100.0).await.unwrap();
        }

        // Record anomalous value
        let result = agent.record_processing_time(500.0).await.unwrap();
        assert!(result.is_some());

        let anomalies = agent.get_anomalies().await;
        assert!(!anomalies.is_empty());

        agent.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn test_failure_rate_anomaly() {
        let agent = AnomalyDetectionAgent::new();

        // Normal failure rate
        let result = agent.record_failure_rate(0.05).await.unwrap();
        assert!(result.is_none());

        // High failure rate
        let result = agent.record_failure_rate(0.15).await.unwrap();
        assert!(result.is_some());

        let event = result.unwrap();
        assert_eq!(event.anomaly_type, AnomalyType::HighFailureRate);
    }

    #[tokio::test]
    async fn test_clear_old_anomalies() {
        let agent = AnomalyDetectionAgent::new();

        // Record some anomalies
        agent.record_failure_rate(0.5).await.unwrap();
        agent.record_processing_time(1000.0).await.unwrap();

        let anomalies_before = agent.get_anomalies().await;
        assert!(!anomalies_before.is_empty());

        // Clear old anomalies (everything older than 1 hour)
        agent.clear_old_anomalies(3600).await;

        // Should still have recent anomalies
        let anomalies_after = agent.get_anomalies().await;
        assert_eq!(anomalies_before.len(), anomalies_after.len());
    }
}