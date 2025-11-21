//! Verification agent implementation

use super::{AgentStatus, BasicVerificationAgent};
use crate::crypto::{verify_signature, Signature};
use crate::error::{Error, Result};
use ed25519_dalek::VerifyingKey;
use std::time::Instant;
use tracing::{debug, warn};

/// Verification task
#[derive(Debug, Clone)]
pub struct VerificationTask {
    /// Message to verify
    pub message: Vec<u8>,
    /// Signature to verify
    pub signature: Signature,
    /// Public key for verification
    pub public_key: VerifyingKey,
}

impl VerificationTask {
    /// Create a new verification task
    pub fn new(message: Vec<u8>, signature: Signature, public_key: VerifyingKey) -> Self {
        Self {
            message,
            signature,
            public_key,
        }
    }
}

/// Verification result from an agent
#[derive(Debug, Clone)]
pub struct VerificationResult {
    /// Whether the signature is valid
    pub is_valid: bool,
    /// Verification duration
    pub duration_ms: u64,
    /// Error message if verification failed
    pub error: Option<String>,
}

impl VerificationResult {
    /// Create a successful result
    pub fn success(duration_ms: u64) -> Self {
        Self {
            is_valid: true,
            duration_ms,
            error: None,
        }
    }

    /// Create a failed result
    pub fn failure(duration_ms: u64, error: String) -> Self {
        Self {
            is_valid: false,
            duration_ms,
            error: Some(error),
        }
    }
}

impl BasicVerificationAgent {
    /// Perform a verification task
    pub async fn verify_task(&self, task: VerificationTask) -> VerificationResult {
        let start = Instant::now();

        // Update status
        {
            let mut health = self.health.lock().unwrap();
            health.status = AgentStatus::Busy;
            health.heartbeat();
        }

        // Perform verification
        let result = match verify_signature(&task.public_key, &task.message, &task.signature) {
            Ok(true) => {
                debug!("Agent {} verified signature successfully", self.id);
                let duration = start.elapsed();
                self.health.lock().unwrap().record_verification(true, duration);
                VerificationResult::success(duration.as_millis() as u64)
            }
            Ok(false) => {
                warn!("Agent {} verification failed: invalid signature", self.id);
                let duration = start.elapsed();
                self.health.lock().unwrap().record_verification(false, duration);
                VerificationResult::failure(duration.as_millis() as u64, "Invalid signature".to_string())
            }
            Err(e) => {
                warn!("Agent {} verification error: {}", self.id, e);
                let duration = start.elapsed();
                self.health.lock().unwrap().record_verification(false, duration);
                VerificationResult::failure(duration.as_millis() as u64, e.to_string())
            }
        };

        // Update status back to healthy
        self.health.lock().unwrap().status = AgentStatus::Healthy;

        result
    }

    /// Perform multiple verifications
    pub async fn verify_batch(&self, tasks: Vec<VerificationTask>) -> Vec<VerificationResult> {
        let mut results = Vec::with_capacity(tasks.len());

        for task in tasks {
            results.push(self.verify_task(task).await);
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::AgentIdentity;

    #[tokio::test]
    async fn test_agent_verification_success() {
        let agent = BasicVerificationAgent::new().unwrap();
        let identity = AgentIdentity::generate().unwrap();

        let message = b"test message".to_vec();
        let signature = identity.sign(&message).unwrap();

        let task = VerificationTask::new(
            message,
            signature,
            *identity.verifying_key(),
        );

        let result = agent.verify_task(task).await;
        assert!(result.is_valid);
        assert_eq!(agent.health.lock().unwrap().successful_verifications, 1);
    }

    #[tokio::test]
    async fn test_agent_verification_failure() {
        let agent = BasicVerificationAgent::new().unwrap();
        let identity1 = AgentIdentity::generate().unwrap();
        let identity2 = AgentIdentity::generate().unwrap();

        let message = b"test message".to_vec();
        let signature = identity1.sign(&message).unwrap();

        let task = VerificationTask::new(
            message,
            signature,
            *identity2.verifying_key(), // Wrong key
        );

        let result = agent.verify_task(task).await;
        assert!(!result.is_valid);
        assert_eq!(agent.health.lock().unwrap().failed_verifications, 1);
    }

    #[tokio::test]
    async fn test_agent_batch_verification() {
        let agent = BasicVerificationAgent::new().unwrap();
        let identity = AgentIdentity::generate().unwrap();

        let mut tasks = Vec::new();
        for i in 0..5 {
            let message = format!("message {}", i).into_bytes();
            let signature = identity.sign(&message).unwrap();
            tasks.push(VerificationTask::new(
                message,
                signature,
                *identity.verifying_key(),
            ));
        }

        let results = agent.verify_batch(tasks).await;
        assert_eq!(results.len(), 5);
        assert!(results.iter().all(|r| r.is_valid));
    }
}