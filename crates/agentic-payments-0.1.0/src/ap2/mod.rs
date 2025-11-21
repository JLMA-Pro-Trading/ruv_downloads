//! Agent Payments Protocol (AP2) Implementation
//!
//! AP2 provides a standardized protocol for agent-to-agent payments with:
//! - Verifiable Credentials (W3C VC) with Ed25519 signatures
//! - Intent Mandates for user authorization
//! - Cart Mandates for explicit purchase authorization
//! - Payment Mandates for payment network signaling
//! - DID (Decentralized Identifiers) integration
//! - Multi-agent consensus verification

pub mod credentials;
pub mod did;
pub mod mandates;
pub mod verification;

pub use credentials::{
    CredentialSubject, Proof, ProofPurpose, VerifiableCredential, VerificationMethod,
};
pub use did::{DidDocument, DidManager, DidResolver, ServiceEndpoint};
pub use mandates::{
    CartItem, CartMandate, IntentMandate, Mandate, MandateStatus, MandateType, PaymentMandate,
    PaymentMethod, Permission,
};
pub use verification::{
    ConsensusVerification, VerificationResult, VerificationWorkflow, VerifierNode,
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// AP2 Protocol Version
pub const AP2_VERSION: &str = "1.0.0";

/// AP2 Error Types
#[derive(Debug, Error)]
pub enum Ap2Error {
    #[error("Invalid credential: {0}")]
    InvalidCredential(String),

    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),

    #[error("DID resolution failed: {0}")]
    DidResolutionFailed(String),

    #[error("Mandate validation failed: {0}")]
    MandateValidationFailed(String),

    #[error("Consensus verification failed: {0}")]
    ConsensusVerificationFailed(String),

    #[error("Expired credential or mandate")]
    Expired,

    #[error("Insufficient authorization: {0}")]
    InsufficientAuthorization(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Cryptographic error: {0}")]
    CryptographicError(String),
}

pub type Result<T> = std::result::Result<T, Ap2Error>;

/// AP2 Context - Standard W3C Verifiable Credentials context
pub const VC_CONTEXT: &str = "https://www.w3.org/2018/credentials/v1";
pub const AP2_CONTEXT: &str = "https://ap2.protocol/v1";

/// Agent Identity representation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentIdentity {
    pub did: String,
    pub public_key: Vec<u8>,
    pub metadata: HashMap<String, String>,
}

