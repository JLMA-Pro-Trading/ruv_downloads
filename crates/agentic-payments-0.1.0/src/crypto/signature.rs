//! Signature management and verification operations

use crate::crypto::{verify_signature, Signature};
use crate::error::{CryptoError, Error, Result};
use ed25519_dalek::VerifyingKey;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;

/// Manager for signature operations with caching and verification
pub struct SignatureManager {
    /// Cache of recently verified signatures
    cache: Arc<RwLock<SignatureCache>>,
    /// Cache TTL
    cache_ttl: Duration,
}

impl SignatureManager {
    /// Create a new signature manager with default cache TTL (5 minutes)
    pub fn new() -> Self {
        Self::with_cache_ttl(Duration::from_secs(300))
    }

    /// Create a new signature manager with custom cache TTL
    pub fn with_cache_ttl(cache_ttl: Duration) -> Self {
        Self {
            cache: Arc::new(RwLock::new(SignatureCache::new())),
            cache_ttl,
        }
    }

    /// Verify a signature with caching
    pub async fn verify(
        &self,
        public_key: &VerifyingKey,
        message: &[u8],
        signature: &Signature,
    ) -> Result<SignatureResult> {
        let cache_key = Self::compute_cache_key(public_key, message, signature);

        // Check cache first
        {
            let mut cache = self.cache.write().await;
            if let Some(result) = cache.get(&cache_key) {
                if !result.is_expired(self.cache_ttl) {
                    return Ok(result.clone());
                }
            }
        }

        // Perform verification
        let start = SystemTime::now();
        let is_valid = verify_signature(public_key, message, signature)?;
        let verification_time = start.elapsed().unwrap_or(Duration::ZERO);

        let result = SignatureResult {
            is_valid,
            verified_at: SystemTime::now(),
            verification_time,
            public_key: public_key.to_bytes(),
            cached: false,
        };

        // Update cache
        if is_valid {
            let mut cache = self.cache.write().await;
            cache.insert(cache_key, result.clone());
        }

        Ok(result)
    }

    /// Verify multiple signatures (non-batched)
    pub async fn verify_many(
        &self,
        items: Vec<(VerifyingKey, Vec<u8>, Signature)>,
    ) -> Result<Vec<SignatureResult>> {
        let mut results = Vec::with_capacity(items.len());

        for (public_key, message, signature) in items {
            let result = self.verify(&public_key, &message, &signature).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Clear the signature cache
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }

    /// Get cache statistics
    pub async fn cache_stats(&self) -> CacheStats {
        let cache = self.cache.read().await;
        CacheStats {
            size: cache.size(),
            hits: cache.hits,
            misses: cache.misses,
        }
    }

    /// Compute a cache key for a signature verification
    fn compute_cache_key(
        public_key: &VerifyingKey,
        message: &[u8],
        signature: &Signature,
    ) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(public_key.as_bytes());
        hasher.update(message);
        hasher.update(&signature.to_bytes());
        hex::encode(hasher.finalize())
    }
}

impl Default for SignatureManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of a signature verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureResult {
    /// Whether the signature is valid
    pub is_valid: bool,
    /// When the signature was verified
    pub verified_at: SystemTime,
    /// Time taken to verify
    pub verification_time: Duration,
    /// Public key used for verification
    pub public_key: [u8; 32],
    /// Whether this result came from cache
    pub cached: bool,
}

impl SignatureResult {
    /// Check if the result has expired based on TTL
    pub fn is_expired(&self, ttl: Duration) -> bool {
        if let Ok(elapsed) = self.verified_at.elapsed() {
            elapsed > ttl
        } else {
            true
        }
    }

    /// Get the age of this result
    pub fn age(&self) -> Option<Duration> {
        self.verified_at.elapsed().ok()
    }
}

/// Cache for signature verification results
struct SignatureCache {
    entries: std::collections::HashMap<String, SignatureResult>,
    hits: u64,
    misses: u64,
}

impl SignatureCache {
    fn new() -> Self {
        Self {
            entries: std::collections::HashMap::new(),
            hits: 0,
            misses: 0,
        }
    }

