//! W3C Verifiable Credentials Implementation with Ed25519 Signatures

use super::{Ap2Error, Result, AP2_CONTEXT, VC_CONTEXT};
use crate::ap2::did::DidResolver;
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

/// W3C Verifiable Credential
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiableCredential {
    #[serde(rename = "@context")]
    pub context: Vec<String>,
    pub id: String,
    #[serde(rename = "type")]
    pub types: Vec<String>,
    pub issuer: String,
    pub issuance_date: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration_date: Option<DateTime<Utc>>,
    pub credential_subject: CredentialSubject,
    pub proof: Proof,
}

/// Credential Subject
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialSubject {
    pub id: String,
    #[serde(flatten)]
    pub claims: Value,
}

/// Cryptographic Proof
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Proof {
    #[serde(rename = "type")]
    pub proof_type: String,
    pub created: DateTime<Utc>,
    pub proof_purpose: ProofPurpose,
    pub verification_method: String,
    pub jws: String, // JSON Web Signature
}

/// Proof Purpose
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProofPurpose {
    AssertionMethod,
    Authentication,
    KeyAgreement,
    CapabilityInvocation,
    CapabilityDelegation,
}

/// Verification Method
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationMethod {
    pub id: String,
    #[serde(rename = "type")]
    pub method_type: String,
    pub controller: String,
    pub public_key_multibase: String,
}

impl VerifiableCredential {
    /// Create a new verifiable credential with Ed25519 signature
    pub fn new(issuer: String, subject: CredentialSubject, private_key: &[u8]) -> Result<Self> {
        let now = Utc::now();
        let id = format!("urn:uuid:{}", uuid::Uuid::new_v4());

        let mut credential = Self {
            context: vec![VC_CONTEXT.to_string(), AP2_CONTEXT.to_string()],
            id,
            types: vec!["VerifiableCredential".to_string()],
            issuer: issuer.clone(),
            issuance_date: now,
            expiration_date: Some(now + chrono::Duration::days(365)),
            credential_subject: subject,
            proof: Proof {
                proof_type: "Ed25519Signature2020".to_string(),
                created: now,
                proof_purpose: ProofPurpose::AssertionMethod,
                verification_method: format!("{}#key-1", issuer),
                jws: String::new(), // Will be set after signing
            },
        };

        // Sign the credential
        credential.sign(private_key)?;

        Ok(credential)
    }

    /// Sign the credential using Ed25519
    fn sign(&mut self, private_key: &[u8]) -> Result<()> {
        // Create signing key from bytes
        let key_bytes: [u8; 32] = private_key
            .try_into()
            .map_err(|_| Ap2Error::CryptographicError("Invalid private key length".to_string()))?;
        let signing_key = SigningKey::from_bytes(&key_bytes);

        // Create canonical representation for signing (without proof)
        let mut signing_input = self.clone();
        signing_input.proof.jws = String::new();

        let canonical = serde_json::to_string(&signing_input)
            .map_err(|e| Ap2Error::SerializationError(e.to_string()))?;

        // Hash the canonical representation
        let mut hasher = Sha256::new();
        hasher.update(canonical.as_bytes());
        let hash = hasher.finalize();

        // Sign the hash
        let signature = signing_key.sign(&hash);

        // Encode signature as base64url
        self.proof.jws = base64_url::encode(&signature.to_bytes());

        Ok(())
    }

    /// Verify the credential signature
    pub fn verify(&self, did_resolver: &DidResolver) -> Result<bool> {
        // Check expiration
        if let Some(exp) = self.expiration_date {
            if Utc::now() > exp {
                return Err(Ap2Error::Expired);
            }
        }

        // Resolve issuer DID to get public key
        let did_doc = did_resolver.resolve(&self.issuer)?;
        let public_key = did_doc
            .verification_method
            .first()
            .ok_or_else(|| {
                Ap2Error::DidResolutionFailed("No verification method found".to_string())
            })?
            .public_key_multibase
            .clone();

        // Decode public key from multibase
        let public_key_bytes = base64_url::decode(&public_key)
            .map_err(|e| Ap2Error::CryptographicError(format!("Invalid public key: {}", e)))?;

        let verifying_key_bytes: [u8; 32] = public_key_bytes
            .try_into()
            .map_err(|_| Ap2Error::CryptographicError("Invalid public key length".to_string()))?;
        let verifying_key = VerifyingKey::from_bytes(&verifying_key_bytes)
            .map_err(|e| Ap2Error::CryptographicError(e.to_string()))?;

        // Reconstruct canonical form for verification
        let mut verification_input = self.clone();
        verification_input.proof.jws = String::new();

        let canonical = serde_json::to_string(&verification_input)
            .map_err(|e| Ap2Error::SerializationError(e.to_string()))?;

        // Hash the canonical representation
        let mut hasher = Sha256::new();
        hasher.update(canonical.as_bytes());
        let hash = hasher.finalize();

        // Decode signature
        let signature_bytes = base64_url::decode(&self.proof.jws)
            .map_err(|e| Ap2Error::CryptographicError(format!("Invalid signature: {}", e)))?;

        let signature = Signature::from_bytes(
            signature_bytes
                .as_slice()
                .try_into()
                .map_err(|_| Ap2Error::CryptographicError("Invalid signature length".to_string()))?,
        );

        // Verify signature
        verifying_key
            .verify(&hash, &signature)
            .map_err(|e| Ap2Error::SignatureVerificationFailed(e.to_string()))?;

        Ok(true)
    }

