//! Performance metrics collection and monitoring

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// System metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metrics {
    /// Total number of verifications
    pub total_verifications: u64,
    /// Number of successful verifications
    pub successful_verifications: u64,
    /// Number of failed verifications
    pub failed_verifications: u64,
    /// Average verification time in microseconds
    pub avg_verification_time_us: u64,
    /// Total time spent in verification
    pub total_verification_time_us: u64,
    /// System uptime in seconds
    pub uptime_seconds: u64,
}

impl Metrics {
    /// Calculate success rate
    pub fn success_rate(&self) -> f64 {
        if self.total_verifications == 0 {
            0.0
        } else {
            self.successful_verifications as f64 / self.total_verifications as f64
        }
    }

    /// Calculate throughput (verifications per second)
    pub fn throughput(&self) -> f64 {
        if self.uptime_seconds == 0 {
            0.0
        } else {
            self.total_verifications as f64 / self.uptime_seconds as f64
        }
    }
}

/// System metrics collector
pub struct SystemMetrics {
    total_verifications: Arc<AtomicU64>,
    successful_verifications: Arc<AtomicU64>,
    failed_verifications: Arc<AtomicU64>,
    total_verification_time_us: Arc<AtomicU64>,
    start_time: Instant,
}

impl SystemMetrics {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            total_verifications: Arc::new(AtomicU64::new(0)),
            successful_verifications: Arc::new(AtomicU64::new(0)),
            failed_verifications: Arc::new(AtomicU64::new(0)),
            total_verification_time_us: Arc::new(AtomicU64::new(0)),
            start_time: Instant::now(),
        }
    }

    /// Record a verification attempt
    pub fn record_verification(&self) {
        self.total_verifications.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a successful verification
    pub fn record_success(&self) {
        self.successful_verifications
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Record a failed verification
    pub fn record_failure(&self) {
        self.failed_verifications.fetch_add(1, Ordering::Relaxed);
    }

    /// Record verification time
    pub fn record_verification_time(&self, duration_us: u64) {
        self.total_verification_time_us
            .fetch_add(duration_us, Ordering::Relaxed);
    }

    /// Get a snapshot of current metrics
    pub fn snapshot(&self) -> Metrics {
        let total = self.total_verifications.load(Ordering::Relaxed);
        let successful = self.successful_verifications.load(Ordering::Relaxed);
        let failed = self.failed_verifications.load(Ordering::Relaxed);
        let total_time = self.total_verification_time_us.load(Ordering::Relaxed);
        let uptime = self.start_time.elapsed().as_secs();

        let avg_time = if total > 0 {
            total_time / total
        } else {
            0
        };

        Metrics {
            total_verifications: total,
            successful_verifications: successful,
            failed_verifications: failed,
            avg_verification_time_us: avg_time,
            total_verification_time_us: total_time,
            uptime_seconds: uptime,
        }
    }

    /// Reset all metrics
    pub fn reset(&self) {
        self.total_verifications.store(0, Ordering::Relaxed);
        self.successful_verifications.store(0, Ordering::Relaxed);
        self.failed_verifications.store(0, Ordering::Relaxed);
        self.total_verification_time_us.store(0, Ordering::Relaxed);
    }
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = SystemMetrics::new();
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.total_verifications, 0);
        assert_eq!(snapshot.successful_verifications, 0);
        assert_eq!(snapshot.failed_verifications, 0);
    }

    #[test]
    fn test_record_verification() {
        let metrics = SystemMetrics::new();
        metrics.record_verification();
        metrics.record_success();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.total_verifications, 1);
        assert_eq!(snapshot.successful_verifications, 1);
    }

    #[test]
    fn test_success_rate() {
        let metrics = Metrics {
            total_verifications: 10,
            successful_verifications: 8,
            failed_verifications: 2,
            avg_verification_time_us: 100,
            total_verification_time_us: 1000,
            uptime_seconds: 60,
        };

        assert_eq!(metrics.success_rate(), 0.8);
    }

    #[test]
    fn test_throughput() {
        let metrics = Metrics {
            total_verifications: 100,
            successful_verifications: 95,
            failed_verifications: 5,
            avg_verification_time_us: 100,
            total_verification_time_us: 10000,
            uptime_seconds: 10,
        };

        assert_eq!(metrics.throughput(), 10.0);
    }

    #[test]
    fn test_metrics_reset() {
        let metrics = SystemMetrics::new();
        metrics.record_verification();
        metrics.record_success();
        metrics.reset();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.total_verifications, 0);
    }
}