impl AgentIdentity {
    pub fn new(did: String, public_key: Vec<u8>) -> Self {
        Self {
            did,
            public_key,
            metadata: HashMap::new(),
        }
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Payment authorization with credential chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentAuthorization {
    pub intent_mandate: VerifiableCredential,
    pub cart_mandate: VerifiableCredential,
    pub payment_mandate: VerifiableCredential,
    pub authorization_chain: Vec<VerifiableCredential>,
    pub timestamp: DateTime<Utc>,
}

impl PaymentAuthorization {
    pub fn new(
        intent_mandate: VerifiableCredential,
        cart_mandate: VerifiableCredential,
        payment_mandate: VerifiableCredential,
    ) -> Self {
        Self {
            intent_mandate: intent_mandate.clone(),
            cart_mandate: cart_mandate.clone(),
            payment_mandate: payment_mandate.clone(),
            authorization_chain: vec![intent_mandate, cart_mandate, payment_mandate],
            timestamp: Utc::now(),
        }
    }

    /// Verify the complete authorization chain
    pub fn verify_chain(&self, did_resolver: &DidResolver) -> Result<bool> {
        for credential in &self.authorization_chain {
            if !credential.verify(did_resolver)? {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Check if authorization is still valid (not expired)
    pub fn is_valid(&self) -> bool {
        let now = Utc::now();
        self.authorization_chain
            .iter()
            .all(|vc| vc.expiration_date.map_or(true, |exp| exp > now))
    }
}

/// AP2 Protocol Handler
#[derive(Debug)]
pub struct Ap2Protocol {
    did_manager: DidManager,
    did_resolver: DidResolver,
    verification_workflow: VerificationWorkflow,
}

impl Ap2Protocol {
    pub fn new() -> Self {
        Self {
            did_manager: DidManager::new(),
            did_resolver: DidResolver::new(),
            verification_workflow: VerificationWorkflow::new(),
        }
    }

    /// Register a new agent identity
    pub fn register_agent(&mut self, agent_id: &str, public_key: Vec<u8>) -> Result<AgentIdentity> {
        let did = self.did_manager.create_did(agent_id, public_key.clone())?;
        Ok(AgentIdentity::new(did, public_key))
    }

    /// Create an intent mandate (user authorizes agent action)
    pub fn create_intent_mandate(
        &self,
        issuer: &AgentIdentity,
        subject_agent: &str,
        intent_description: &str,
        private_key: &[u8],
    ) -> Result<VerifiableCredential> {
        let mandate = IntentMandate::new(
            issuer.did.clone(),
            subject_agent.to_string(),
            intent_description.to_string(),
        );

        let subject = CredentialSubject {
            id: subject_agent.to_string(),
            claims: serde_json::to_value(mandate)
                .map_err(|e| Ap2Error::SerializationError(e.to_string()))?,
        };

        VerifiableCredential::new(issuer.did.clone(), subject, private_key)
    }

    /// Create a cart mandate (explicit purchase authorization)
    pub fn create_cart_mandate(
        &self,
        issuer: &AgentIdentity,
        items: Vec<CartItem>,
        total_amount: u64,
        currency: &str,
        private_key: &[u8],
    ) -> Result<VerifiableCredential> {
        let mandate = CartMandate::new(issuer.did.clone(), items, total_amount, currency.to_string());

        let subject = CredentialSubject {
            id: issuer.did.clone(),
            claims: serde_json::to_value(mandate)
                .map_err(|e| Ap2Error::SerializationError(e.to_string()))?,
        };

        VerifiableCredential::new(issuer.did.clone(), subject, private_key)
    }

    /// Create a payment mandate (payment network signal)
    pub fn create_payment_mandate(
        &self,
        issuer: &AgentIdentity,
        recipient: &str,
        amount: u64,
        currency: &str,
        payment_method: &str,
        private_key: &[u8],
    ) -> Result<VerifiableCredential> {
        let mandate = PaymentMandate::new(
            issuer.did.clone(),
            recipient.to_string(),
            amount,
            currency.to_string(),
            payment_method.to_string(),
        );

        let subject = CredentialSubject {
            id: recipient.to_string(),
            claims: serde_json::to_value(mandate)
                .map_err(|e| Ap2Error::SerializationError(e.to_string()))?,
        };

        VerifiableCredential::new(issuer.did.clone(), subject, private_key)
    }

    /// Verify a complete payment authorization with multi-agent consensus
    pub async fn verify_payment_authorization(
        &self,
        authorization: &PaymentAuthorization,
        verifier_nodes: Vec<VerifierNode>,
    ) -> Result<VerificationResult> {
        // First verify the credential chain
        if !authorization.verify_chain(&self.did_resolver)? {
            return Err(Ap2Error::ConsensusVerificationFailed(
                "Credential chain verification failed".to_string(),
            ));
        }

        // Then perform multi-agent consensus verification
        self.verification_workflow
            .verify_with_consensus(
                &authorization.payment_mandate,
                verifier_nodes,
                &self.did_resolver,
            )
            .await
    }

    /// Resolve a DID to its document
    pub fn resolve_did(&self, did: &str) -> Result<DidDocument> {
        self.did_resolver.resolve(did)
    }

    /// Get DID resolver reference
    pub fn did_resolver(&self) -> &DidResolver {
        &self.did_resolver
    }

    /// Get DID manager reference
    pub fn did_manager(&self) -> &DidManager {
        &self.did_manager
    }
}

impl Default for Ap2Protocol {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_identity_creation() {
        let public_key = vec![1, 2, 3, 4];
        let identity = AgentIdentity::new("did:example:123".to_string(), public_key.clone());

        assert_eq!(identity.did, "did:example:123");
        assert_eq!(identity.public_key, public_key);
    }

    #[test]
    fn test_ap2_protocol_initialization() {
        let protocol = Ap2Protocol::new();
        assert!(protocol.did_resolver.resolve("test").is_err());
    }

    #[test]
    fn test_payment_authorization_validity() {
        // This is a placeholder test - actual implementation would need valid credentials
        let protocol = Ap2Protocol::new();

        // Test would create proper credentials and verify the authorization chain
        assert!(protocol.did_resolver.resolve("did:example:test").is_err());
    }
}