    /// Add credential type
    pub fn add_type(&mut self, credential_type: String) {
        if !self.types.contains(&credential_type) {
            self.types.push(credential_type);
        }
    }

    /// Set expiration date
    pub fn with_expiration(mut self, expiration: DateTime<Utc>) -> Self {
        self.expiration_date = Some(expiration);
        self
    }

    /// Check if credential is expired
    pub fn is_expired(&self) -> bool {
        self.expiration_date
            .map_or(false, |exp| Utc::now() > exp)
    }

    /// Get credential claims
    pub fn get_claim(&self, key: &str) -> Option<&Value> {
        self.credential_subject.claims.get(key)
    }
}

/// Credential Builder for easier construction
pub struct CredentialBuilder {
    issuer: String,
    subject_id: String,
    claims: serde_json::Map<String, Value>,
    types: Vec<String>,
    expiration: Option<DateTime<Utc>>,
}

impl CredentialBuilder {
    pub fn new(issuer: String, subject_id: String) -> Self {
        Self {
            issuer,
            subject_id,
            claims: serde_json::Map::new(),
            types: vec!["VerifiableCredential".to_string()],
            expiration: None,
        }
    }

    pub fn add_claim(mut self, key: String, value: Value) -> Self {
        self.claims.insert(key, value);
        self
    }

    pub fn add_type(mut self, credential_type: String) -> Self {
        if !self.types.contains(&credential_type) {
            self.types.push(credential_type);
        }
        self
    }

    pub fn with_expiration(mut self, expiration: DateTime<Utc>) -> Self {
        self.expiration = Some(expiration);
        self
    }

    pub fn build(self, private_key: &[u8]) -> Result<VerifiableCredential> {
        let subject = CredentialSubject {
            id: self.subject_id,
            claims: Value::Object(self.claims),
        };

        let mut credential = VerifiableCredential::new(self.issuer, subject, private_key)?;
        credential.types = self.types;
        if let Some(exp) = self.expiration {
            credential.expiration_date = Some(exp);
        }

        // Re-sign after modifications
        credential.sign(private_key)?;

        Ok(credential)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generate_keypair() -> (SigningKey, VerifyingKey) {
        let signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifying_key = signing_key.verifying_key();
        (signing_key, verifying_key)
    }

    #[test]
    fn test_credential_creation() {
        let (signing_key, _) = generate_keypair();
        let issuer = "did:example:issuer".to_string();
        let subject = CredentialSubject {
            id: "did:example:subject".to_string(),
            claims: serde_json::json!({"name": "Test Agent"}),
        };

        let credential = VerifiableCredential::new(issuer, subject, signing_key.as_bytes());
        assert!(credential.is_ok());

        let vc = credential.unwrap();
        assert_eq!(vc.types, vec!["VerifiableCredential"]);
        assert!(!vc.proof.jws.is_empty());
    }

    #[test]
    fn test_credential_builder() {
        let (signing_key, _) = generate_keypair();

        let credential = CredentialBuilder::new(
            "did:example:issuer".to_string(),
            "did:example:subject".to_string(),
        )
        .add_claim("role".to_string(), serde_json::json!("agent"))
        .add_type("AgentCredential".to_string())
        .build(signing_key.as_bytes());

        assert!(credential.is_ok());
        let vc = credential.unwrap();
        assert!(vc.types.contains(&"AgentCredential".to_string()));
    }

    #[test]
    fn test_credential_expiration() {
        let (signing_key, _) = generate_keypair();
        let past = Utc::now() - chrono::Duration::days(1);

        let subject = CredentialSubject {
            id: "did:example:subject".to_string(),
            claims: serde_json::json!({}),
        };

        let mut credential =
            VerifiableCredential::new("did:example:issuer".to_string(), subject, signing_key.as_bytes())
                .unwrap();
        credential.expiration_date = Some(past);

        assert!(credential.is_expired());
    }
}