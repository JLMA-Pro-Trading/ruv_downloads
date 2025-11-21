//! Health monitoring for the verification system

use crate::error::{Error, Result};
use crate::system::pool::AgentPool;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// System health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthStatus {
    /// System is healthy
    Healthy,
    /// System is degraded but operational
    Degraded,
    /// System is unhealthy
    Unhealthy,
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    /// Health status
    pub status: HealthStatus,
    /// Last check timestamp
    pub last_check: i64,
    /// Check duration in milliseconds
    pub duration_ms: u64,
    /// Error message if unhealthy
    pub message: Option<String>,
}

impl HealthCheck {
    /// Create a healthy check result
    pub fn healthy(duration_ms: u64) -> Self {
        Self {
            status: HealthStatus::Healthy,
            last_check: chrono::Utc::now().timestamp(),
            duration_ms,
            message: None,
        }
    }

    /// Create a degraded check result
    pub fn degraded(duration_ms: u64, message: String) -> Self {
        Self {
            status: HealthStatus::Degraded,
            last_check: chrono::Utc::now().timestamp(),
            duration_ms,
            message: Some(message),
        }
    }

    /// Create an unhealthy check result
    pub fn unhealthy(duration_ms: u64, message: String) -> Self {
        Self {
            status: HealthStatus::Unhealthy,
            last_check: chrono::Utc::now().timestamp(),
            duration_ms,
            message: Some(message),
        }
    }
}

/// System health monitoring
pub struct SystemHealth {
    status: HealthStatus,
    last_check: Option<Instant>,
    check_interval: Duration,
}

impl SystemHealth {
    /// Create a new system health monitor
    pub fn new() -> Self {
        Self {
            status: HealthStatus::Healthy,
            last_check: None,
            check_interval: Duration::from_secs(30),
        }
    }

    /// Get current health status
    pub fn status(&self) -> HealthStatus {
        self.status
    }

    /// Set health status
    pub fn set_status(&mut self, status: HealthStatus) {
        self.status = status;
    }

    /// Check if health check is due
    pub fn is_check_due(&self) -> bool {
        match self.last_check {
            None => true,
            Some(last) => last.elapsed() >= self.check_interval,
        }
    }

    /// Perform system health check
    pub async fn check_system(&mut self) -> Result<HealthCheck> {
        let start = Instant::now();

        // Update last check time
        self.last_check = Some(start);

        // System is healthy by default
        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(HealthCheck::healthy(duration_ms))
    }

    /// Check agent pool health
    pub async fn check_agent_pool(&mut self, pool: &AgentPool) -> Result<HealthCheck> {
        let start = Instant::now();

        if pool.is_empty() {
            let duration_ms = start.elapsed().as_millis() as u64;
            self.status = HealthStatus::Unhealthy;
            return Ok(HealthCheck::unhealthy(
                duration_ms,
                "Agent pool is empty".to_string(),
            ));
        }

        // Check if minimum number of agents are available
        if pool.size() < 3 {
            let duration_ms = start.elapsed().as_millis() as u64;
            self.status = HealthStatus::Degraded;
            return Ok(HealthCheck::degraded(
                duration_ms,
                format!("Only {} agents available (minimum: 3)", pool.size()),
            ));
        }

        // Perform health check on all agents
        if let Err(e) = pool.health_check_all().await {
            let duration_ms = start.elapsed().as_millis() as u64;
            self.status = HealthStatus::Degraded;
            return Ok(HealthCheck::degraded(
                duration_ms,
                format!("Some agents failed health check: {}", e),
            ));
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        self.status = HealthStatus::Healthy;
        Ok(HealthCheck::healthy(duration_ms))
    }
}

impl Default for SystemHealth {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status() {
        let mut health = SystemHealth::new();
        assert_eq!(health.status(), HealthStatus::Healthy);

        health.set_status(HealthStatus::Degraded);
        assert_eq!(health.status(), HealthStatus::Degraded);
    }

    #[test]
    fn test_health_check_creation() {
        let check = HealthCheck::healthy(100);
        assert_eq!(check.status, HealthStatus::Healthy);
        assert!(check.message.is_none());

        let check = HealthCheck::degraded(100, "Warning".to_string());
        assert_eq!(check.status, HealthStatus::Degraded);
        assert!(check.message.is_some());
    }

    #[tokio::test]
    async fn test_system_health_check() {
        let mut health = SystemHealth::new();
        let result = health.check_system().await.unwrap();
        assert_eq!(result.status, HealthStatus::Healthy);
    }
}