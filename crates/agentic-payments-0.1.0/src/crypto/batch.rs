//! Batch signature verification for high performance

use crate::crypto::{Signature, verify_signature};
use crate::error::{Error, Result};
use ed25519_dalek::{VerifyingKey, PUBLIC_KEY_LENGTH};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};

/// Item for batch verification
#[derive(Debug, Clone)]
pub struct VerificationItem {
    /// Public key for verification
    pub public_key: VerifyingKey,
    /// Message that was signed
    pub message: Vec<u8>,
    /// Signature to verify
    pub signature: Signature,
    /// Optional identifier for this item
    pub id: Option<String>,
}

impl VerificationItem {
    /// Create a new verification item
    pub fn new(public_key: VerifyingKey, message: Vec<u8>, signature: Signature) -> Self {
        Self {
            public_key,
            message,
            signature,
            id: None,
        }
    }

    /// Create a verification item with an ID
    pub fn with_id(
        id: String,
        public_key: VerifyingKey,
        message: Vec<u8>,
        signature: Signature,
    ) -> Self {
        Self {
            public_key,
            message,
            signature,
            id: Some(id),
        }
    }
}

/// Result of batch verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    /// Total number of items verified
    pub total: usize,
    /// Number of valid signatures
    pub valid: usize,
    /// Number of invalid signatures
    pub invalid: usize,
    /// Time taken for batch verification
    pub verification_time: Duration,
    /// Throughput (verifications per second)
    pub throughput: f64,
    /// Individual results
    pub results: Vec<ItemResult>,
}

impl BatchResult {
    /// Calculate success rate as percentage
    pub fn success_rate(&self) -> f64 {
        if self.total == 0 {
            0.0
        } else {
            (self.valid as f64 / self.total as f64) * 100.0
        }
    }

    /// Check if all verifications were successful
    pub fn all_valid(&self) -> bool {
        self.valid == self.total
    }

    /// Get all invalid items
    pub fn invalid_items(&self) -> Vec<&ItemResult> {
        self.results.iter().filter(|r| !r.is_valid).collect()
    }
}

/// Result for individual item in batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemResult {
    /// Item ID if provided
    pub id: Option<String>,
    /// Whether the signature is valid
    pub is_valid: bool,
    /// Public key bytes
    pub public_key: [u8; PUBLIC_KEY_LENGTH],
    /// Error message if verification failed
    pub error: Option<String>,
}

/// Batch signature verifier with optimizations
pub struct BatchVerifier {
    /// Maximum batch size for optimal performance
    max_batch_size: usize,
}

impl BatchVerifier {
    /// Create a new batch verifier with default settings
    pub fn new() -> Self {
        Self::with_max_batch_size(1000)
    }

    /// Create a batch verifier with custom max batch size
    pub fn with_max_batch_size(max_batch_size: usize) -> Self {
        Self { max_batch_size }
    }

    /// Verify a batch of signatures
    pub async fn verify_batch(&self, items: Vec<VerificationItem>) -> Result<BatchResult> {
        if items.is_empty() {
            return Ok(BatchResult {
                total: 0,
                valid: 0,
                invalid: 0,
                verification_time: Duration::ZERO,
                throughput: 0.0,
                results: vec![],
            });
        }

        let start = SystemTime::now();
        let total = items.len();

        // Use tokio tasks for async parallelism
        let mut tasks = Vec::new();

        for item in items {
            let task = tokio::spawn(async move {
                Self::verify_item(item).await
            });
            tasks.push(task);
        }

        // Collect results
        let mut results = Vec::new();
        let mut valid = 0;

        for task in tasks {
            let result = task.await
                .map_err(|e| Error::TaskJoin(e.to_string()))?;

            if result.is_valid {
                valid += 1;
            }
            results.push(result);
        }

        let verification_time = start.elapsed().unwrap_or(Duration::ZERO);
        let throughput = if verification_time.as_secs_f64() > 0.0 {
            total as f64 / verification_time.as_secs_f64()
        } else {
            0.0
        };

        Ok(BatchResult {
            total,
            valid,
            invalid: total - valid,
            verification_time,
            throughput,
            results,
        })
    }

    /// Verify a single item (internal helper)
    async fn verify_item(item: VerificationItem) -> ItemResult {
        match verify_signature(&item.public_key, &item.message, &item.signature) {
            Ok(is_valid) => ItemResult {
                id: item.id,
                is_valid,
                public_key: item.public_key.to_bytes(),
                error: None,
            },
            Err(e) => ItemResult {
                id: item.id,
                is_valid: false,
                public_key: item.public_key.to_bytes(),
                error: Some(e.to_string()),
            },
        }
    }

