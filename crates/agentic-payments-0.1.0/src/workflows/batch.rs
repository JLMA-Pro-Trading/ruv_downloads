//! Batch verification workflow for high-throughput processing

use crate::agents::{AgentPool, VerificationTask};
use crate::crypto::Ed25519Signature;
use crate::error::{Error, Result};
use crate::workflows::{WorkflowContext, WorkflowResult};
use ed25519_dalek::VerifyingKey;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::time::{timeout, Duration};
use tracing::{debug, info};

/// Batch verification request
#[derive(Debug, Clone)]
pub struct BatchVerificationRequest {
    /// Messages to verify
    pub messages: Vec<Vec<u8>>,
    /// Signatures
    pub signatures: Vec<Ed25519Signature>,
    /// Public keys
    pub public_keys: Vec<VerifyingKey>,
}

impl BatchVerificationRequest {
    /// Create a new batch request
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
            signatures: Vec::new(),
            public_keys: Vec::new(),
        }
    }

    /// Add a verification to the batch
    pub fn add(&mut self, message: Vec<u8>, signature: Ed25519Signature, public_key: VerifyingKey) {
        self.messages.push(message);
        self.signatures.push(signature);
        self.public_keys.push(public_key);
    }

    /// Get batch size
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    /// Check if batch is empty
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
}

impl Default for BatchVerificationRequest {
    fn default() -> Self {
        Self::new()
    }
}

/// Batch verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchVerificationResult {
    /// Total verifications
    pub total: usize,
    /// Successful verifications
    pub successful: usize,
    /// Failed verifications
    pub failed: usize,
    /// Failed indices
    pub failed_indices: Vec<usize>,
    /// Throughput (verifications/second)
    pub throughput: f64,
}

/// Autonomous batch verification workflow
pub struct AutonomousBatchWorkflow {
    pool: AgentPool,
    timeout_ms: u64,
    chunk_size: usize,
}

impl AutonomousBatchWorkflow {
    /// Create a new batch verification workflow
    pub fn new(pool: AgentPool, timeout_ms: u64, chunk_size: usize) -> Self {
        Self {
            pool,
            timeout_ms,
            chunk_size,
        }
    }

    /// Execute batch verification with parallel agent processing
    pub async fn execute(
        &self,
        request: BatchVerificationRequest,
        context: WorkflowContext,
    ) -> Result<WorkflowResult<BatchVerificationResult>> {
        let start = Instant::now();

        if request.is_empty() {
            return Ok(WorkflowResult::success(
                context,
                BatchVerificationResult {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    failed_indices: Vec::new(),
                    throughput: 0.0,
                },
                0,
            ));
        }

        info!(
            "Starting batch verification workflow {} with {} items",
            context.id,
            request.len()
        );

        // Validate request
        if request.messages.len() != request.signatures.len()
            || request.messages.len() != request.public_keys.len()
        {
            return Err(Error::InvalidInput(
                "Batch verification: mismatched array lengths".to_string(),
            ));
        }

        // Split into chunks for parallel processing
        let total_items = request.len();
        let mut tasks = Vec::new();

        for i in (0..total_items).step_by(self.chunk_size) {
            let end = (i + self.chunk_size).min(total_items);
            let chunk_messages: Vec<_> = request.messages[i..end].to_vec();
            let chunk_signatures: Vec<_> = request.signatures[i..end].to_vec();
            let chunk_keys: Vec<_> = request.public_keys[i..end].to_vec();

            tasks.push((i, chunk_messages, chunk_signatures, chunk_keys));
        }

        debug!("Split into {} chunks of size {}", tasks.len(), self.chunk_size);

        // Process chunks in parallel
        let futures = tasks.into_iter().map(|(offset, messages, sigs, keys)| {
            let pool = self.pool.clone();
            let timeout_duration = Duration::from_millis(self.timeout_ms);

            async move {
                Self::process_chunk(pool, messages, sigs, keys, offset, timeout_duration).await
            }
        });

        let chunk_results: Vec<Vec<(usize, bool)>> = join_all(futures)
            .await
            .into_iter()
            .filter_map(Result::ok)
            .collect();

        // Aggregate results
        let mut failed_indices = Vec::new();
        let mut successful = 0;

        for chunk_result in chunk_results {
            for (idx, is_valid) in chunk_result {
                if is_valid {
                    successful += 1;
                } else {
                    failed_indices.push(idx);
                }
            }
        }

        let failed = failed_indices.len();
        let execution_time = start.elapsed();
        let throughput = total_items as f64 / execution_time.as_secs_f64();

        info!(
            "Batch verification completed: {}/{} successful ({:.1} verifications/sec)",
            successful, total_items, throughput
        );

        let result = BatchVerificationResult {
            total: total_items,
            successful,
            failed,
            failed_indices,
            throughput,
        };

        Ok(WorkflowResult::success(
            context,
            result,
            execution_time.as_millis() as u64,
        ))
    }

    /// Process a chunk of verifications
    async fn process_chunk(
        pool: AgentPool,
        messages: Vec<Vec<u8>>,
        signatures: Vec<Ed25519Signature>,
        public_keys: Vec<VerifyingKey>,
        offset: usize,
        timeout_duration: Duration,
    ) -> Result<Vec<(usize, bool)>> {
        let agent_id = pool.get_healthy_agent()?;
        let mut agent = pool.agents.get_mut(&agent_id).ok_or(Error::PoolExhausted)?;

        let mut results = Vec::new();

        for (i, ((message, signature), key)) in messages
            .into_iter()
            .zip(signatures)
            .zip(public_keys)
            .enumerate()
        {
            let task = VerificationTask::new(message, signature, key);

            let result = match timeout(timeout_duration, agent.verify(task)).await {
                Ok(r) => r.is_valid,
                Err(_) => false,
            };

            results.push((offset + i, result));
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::AgentIdentity;

    #[tokio::test]
    async fn test_batch_verification() {
        let pool = AgentPool::new(5);
        let workflow = AutonomousBatchWorkflow::new(pool, 1000, 10);

        let mut batch = BatchVerificationRequest::new();

        for i in 0..20 {
            let identity = AgentIdentity::generate().unwrap();
            let message = format!("message {}", i).into_bytes();
            let signature = identity.sign(&message).unwrap();
            batch.add(message, signature, identity.verifying_key());
        }

        let result = workflow
            .execute(batch, WorkflowContext::default())
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.data.total, 20);
        assert_eq!(result.data.successful, 20);
        assert!(result.data.throughput > 0.0);
    }
}
