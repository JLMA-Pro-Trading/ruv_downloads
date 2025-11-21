//! Trust chain validator for certificate chain traversal

use super::{Agent, AgentHealth, AgentMetrics, AgentState};
use crate::error::{Error, Result};
use async_trait::async_trait;
use ed25519_dalek::VerifyingKey;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Certificate in a trust chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Certificate {
    pub subject: String,
    pub issuer: String,
    pub public_key: Vec<u8>,
    pub valid_from: chrono::DateTime<chrono::Utc>,
    pub valid_until: chrono::DateTime<chrono::Utc>,
    pub signature: Vec<u8>,
}

impl Certificate {
    /// Check if certificate is currently valid
    pub fn is_valid_at(&self, time: chrono::DateTime<chrono::Utc>) -> bool {
        time >= self.valid_from && time <= self.valid_until
    }

    /// Check if certificate is self-signed (root CA)
    pub fn is_self_signed(&self) -> bool {
        self.subject == self.issuer
    }
}

/// Trust chain validation result
#[derive(Debug, Clone)]
pub struct TrustChainResult {
    pub is_valid: bool,
    pub chain: Vec<Certificate>,
    pub root_certificate: Option<Certificate>,
    pub validation_errors: Vec<String>,
}

/// Trust anchor (root certificate authority)
#[derive(Debug, Clone)]
pub struct TrustAnchor {
    pub name: String,
    pub public_key: VerifyingKey,
    pub certificate: Certificate,
}

/// Trust chain validator agent
pub struct TrustChainValidator {
    state: AgentState,
    trust_anchors: Arc<RwLock<HashMap<String, TrustAnchor>>>,
    certificate_cache: Arc<RwLock<HashMap<String, Certificate>>>,
    shutdown: Arc<RwLock<bool>>,
}

