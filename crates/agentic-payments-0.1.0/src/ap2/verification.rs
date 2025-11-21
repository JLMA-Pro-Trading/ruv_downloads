//! Multi-Agent Consensus Verification for Credentials

use super::{Ap2Error, Result};
use crate::ap2::credentials::VerifiableCredential;
use crate::ap2::did::DidResolver;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Verification Result with consensus details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub verified: bool,
    pub consensus_achieved: bool,
    pub verifier_count: usize,
    pub approval_count: usize,
    pub rejection_count: usize,
    pub threshold_percentage: f64,
    pub verifier_results: Vec<VerifierResult>,
    pub timestamp: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Individual verifier result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierResult {
    pub verifier_id: String,
    pub verified: bool,
    pub timestamp: DateTime<Utc>,
    pub reason: Option<String>,
}

/// Verifier Node in the consensus network
#[derive(Debug, Clone)]
pub struct VerifierNode {
    pub id: String,
    pub did: String,
    pub endpoint: String,
    pub weight: f64, // Voting weight (default 1.0)
    pub reputation: f64,
}

impl VerifierNode {
    pub fn new(id: String, did: String, endpoint: String) -> Self {
        Self {
            id,
            did,
            endpoint,
            weight: 1.0,
            reputation: 1.0,
        }
    }

    pub fn with_weight(mut self, weight: f64) -> Self {
        self.weight = weight;
        self
    }

    pub fn with_reputation(mut self, reputation: f64) -> Self {
        self.reputation = reputation;
        self
    }
}

/// Consensus Verification Engine
#[derive(Debug)]
pub struct ConsensusVerification {
    threshold: f64,            // Percentage of approval needed (0.0 - 1.0)
    min_verifiers: usize,      // Minimum number of verifiers required
    timeout_seconds: u64,      // Verification timeout
}

impl ConsensusVerification {
    pub fn new(threshold: f64, min_verifiers: usize) -> Self {
        Self {
            threshold: threshold.clamp(0.0, 1.0),
            min_verifiers,
            timeout_seconds: 30,
        }
    }

    pub fn with_timeout(mut self, timeout_seconds: u64) -> Self {
        self.timeout_seconds = timeout_seconds;
        self
    }

    /// Verify credential with consensus from multiple verifiers
    pub async fn verify(
        &self,
        credential: &VerifiableCredential,
        verifiers: Vec<VerifierNode>,
        did_resolver: &DidResolver,
    ) -> Result<VerificationResult> {
        if verifiers.len() < self.min_verifiers {
            return Err(Ap2Error::ConsensusVerificationFailed(format!(
                "Insufficient verifiers: {} < {}",
                verifiers.len(),
                self.min_verifiers
            )));
        }

        // First verify the credential signature locally
        let signature_valid = credential.verify(did_resolver)?;
        if !signature_valid {
            return Ok(VerificationResult {
                verified: false,
                consensus_achieved: false,
                verifier_count: 0,
                approval_count: 0,
                rejection_count: 0,
                threshold_percentage: self.threshold,
                verifier_results: vec![],
                timestamp: Utc::now(),
                metadata: HashMap::from([(
                    "error".to_string(),
                    "Signature verification failed".to_string(),
                )]),
            });
        }

        // Perform parallel verification with all verifiers
        let verification_futures: Vec<_> = verifiers
            .iter()
            .map(|verifier| self.verify_with_node(credential, verifier, did_resolver))
            .collect();

        let results = futures::future::join_all(verification_futures).await;

        // Calculate consensus
        let verifier_results: Vec<VerifierResult> = results.into_iter().flatten().collect();

        let total_weight: f64 = verifiers.iter().map(|v| v.weight * v.reputation).sum();
        let approval_weight: f64 = verifier_results
            .iter()
            .zip(verifiers.iter())
            .filter(|(r, _)| r.verified)
            .map(|(_, v)| v.weight * v.reputation)
            .sum();

        let approval_percentage = if total_weight > 0.0 {
            approval_weight / total_weight
        } else {
            0.0
        };

        let approval_count = verifier_results.iter().filter(|r| r.verified).count();
        let rejection_count = verifier_results.len() - approval_count;
        let consensus_achieved = approval_percentage >= self.threshold;

        Ok(VerificationResult {
            verified: consensus_achieved,
            consensus_achieved,
            verifier_count: verifiers.len(),
            approval_count,
            rejection_count,
            threshold_percentage: self.threshold,
            verifier_results,
            timestamp: Utc::now(),
            metadata: HashMap::from([
                ("approval_percentage".to_string(), approval_percentage.to_string()),
                ("total_weight".to_string(), total_weight.to_string()),
                ("approval_weight".to_string(), approval_weight.to_string()),
            ]),
        })
    }

    /// Verify with a single verifier node
    async fn verify_with_node(
        &self,
        credential: &VerifiableCredential,
        verifier: &VerifierNode,
        did_resolver: &DidResolver,
    ) -> Result<VerifierResult> {
        // In production, this would make an HTTP request to the verifier endpoint
        // For now, we simulate verification by checking the credential locally
        let verified = credential.verify(did_resolver).unwrap_or(false);

        Ok(VerifierResult {
            verifier_id: verifier.id.clone(),
            verified,
            timestamp: Utc::now(),
            reason: if verified {
                None
            } else {
                Some("Verification failed".to_string())
            },
        })
    }
}

impl Default for ConsensusVerification {
    fn default() -> Self {
        Self::new(0.66, 3) // 2/3 majority with minimum 3 verifiers
    }
}

