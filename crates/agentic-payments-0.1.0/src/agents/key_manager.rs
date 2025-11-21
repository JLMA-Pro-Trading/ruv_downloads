//! Key management agent for secure key lifecycle

use super::{Agent, AgentHealth, AgentMetrics, AgentState};
use crate::crypto::AgentIdentity;
use crate::error::{Error, Result};
use async_trait::async_trait;
use ed25519_dalek::{SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use zeroize::Zeroizing;

/// Key metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyMetadata {
    pub key_id: Uuid,
    pub purpose: KeyPurpose,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub rotated_from: Option<Uuid>,
    pub active: bool,
}

/// Purpose of a cryptographic key
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KeyPurpose {
    /// Agent identity signing
    AgentIdentity,
    /// Certificate signing
    CertificateSigning,
    /// Document signing
    DocumentSigning,
    /// Authentication
    Authentication,
}

/// Stored key entry
struct StoredKey {
    identity: AgentIdentity,
    metadata: KeyMetadata,
}

/// Key rotation policy
#[derive(Debug, Clone)]
pub struct RotationPolicy {
    /// Maximum key age in days
    pub max_age_days: u32,
    /// Whether to automatically rotate keys
    pub auto_rotate: bool,
}

impl Default for RotationPolicy {
    fn default() -> Self {
        Self {
            max_age_days: 90,
            auto_rotate: true,
        }
    }
}

/// Key management agent for secure key lifecycle
pub struct KeyManagementAgent {
    state: AgentState,
    keys: Arc<RwLock<HashMap<Uuid, StoredKey>>>,
    rotation_policy: Arc<RwLock<RotationPolicy>>,
    shutdown: Arc<RwLock<bool>>,
}