    fn get(&mut self, key: &str) -> Option<&SignatureResult> {
        if let Some(result) = self.entries.get(key) {
            self.hits += 1;
            Some(result)
        } else {
            self.misses += 1;
            None
        }
    }

    fn insert(&mut self, key: String, result: SignatureResult) {
        self.entries.insert(key, result);
    }

    fn clear(&mut self) {
        self.entries.clear();
    }

    fn size(&self) -> usize {
        self.entries.len()
    }
}

/// Statistics about the signature cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    /// Number of entries in cache
    pub size: usize,
    /// Number of cache hits
    pub hits: u64,
    /// Number of cache misses
    pub misses: u64,
}

impl CacheStats {
    /// Calculate hit rate as a percentage
    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            (self.hits as f64 / total as f64) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{generate_keypair, sign_message};

    #[tokio::test]
    async fn test_signature_manager_verify() {
        let manager = SignatureManager::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();
        let result = manager.verify(&verifying_key, message, &signature).await.unwrap();

        assert!(result.is_valid);
        assert!(!result.cached);
    }

    #[tokio::test]
    async fn test_signature_manager_cache() {
        let manager = SignatureManager::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();

        // First verification (not cached)
        let result1 = manager.verify(&verifying_key, message, &signature).await.unwrap();
        assert!(result1.is_valid);
        assert!(!result1.cached);

        // Second verification (should be cached)
        let result2 = manager.verify(&verifying_key, message, &signature).await.unwrap();
        assert!(result2.is_valid);
    }

    #[tokio::test]
    async fn test_signature_manager_cache_stats() {
        let manager = SignatureManager::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();

        // First verification
        manager.verify(&verifying_key, message, &signature).await.unwrap();

        // Second verification
        manager.verify(&verifying_key, message, &signature).await.unwrap();

        let stats = manager.cache_stats().await;
        assert_eq!(stats.size, 1);
        assert!(stats.hits > 0);
    }

    #[tokio::test]
    async fn test_signature_manager_verify_many() {
        let manager = SignatureManager::new();

        let mut items = Vec::new();
        for _ in 0..5 {
            let (signing_key, verifying_key) = generate_keypair().unwrap();
            let message = b"test message".to_vec();
            let signature = sign_message(&signing_key, &message).unwrap();
            items.push((verifying_key, message, signature));
        }

        let results = manager.verify_many(items).await.unwrap();
        assert_eq!(results.len(), 5);
        assert!(results.iter().all(|r| r.is_valid));
    }

    #[tokio::test]
    async fn test_signature_manager_clear_cache() {
        let manager = SignatureManager::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();

        // Verify to populate cache
        manager.verify(&verifying_key, message, &signature).await.unwrap();

        let stats_before = manager.cache_stats().await;
        assert_eq!(stats_before.size, 1);

        // Clear cache
        manager.clear_cache().await;

        let stats_after = manager.cache_stats().await;
        assert_eq!(stats_after.size, 0);
    }

    #[tokio::test]
    async fn test_signature_result_expiration() {
        let result = SignatureResult {
            is_valid: true,
            verified_at: SystemTime::now() - Duration::from_secs(10),
            verification_time: Duration::from_micros(100),
            public_key: [0u8; 32],
            cached: false,
        };

        // Should be expired with 5 second TTL
        assert!(result.is_expired(Duration::from_secs(5)));

        // Should not be expired with 15 second TTL
        assert!(!result.is_expired(Duration::from_secs(15)));
    }

    #[tokio::test]
    async fn test_cache_stats_hit_rate() {
        let manager = SignatureManager::new();
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();

        // First verification (miss)
        manager.verify(&verifying_key, message, &signature).await.unwrap();

        // Multiple cached verifications (hits)
        for _ in 0..9 {
            manager.verify(&verifying_key, message, &signature).await.unwrap();
        }

        let stats = manager.cache_stats().await;
        assert!(stats.hit_rate() > 80.0); // Should be ~90%
    }

    #[tokio::test]
    async fn test_invalid_signature() {
        let manager = SignatureManager::new();
        let (signing_key1, _) = generate_keypair().unwrap();
        let (_, verifying_key2) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key1, message).unwrap();
        let result = manager.verify(&verifying_key2, message, &signature).await.unwrap();

        assert!(!result.is_valid);
    }
}