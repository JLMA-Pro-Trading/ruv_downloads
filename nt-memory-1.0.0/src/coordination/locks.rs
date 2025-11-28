//! Distributed lock implementation for critical sections

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Lock token
pub type LockToken = String;

/// Lock state
#[derive(Debug, Clone)]
struct LockState {
    /// Lock holder token
    token: LockToken,

    /// Acquisition time
    acquired_at: Instant,

    /// TTL
    ttl: Duration,
}

impl LockState {
    fn is_expired(&self) -> bool {
        self.acquired_at.elapsed() > self.ttl
    }
}

/// Distributed lock manager
pub struct DistributedLock {
    /// Active locks
    locks: Arc<RwLock<HashMap<String, LockState>>>,

    /// Default TTL
    default_ttl: Duration,
}

impl DistributedLock {
    /// Create new lock manager
    pub fn new() -> Self {
        Self {
            locks: Arc::new(RwLock::new(HashMap::new())),
            default_ttl: Duration::from_secs(30),
        }
    }

    /// Configure default TTL
    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.default_ttl = ttl;
        self
    }

    /// Acquire lock on resource
    pub async fn acquire(&self, resource: &str, timeout: Duration) -> anyhow::Result<LockToken> {
        let start = Instant::now();

        loop {
            // Try to acquire
            if let Some(token) = self.try_acquire(resource) {
                return Ok(token);
            }

            // Check timeout
            if start.elapsed() >= timeout {
                return Err(anyhow::anyhow!("Lock acquisition timeout"));
            }

            // Wait and retry
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }

    /// Try to acquire lock (non-blocking)
    pub fn try_acquire(&self, resource: &str) -> Option<LockToken> {
        let mut locks = self.locks.write();

        // Check if lock exists and is valid
        if let Some(state) = locks.get(resource) {
            if !state.is_expired() {
                return None; // Lock held by someone else
            }
        }

        // Acquire lock
        let token = Uuid::new_v4().to_string();

        locks.insert(
            resource.to_string(),
            LockState {
                token: token.clone(),
                acquired_at: Instant::now(),
                ttl: self.default_ttl,
            },
        );

        tracing::debug!("Lock acquired: {} -> {}", resource, token);

        Some(token)
    }

    /// Release lock
    pub async fn release(&self, token: &str) -> anyhow::Result<()> {
        let mut locks = self.locks.write();

        // Find and remove lock with matching token
        locks.retain(|_, state| state.token != token);

        tracing::debug!("Lock released: {}", token);

        Ok(())
    }

    /// Check if resource is locked
    pub fn is_locked(&self, resource: &str) -> bool {
        let locks = self.locks.read();

        if let Some(state) = locks.get(resource) {
            !state.is_expired()
        } else {
            false
        }
    }

    /// Extend lock TTL
    pub fn extend(&self, token: &str, additional: Duration) -> anyhow::Result<()> {
        let mut locks = self.locks.write();

        for state in locks.values_mut() {
            if state.token == token {
                state.ttl += additional;
                return Ok(());
            }
        }

        Err(anyhow::anyhow!("Lock token not found"))
    }

    /// Cleanup expired locks
    pub fn cleanup_expired(&self) {
        let mut locks = self.locks.write();
        locks.retain(|_, state| !state.is_expired());
    }

    /// Get lock count
    pub fn count(&self) -> usize {
        self.locks.read().len()
    }
}

impl Default for DistributedLock {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_lock_acquire_release() {
        let locks = DistributedLock::new();

        // Acquire
        let token = locks
            .acquire("resource1", Duration::from_secs(1))
            .await
            .unwrap();

        assert!(locks.is_locked("resource1"));
        assert_eq!(locks.count(), 1);

        // Release
        locks.release(&token).await.unwrap();

        assert!(!locks.is_locked("resource1"));
        assert_eq!(locks.count(), 0);
    }

    #[tokio::test]
    async fn test_lock_timeout() {
        let locks = DistributedLock::new();

        // Acquire lock
        let _token = locks
            .acquire("resource1", Duration::from_secs(1))
            .await
            .unwrap();

        // Try to acquire again - should timeout
        let result = locks
            .acquire("resource1", Duration::from_millis(100))
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_lock_expiration() {
        let locks = DistributedLock::new().with_ttl(Duration::from_millis(100));

        // Acquire lock
        let _token = locks
            .acquire("resource1", Duration::from_secs(1))
            .await
            .unwrap();

        // Wait for expiration
        tokio::time::sleep(Duration::from_millis(150)).await;

        // Should be able to acquire again
        let token2 = locks
            .acquire("resource1", Duration::from_millis(100))
            .await
            .unwrap();

        assert!(token2.len() > 0);
    }

    #[tokio::test]
    async fn test_multiple_resources() {
        let locks = DistributedLock::new();

        // Acquire multiple locks
        let token1 = locks
            .acquire("resource1", Duration::from_secs(1))
            .await
            .unwrap();
        let token2 = locks
            .acquire("resource2", Duration::from_secs(1))
            .await
            .unwrap();

        assert_eq!(locks.count(), 2);

        // Release one
        locks.release(&token1).await.unwrap();
        assert_eq!(locks.count(), 1);

        // Release other
        locks.release(&token2).await.unwrap();
        assert_eq!(locks.count(), 0);
    }

    #[tokio::test]
    async fn test_lock_extension() {
        let locks = DistributedLock::new().with_ttl(Duration::from_millis(100));

        let token = locks
            .acquire("resource1", Duration::from_secs(1))
            .await
            .unwrap();

        // Extend
        locks.extend(&token, Duration::from_secs(10)).unwrap();

        // Wait beyond original TTL
        tokio::time::sleep(Duration::from_millis(150)).await;

        // Should still be locked
        assert!(locks.is_locked("resource1"));
    }
}