impl KeyManagementAgent {
    /// Create a new key management agent
    pub fn new() -> Self {
        Self {
            state: AgentState::new(),
            keys: Arc::new(RwLock::new(HashMap::new())),
            rotation_policy: Arc::new(RwLock::new(RotationPolicy::default())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Generate a new key
    pub async fn generate_key(&self, purpose: KeyPurpose, expires_in_days: Option<u32>) -> Result<Uuid> {
        let start = std::time::Instant::now();

        let identity = AgentIdentity::generate()?;
        let key_id = Uuid::new_v4();

        let expires_at = expires_in_days.map(|days| {
            chrono::Utc::now() + chrono::Duration::days(days as i64)
        });

        let metadata = KeyMetadata {
            key_id,
            purpose,
            created_at: chrono::Utc::now(),
            expires_at,
            rotated_from: None,
            active: true,
        };

        let stored = StoredKey { identity, metadata };

        let mut keys = self.keys.write().await;
        keys.insert(key_id, stored);

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;
        self.state.record_task(true, processing_time).await;

        Ok(key_id)
    }

    /// Get key by ID
    pub async fn get_key(&self, key_id: Uuid) -> Result<AgentIdentity> {
        let keys = self.keys.read().await;
        let stored = keys.get(&key_id)
            .ok_or_else(|| Error::KeyNotFound(key_id.to_string()))?;

        // Check if key is expired
        if let Some(expires_at) = stored.metadata.expires_at {
            if chrono::Utc::now() > expires_at {
                return Err(Error::KeyExpired(key_id.to_string()));
            }
        }

        // Check if key is active
        if !stored.metadata.active {
            return Err(Error::KeyManagement(format!("Key is inactive: {}", key_id)));
        }

        Ok(stored.identity.clone())
    }

    /// Get key metadata
    pub async fn get_metadata(&self, key_id: Uuid) -> Result<KeyMetadata> {
        let keys = self.keys.read().await;
        let stored = keys.get(&key_id)
            .ok_or_else(|| Error::KeyNotFound(key_id.to_string()))?;
        Ok(stored.metadata.clone())
    }

    /// Rotate a key (generate new key and mark old one as rotated)
    pub async fn rotate_key(&self, old_key_id: Uuid) -> Result<Uuid> {
        let start = std::time::Instant::now();

        // Get old key metadata
        let purpose = {
            let keys = self.keys.read().await;
            let stored = keys.get(&old_key_id)
                .ok_or_else(|| Error::KeyNotFound(old_key_id.to_string()))?;
            stored.metadata.purpose
        };

        // Generate new key
        let new_identity = AgentIdentity::generate()?;
        let new_key_id = Uuid::new_v4();

        let new_metadata = KeyMetadata {
            key_id: new_key_id,
            purpose,
            created_at: chrono::Utc::now(),
            expires_at: None,
            rotated_from: Some(old_key_id),
            active: true,
        };

        // Update keys
        let mut keys = self.keys.write().await;

        // Deactivate old key
        if let Some(old_stored) = keys.get_mut(&old_key_id) {
            old_stored.metadata.active = false;
        }

        // Store new key
        keys.insert(new_key_id, StoredKey {
            identity: new_identity,
            metadata: new_metadata,
        });

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;
        self.state.record_task(true, processing_time).await;

        Ok(new_key_id)
    }

    /// Revoke a key
    pub async fn revoke_key(&self, key_id: Uuid) -> Result<()> {
        let mut keys = self.keys.write().await;

        let stored = keys.get_mut(&key_id)
            .ok_or_else(|| Error::KeyNotFound(key_id.to_string()))?;

        stored.metadata.active = false;

        Ok(())
    }

    /// Delete a key (permanently remove)
    pub async fn delete_key(&self, key_id: Uuid) -> Result<()> {
        let mut keys = self.keys.write().await;
        keys.remove(&key_id)
            .ok_or_else(|| Error::KeyNotFound(key_id.to_string()))?;
        Ok(())
    }

    /// List all active keys
    pub async fn list_active_keys(&self) -> Vec<KeyMetadata> {
        let keys = self.keys.read().await;
        keys.values()
            .filter(|k| k.metadata.active)
            .map(|k| k.metadata.clone())
            .collect()
    }

    /// List keys by purpose
    pub async fn list_keys_by_purpose(&self, purpose: KeyPurpose) -> Vec<KeyMetadata> {
        let keys = self.keys.read().await;
        keys.values()
            .filter(|k| k.metadata.active && k.metadata.purpose == purpose)
            .map(|k| k.metadata.clone())
            .collect()
    }

    /// Check for keys that need rotation
    pub async fn check_rotation_needed(&self) -> Vec<Uuid> {
        let keys = self.keys.read().await;
        let policy = self.rotation_policy.read().await;

        let cutoff = chrono::Utc::now() - chrono::Duration::days(policy.max_age_days as i64);

        keys.values()
            .filter(|k| k.metadata.active && k.metadata.created_at < cutoff)
            .map(|k| k.metadata.key_id)
            .collect()
    }

    /// Set rotation policy
    pub async fn set_rotation_policy(&self, policy: RotationPolicy) {
        let mut p = self.rotation_policy.write().await;
        *p = policy;
    }

    /// Run background key rotation check
    async fn rotation_loop(
        keys: Arc<RwLock<HashMap<Uuid, StoredKey>>>,
        rotation_policy: Arc<RwLock<RotationPolicy>>,
        shutdown: Arc<RwLock<bool>>,
    ) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Check hourly

        loop {
            interval.tick().await;

            if *shutdown.read().await {
                break;
            }

            let policy = rotation_policy.read().await;
            if !policy.auto_rotate {
                continue;
            }

            let cutoff = chrono::Utc::now() - chrono::Duration::days(policy.max_age_days as i64);
            drop(policy);

            // Find keys needing rotation
            let keys_to_rotate: Vec<Uuid> = {
                let keys_guard = keys.read().await;
                keys_guard.values()
                    .filter(|k| k.metadata.active && k.metadata.created_at < cutoff)
                    .map(|k| k.metadata.key_id)
                    .collect()
            };

            // Log rotation candidates
            if !keys_to_rotate.is_empty() {
                tracing::info!("Found {} keys needing rotation", keys_to_rotate.len());
            }
        }
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

impl Default for KeyManagementAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for KeyManagementAgent {
    fn agent_id(&self) -> Uuid {
        self.state.agent_id
    }

    fn agent_type(&self) -> &'static str {
        "KeyManagementAgent"
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

        // Start heartbeat loop
        tokio::spawn(async move {
            Self::heartbeat_loop(state, shutdown).await;
        });

        // Start rotation check loop
        let keys = self.keys.clone();
        let rotation_policy = self.rotation_policy.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            Self::rotation_loop(keys, rotation_policy, shutdown).await;
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
    async fn test_key_manager_creation() {
        let manager = KeyManagementAgent::new();
        assert_eq!(manager.agent_type(), "KeyManagementAgent");
    }

    #[tokio::test]
    async fn test_generate_key() {
        let manager = KeyManagementAgent::new();
        let key_id = manager.generate_key(KeyPurpose::AgentIdentity, Some(90)).await.unwrap();

        let metadata = manager.get_metadata(key_id).await.unwrap();
        assert_eq!(metadata.purpose, KeyPurpose::AgentIdentity);
        assert!(metadata.active);
    }

    #[tokio::test]
    async fn test_key_rotation() {
        let manager = KeyManagementAgent::new();
        let old_key_id = manager.generate_key(KeyPurpose::Authentication, None).await.unwrap();

        let new_key_id = manager.rotate_key(old_key_id).await.unwrap();

        let old_metadata = manager.get_metadata(old_key_id).await.unwrap();
        let new_metadata = manager.get_metadata(new_key_id).await.unwrap();

        assert!(!old_metadata.active);
        assert!(new_metadata.active);
        assert_eq!(new_metadata.rotated_from, Some(old_key_id));
    }

    #[tokio::test]
    async fn test_list_keys_by_purpose() {
        let manager = KeyManagementAgent::new();

        manager.generate_key(KeyPurpose::AgentIdentity, None).await.unwrap();
        manager.generate_key(KeyPurpose::AgentIdentity, None).await.unwrap();
        manager.generate_key(KeyPurpose::Authentication, None).await.unwrap();

        let identity_keys = manager.list_keys_by_purpose(KeyPurpose::AgentIdentity).await;
        assert_eq!(identity_keys.len(), 2);

        let auth_keys = manager.list_keys_by_purpose(KeyPurpose::Authentication).await;
        assert_eq!(auth_keys.len(), 1);
    }

    #[tokio::test]
    async fn test_revoke_key() {
        let manager = KeyManagementAgent::new();
        let key_id = manager.generate_key(KeyPurpose::DocumentSigning, None).await.unwrap();

        manager.revoke_key(key_id).await.unwrap();

        let result = manager.get_key(key_id).await;
        assert!(result.is_err());
    }
}