    /// Verify a large batch by splitting into chunks
    pub async fn verify_large_batch(&self, items: Vec<VerificationItem>) -> Result<BatchResult> {
        if items.len() <= self.max_batch_size {
            return self.verify_batch(items).await;
        }

        let start = SystemTime::now();
        let total = items.len();

        // Split into chunks
        let chunks: Vec<_> = items
            .chunks(self.max_batch_size)
            .map(|chunk| chunk.to_vec())
            .collect();

        // Process chunks in parallel
        let mut tasks = Vec::new();
        for chunk in chunks {
            let verifier = Self::with_max_batch_size(self.max_batch_size);
            let task = tokio::spawn(async move {
                verifier.verify_batch(chunk).await
            });
            tasks.push(task);
        }

        // Aggregate results
        let mut all_results = Vec::new();
        let mut valid = 0;

        for task in tasks {
            let batch_result = task.await
                .map_err(|e| Error::TaskJoin(e.to_string()))??;

            valid += batch_result.valid;
            all_results.extend(batch_result.results);
        }

        let verification_time = start.elapsed().unwrap_or(Duration::ZERO);
        let throughput = if verification_time.as_secs_f64() > 0.0 {
            total as f64 / verification_time.as_secs_f64()
        } else {
            0.0
        };

        Ok(BatchResult {
            total,
            valid,
            invalid: total - valid,
            verification_time,
            throughput,
            results: all_results,
        })
    }

    /// Get the maximum batch size
    pub fn max_batch_size(&self) -> usize {
        self.max_batch_size
    }
}

impl Default for BatchVerifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{generate_keypair, sign_message};

    #[tokio::test]
    async fn test_batch_verify_empty() {
        let verifier = BatchVerifier::new();
        let result = verifier.verify_batch(vec![]).await.unwrap();

        assert_eq!(result.total, 0);
        assert_eq!(result.valid, 0);
    }

    #[tokio::test]
    async fn test_batch_verify_single() {
        let verifier = BatchVerifier::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message".to_vec();
        let signature = sign_message(&signing_key, &message).unwrap();

        let items = vec![
            VerificationItem::new(verifying_key, message, signature)
        ];

        let result = verifier.verify_batch(items).await.unwrap();

        assert_eq!(result.total, 1);
        assert_eq!(result.valid, 1);
        assert!(result.all_valid());
    }

    #[tokio::test]
    async fn test_batch_verify_multiple() {
        let verifier = BatchVerifier::new();
        let mut items = Vec::new();

        for i in 0..10 {
            let (signing_key, verifying_key) = generate_keypair().unwrap();
            let message = format!("message {}", i).into_bytes();
            let signature = sign_message(&signing_key, &message).unwrap();

            items.push(VerificationItem::with_id(
                format!("item-{}", i),
                verifying_key,
                message,
                signature,
            ));
        }

        let result = verifier.verify_batch(items).await.unwrap();

        assert_eq!(result.total, 10);
        assert_eq!(result.valid, 10);
        assert!(result.all_valid());
        assert_eq!(result.success_rate(), 100.0);
    }

    #[tokio::test]
    async fn test_batch_verify_mixed() {
        let verifier = BatchVerifier::new();
        let mut items = Vec::new();

        // Add valid signatures
        for i in 0..5 {
            let (signing_key, verifying_key) = generate_keypair().unwrap();
            let message = format!("message {}", i).into_bytes();
            let signature = sign_message(&signing_key, &message).unwrap();

            items.push(VerificationItem::new(verifying_key, message, signature));
        }

        // Add invalid signatures (wrong key)
        for i in 5..10 {
            let (signing_key, _) = generate_keypair().unwrap();
            let (_, wrong_key) = generate_keypair().unwrap();
            let message = format!("message {}", i).into_bytes();
            let signature = sign_message(&signing_key, &message).unwrap();

            items.push(VerificationItem::new(wrong_key, message, signature));
        }

        let result = verifier.verify_batch(items).await.unwrap();

        assert_eq!(result.total, 10);
        assert_eq!(result.valid, 5);
        assert_eq!(result.invalid, 5);
        assert!(!result.all_valid());
        assert_eq!(result.success_rate(), 50.0);
    }

    #[tokio::test]
    async fn test_batch_verify_large() {
        let verifier = BatchVerifier::with_max_batch_size(10);
        let mut items = Vec::new();

        for i in 0..100 {
            let (signing_key, verifying_key) = generate_keypair().unwrap();
            let message = format!("message {}", i).into_bytes();
            let signature = sign_message(&signing_key, &message).unwrap();

            items.push(VerificationItem::new(verifying_key, message, signature));
        }

        let result = verifier.verify_large_batch(items).await.unwrap();

        assert_eq!(result.total, 100);
        assert_eq!(result.valid, 100);
        assert!(result.all_valid());
        assert!(result.throughput > 0.0);
    }

    #[tokio::test]
    async fn test_batch_result_invalid_items() {
        let verifier = BatchVerifier::new();
        let mut items = Vec::new();

        // Add one valid signature
        let (sk1, vk1) = generate_keypair().unwrap();
        let msg1 = b"valid".to_vec();
        let sig1 = sign_message(&sk1, &msg1).unwrap();
        items.push(VerificationItem::with_id("valid".to_string(), vk1, msg1, sig1));

        // Add one invalid signature
        let (sk2, _) = generate_keypair().unwrap();
        let (_, vk3) = generate_keypair().unwrap();
        let msg2 = b"invalid".to_vec();
        let sig2 = sign_message(&sk2, &msg2).unwrap();
        items.push(VerificationItem::with_id("invalid".to_string(), vk3, msg2, sig2));

        let result = verifier.verify_batch(items).await.unwrap();
        let invalid = result.invalid_items();

        assert_eq!(invalid.len(), 1);
        assert_eq!(invalid[0].id.as_ref().unwrap(), "invalid");
    }
}