/// Verification Workflow Manager
#[derive(Debug)]
pub struct VerificationWorkflow {
    consensus: ConsensusVerification,
    verifier_registry: RwLock<HashMap<String, VerifierNode>>,
}

impl VerificationWorkflow {
    pub fn new() -> Self {
        Self {
            consensus: ConsensusVerification::default(),
            verifier_registry: RwLock::new(HashMap::new()),
        }
    }

    pub fn with_consensus(mut self, consensus: ConsensusVerification) -> Self {
        self.consensus = consensus;
        self
    }

    /// Register a verifier node
    pub async fn register_verifier(&self, verifier: VerifierNode) {
        let mut registry = self.verifier_registry.write().await;
        registry.insert(verifier.id.clone(), verifier);
    }

    /// Unregister a verifier node
    pub async fn unregister_verifier(&self, verifier_id: &str) -> bool {
        let mut registry = self.verifier_registry.write().await;
        registry.remove(verifier_id).is_some()
    }

    /// Get all registered verifiers
    pub async fn get_verifiers(&self) -> Vec<VerifierNode> {
        let registry = self.verifier_registry.read().await;
        registry.values().cloned().collect()
    }

    /// Get verifier by ID
    pub async fn get_verifier(&self, verifier_id: &str) -> Option<VerifierNode> {
        let registry = self.verifier_registry.read().await;
        registry.get(verifier_id).cloned()
    }

    /// Verify credential with consensus from registered verifiers
    pub async fn verify_with_consensus(
        &self,
        credential: &VerifiableCredential,
        verifiers: Vec<VerifierNode>,
        did_resolver: &DidResolver,
    ) -> Result<VerificationResult> {
        self.consensus.verify(credential, verifiers, did_resolver).await
    }

    /// Verify credential with all registered verifiers
    pub async fn verify_with_all_verifiers(
        &self,
        credential: &VerifiableCredential,
        did_resolver: &DidResolver,
    ) -> Result<VerificationResult> {
        let verifiers = self.get_verifiers().await;
        self.verify_with_consensus(credential, verifiers, did_resolver).await
    }

    /// Update verifier reputation based on verification result
    pub async fn update_verifier_reputation(&self, verifier_id: &str, reputation_delta: f64) {
        let mut registry = self.verifier_registry.write().await;
        if let Some(verifier) = registry.get_mut(verifier_id) {
            verifier.reputation = (verifier.reputation + reputation_delta).clamp(0.0, 2.0);
        }
    }
}

impl Default for VerificationWorkflow {
    fn default() -> Self {
        Self::new()
    }
}

/// Verification Policy - Defines rules for verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationPolicy {
    pub min_verifiers: usize,
    pub consensus_threshold: f64,
    pub timeout_seconds: u64,
    pub require_signature: bool,
    pub require_expiration_check: bool,
    pub allowed_credential_types: Vec<String>,
}

impl VerificationPolicy {
    pub fn strict() -> Self {
        Self {
            min_verifiers: 5,
            consensus_threshold: 0.8,
            timeout_seconds: 30,
            require_signature: true,
            require_expiration_check: true,
            allowed_credential_types: vec!["VerifiableCredential".to_string()],
        }
    }

    pub fn standard() -> Self {
        Self {
            min_verifiers: 3,
            consensus_threshold: 0.66,
            timeout_seconds: 30,
            require_signature: true,
            require_expiration_check: true,
            allowed_credential_types: vec![],
        }
    }

    pub fn permissive() -> Self {
        Self {
            min_verifiers: 1,
            consensus_threshold: 0.5,
            timeout_seconds: 60,
            require_signature: true,
            require_expiration_check: false,
            allowed_credential_types: vec![],
        }
    }

    pub fn validate(&self, credential: &VerifiableCredential) -> Result<()> {
        if self.require_expiration_check && credential.is_expired() {
            return Err(Ap2Error::Expired);
        }

        if !self.allowed_credential_types.is_empty() {
            let has_allowed_type = credential
                .types
                .iter()
                .any(|t| self.allowed_credential_types.contains(t));

            if !has_allowed_type {
                return Err(Ap2Error::InvalidCredential(
                    "Credential type not allowed by policy".to_string(),
                ));
            }
        }

        Ok(())
    }
}

impl Default for VerificationPolicy {
    fn default() -> Self {
        Self::standard()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verifier_node_creation() {
        let node = VerifierNode::new(
            "verifier1".to_string(),
            "did:ap2:verifier1".to_string(),
            "https://verifier1.example.com".to_string(),
        );

        assert_eq!(node.weight, 1.0);
        assert_eq!(node.reputation, 1.0);
    }

    #[test]
    fn test_consensus_verification_initialization() {
        let consensus = ConsensusVerification::new(0.66, 3);
        assert_eq!(consensus.threshold, 0.66);
        assert_eq!(consensus.min_verifiers, 3);
    }

    #[test]
    fn test_verification_policy_validation() {
        let policy = VerificationPolicy::strict();
        assert_eq!(policy.min_verifiers, 5);
        assert_eq!(policy.consensus_threshold, 0.8);
    }

    #[tokio::test]
    async fn test_workflow_verifier_registration() {
        let workflow = VerificationWorkflow::new();
        let verifier = VerifierNode::new(
            "test1".to_string(),
            "did:ap2:test1".to_string(),
            "https://test1.example.com".to_string(),
        );

        workflow.register_verifier(verifier.clone()).await;

        let verifiers = workflow.get_verifiers().await;
        assert_eq!(verifiers.len(), 1);
        assert_eq!(verifiers[0].id, "test1");
    }
}