impl TrustChainValidator {
    /// Create a new trust chain validator
    pub fn new() -> Self {
        Self {
            state: AgentState::new(),
            trust_anchors: Arc::new(RwLock::new(HashMap::new())),
            certificate_cache: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Add a trust anchor (root CA)
    pub async fn add_trust_anchor(&self, anchor: TrustAnchor) -> Result<()> {
        let mut anchors = self.trust_anchors.write().await;
        anchors.insert(anchor.name.clone(), anchor);
        Ok(())
    }

    /// Remove a trust anchor
    pub async fn remove_trust_anchor(&self, name: &str) -> Result<()> {
        let mut anchors = self.trust_anchors.write().await;
        anchors.remove(name);
        Ok(())
    }

    /// Cache a certificate
    pub async fn cache_certificate(&self, cert: Certificate) -> Result<()> {
        let mut cache = self.certificate_cache.write().await;
        cache.insert(cert.subject.clone(), cert);
        Ok(())
    }

    /// Validate a certificate chain using DFS
    pub async fn validate_chain(&self, leaf_certificate: Certificate) -> Result<TrustChainResult> {
        let start = std::time::Instant::now();
        let mut chain = Vec::new();
        let mut visited = HashSet::new();
        let mut errors = Vec::new();
        let current_time = chrono::Utc::now();

        // Start DFS from leaf certificate
        let mut current = leaf_certificate.clone();
        chain.push(current.clone());

        let trust_anchors = self.trust_anchors.read().await;
        let certificate_cache = self.certificate_cache.read().await;

        loop {
            // Check if already visited (cycle detection)
            if visited.contains(&current.subject) {
                errors.push(format!("Cycle detected at: {}", current.subject));
                break;
            }
            visited.insert(current.subject.clone());

            // Check certificate validity
            if !current.is_valid_at(current_time) {
                errors.push(format!("Certificate expired or not yet valid: {}", current.subject));
            }

            // Check if we reached a root certificate
            if current.is_self_signed() {
                // Verify it's in our trust anchors
                if trust_anchors.contains_key(&current.subject) {
                    let processing_time = start.elapsed().as_secs_f64() * 1000.0;
                    self.state.record_task(errors.is_empty(), processing_time).await;

                    return Ok(TrustChainResult {
                        is_valid: errors.is_empty(),
                        chain,
                        root_certificate: Some(current),
                        validation_errors: errors,
                    });
                } else {
                    errors.push(format!("Root certificate not trusted: {}", current.subject));
                    break;
                }
            }

            // Find issuer certificate
            match certificate_cache.get(&current.issuer) {
                Some(issuer_cert) => {
                    current = issuer_cert.clone();
                    chain.push(current.clone());
                }
                None => {
                    errors.push(format!("Issuer certificate not found: {}", current.issuer));
                    break;
                }
            }

            // Prevent infinite loops
            if chain.len() > 10 {
                errors.push("Chain too long (max 10 certificates)".to_string());
                break;
            }
        }

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;
        self.state.record_task(false, processing_time).await;

        Ok(TrustChainResult {
            is_valid: false,
            chain,
            root_certificate: None,
            validation_errors: errors,
        })
    }

    /// Get all trust anchors
    pub async fn get_trust_anchors(&self) -> Vec<String> {
        let anchors = self.trust_anchors.read().await;
        anchors.keys().cloned().collect()
    }

    /// Clear certificate cache
    pub async fn clear_cache(&self) {
        let mut cache = self.certificate_cache.write().await;
        cache.clear();
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

impl Default for TrustChainValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for TrustChainValidator {
    fn agent_id(&self) -> Uuid {
        self.state.agent_id
    }

    fn agent_type(&self) -> &'static str {
        "TrustChainValidator"
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
    use crate::crypto::AgentIdentity;

    fn create_test_certificate(subject: &str, issuer: &str) -> Certificate {
        Certificate {
            subject: subject.to_string(),
            issuer: issuer.to_string(),
            public_key: vec![0u8; 32],
            valid_from: chrono::Utc::now() - chrono::Duration::days(30),
            valid_until: chrono::Utc::now() + chrono::Duration::days(30),
            signature: vec![0u8; 64],
        }
    }

    #[tokio::test]
    async fn test_trust_chain_validator_creation() {
        let validator = TrustChainValidator::new();
        assert_eq!(validator.agent_type(), "TrustChainValidator");
    }

    #[tokio::test]
    async fn test_add_trust_anchor() {
        let validator = TrustChainValidator::new();
        let identity = AgentIdentity::generate().unwrap();

        let anchor = TrustAnchor {
            name: "RootCA".to_string(),
            public_key: *identity.verifying_key(),
            certificate: create_test_certificate("RootCA", "RootCA"),
        };

        validator.add_trust_anchor(anchor).await.unwrap();

        let anchors = validator.get_trust_anchors().await;
        assert_eq!(anchors.len(), 1);
        assert!(anchors.contains(&"RootCA".to_string()));
    }

    #[tokio::test]
    async fn test_certificate_validity() {
        let cert = create_test_certificate("Test", "Issuer");
        assert!(cert.is_valid_at(chrono::Utc::now()));
        assert!(!cert.is_valid_at(chrono::Utc::now() + chrono::Duration::days(60)));
    }

    #[tokio::test]
    async fn test_validate_simple_chain() {
        let validator = TrustChainValidator::new();
        let identity = AgentIdentity::generate().unwrap();

        // Create root certificate
        let root_cert = create_test_certificate("RootCA", "RootCA");
        let root_anchor = TrustAnchor {
            name: "RootCA".to_string(),
            public_key: *identity.verifying_key(),
            certificate: root_cert.clone(),
        };
        validator.add_trust_anchor(root_anchor).await.unwrap();

        // Create intermediate certificate
        let intermediate_cert = create_test_certificate("IntermediateCA", "RootCA");
        validator.cache_certificate(root_cert.clone()).await.unwrap();
        validator.cache_certificate(intermediate_cert.clone()).await.unwrap();

        // Create leaf certificate
        let leaf_cert = create_test_certificate("Leaf", "IntermediateCA");

        validator.start().await.unwrap();

        let result = validator.validate_chain(leaf_cert).await.unwrap();
        assert!(result.is_valid);
        assert_eq!(result.chain.len(), 3);

        validator.shutdown().await.unwrap();
    }
}