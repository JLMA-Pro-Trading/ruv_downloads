//! Agent identity and DID (Decentralized Identifier) support

use crate::crypto::{generate_keypair, sign_message, verify_signature, Signature};
use crate::error::{CryptoError, Error, Result};
use ed25519_dalek::{SigningKey, VerifyingKey, PUBLIC_KEY_LENGTH, SECRET_KEY_LENGTH};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

/// Agent identity with Ed25519 keypair and DID support
#[derive(Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    /// Unique agent identifier
    id: Uuid,
    /// Ed25519 signing key (zeroized on drop)
    #[serde(serialize_with = "serialize_signing_key", deserialize_with = "deserialize_signing_key")]
    signing_key: SigningKey,
    /// Ed25519 verifying (public) key
    #[serde(serialize_with = "serialize_verifying_key", deserialize_with = "deserialize_verifying_key")]
    verifying_key: VerifyingKey,
    /// DID (Decentralized Identifier)
    did: String,
}

// Custom serialization for SigningKey
fn serialize_signing_key<S>(key: &SigningKey, serializer: S) -> std::result::Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let bytes = key.to_bytes();
    serializer.serialize_bytes(&bytes)
}

fn deserialize_signing_key<'de, D>(deserializer: D) -> std::result::Result<SigningKey, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let bytes: Vec<u8> = serde::Deserialize::deserialize(deserializer)?;
    let key_bytes: [u8; 32] = bytes.as_slice().try_into()
        .map_err(|_| serde::de::Error::custom("Invalid signing key length"))?;
    Ok(SigningKey::from_bytes(&key_bytes))
}

// Custom serialization for VerifyingKey
fn serialize_verifying_key<S>(key: &VerifyingKey, serializer: S) -> std::result::Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let bytes = key.to_bytes();
    serializer.serialize_bytes(&bytes)
}

fn deserialize_verifying_key<'de, D>(deserializer: D) -> std::result::Result<VerifyingKey, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let bytes: Vec<u8> = serde::Deserialize::deserialize(deserializer)?;
    let key_bytes: [u8; 32] = bytes.as_slice().try_into()
        .map_err(|_| serde::de::Error::custom("Invalid verifying key length"))?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|e| serde::de::Error::custom(format!("Invalid verifying key: {}", e)))
}

impl AgentIdentity {
    /// Generate a new agent identity with a fresh keypair
    pub fn generate() -> Result<Self> {
        let id = Uuid::new_v4();
        let (signing_key, verifying_key) = generate_keypair()?;
        let did = Self::compute_did(&verifying_key);

        Ok(Self {
            id,
            signing_key,
            verifying_key,
            did,
        })
    }

    /// Create an agent identity from an existing signing key
    pub fn from_signing_key(signing_key: SigningKey) -> Result<Self> {
        let id = Uuid::new_v4();
        let verifying_key = signing_key.verifying_key();
        let did = Self::compute_did(&verifying_key);

        Ok(Self {
            id,
            signing_key,
            verifying_key,
            did,
        })
    }

    /// Create an agent identity from raw key bytes
    pub fn from_bytes(signing_key_bytes: &[u8]) -> Result<Self> {
        if signing_key_bytes.len() != SECRET_KEY_LENGTH {
            return Err(Error::Crypto(CryptoError::InvalidPrivateKey {
                details: format!("Expected {} bytes, got {}", SECRET_KEY_LENGTH, signing_key_bytes.len()),
            }));
        }

        let signing_key = SigningKey::from_bytes(
            signing_key_bytes.try_into().map_err(|_| {
                Error::Crypto(CryptoError::InvalidPrivateKey {
                    details: "Invalid key length".to_string(),
                })
            })?
        );

        Self::from_signing_key(signing_key)
    }

    /// Get the agent's unique identifier
    pub fn id(&self) -> &Uuid {
        &self.id
    }

    /// Get the DID (Decentralized Identifier)
    pub fn did(&self) -> &str {
        &self.did
    }

    /// Get a reference to the signing key
    pub fn signing_key(&self) -> &SigningKey {
        &self.signing_key
    }

    /// Get a reference to the verifying key
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }

    /// Get the verifying key as bytes
    pub fn verifying_key_bytes(&self) -> [u8; PUBLIC_KEY_LENGTH] {
        self.verifying_key.to_bytes()
    }

    /// Sign a message with this identity
    pub fn sign(&self, message: &[u8]) -> Result<Signature> {
        sign_message(&self.signing_key, message)
    }

    /// Verify a signature against this identity's public key
    pub fn verify(&self, message: &[u8], signature: &Signature) -> Result<bool> {
        verify_signature(&self.verifying_key, message, signature)
    }

    /// Export the signing key as bytes (use with caution!)
    pub fn to_bytes(&self) -> [u8; SECRET_KEY_LENGTH] {
        self.signing_key.to_bytes()
    }

    /// Create a DID document for this identity
    pub fn to_did_document(&self) -> DidDocument {
        DidDocument::new(self.did.clone(), self.verifying_key)
    }

    /// Compute DID from a verifying key
    fn compute_did(verifying_key: &VerifyingKey) -> String {
        let key_bytes = verifying_key.to_bytes();
        let encoded = URL_SAFE_NO_PAD.encode(&key_bytes);
        format!("did:key:z{}", encoded)
    }
}

impl Drop for AgentIdentity {
    fn drop(&mut self) {
        // The SigningKey type already implements Zeroize internally
        // This is an additional safeguard
    }
}

impl std::fmt::Debug for AgentIdentity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AgentIdentity")
            .field("id", &self.id)
            .field("did", &self.did)
            .field("verifying_key", &hex::encode(self.verifying_key.to_bytes()))
            .finish_non_exhaustive()
    }
}

/// DID Document following W3C DID specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidDocument {
    /// The DID identifier
    pub id: String,

    /// Verification methods
    #[serde(rename = "verificationMethod")]
    pub verification_method: Vec<VerificationMethod>,

    /// Authentication methods
    pub authentication: Vec<String>,

    /// Assertion methods (for signing)
    #[serde(rename = "assertionMethod")]
    pub assertion_method: Vec<String>,
}

impl DidDocument {
    /// Create a new DID document from a DID and verifying key
    pub fn new(did: String, verifying_key: VerifyingKey) -> Self {
        let key_id = format!("{}#key-1", did);
        let verification_method = vec![
            VerificationMethod {
                id: key_id.clone(),
                type_: "Ed25519VerificationKey2020".to_string(),
                controller: did.clone(),
                public_key_multibase: format!("z{}",
                    URL_SAFE_NO_PAD.encode(&verifying_key.to_bytes())
                ),
            }
        ];

        Self {
            id: did,
            verification_method,
            authentication: vec![key_id.clone()],
            assertion_method: vec![key_id],
        }
    }

    /// Validate the DID document structure
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty() {
            return Err(Error::Did("DID cannot be empty".to_string()));
        }

        if !self.id.starts_with("did:") {
            return Err(Error::Did("DID must start with 'did:'".to_string()));
        }

        if self.verification_method.is_empty() {
            return Err(Error::Did("DID document must have at least one verification method".to_string()));
        }

        Ok(())
    }
}

/// Verification method in a DID document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationMethod {
    /// Method identifier
    pub id: String,

    /// Key type
    #[serde(rename = "type")]
    pub type_: String,

    /// Controller DID
    pub controller: String,

    /// Public key in multibase format
    #[serde(rename = "publicKeyMultibase")]
    pub public_key_multibase: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_identity() {
        let identity = AgentIdentity::generate().unwrap();
        assert!(identity.did().starts_with("did:key:z"));
        assert!(!identity.id().is_nil());
    }

    #[test]
    fn test_sign_and_verify() {
        let identity = AgentIdentity::generate().unwrap();
        let message = b"test message";

        let signature = identity.sign(message).unwrap();
        let is_valid = identity.verify(message, &signature).unwrap();

        assert!(is_valid);
    }

    #[test]
    fn test_verify_wrong_message() {
        let identity = AgentIdentity::generate().unwrap();
        let message = b"test message";
        let wrong_message = b"wrong message";

        let signature = identity.sign(message).unwrap();
        let is_valid = identity.verify(wrong_message, &signature).unwrap();

        assert!(!is_valid);
    }

    #[test]
    fn test_identity_from_bytes() {
        let identity1 = AgentIdentity::generate().unwrap();
        let key_bytes = identity1.to_bytes();

        let identity2 = AgentIdentity::from_bytes(&key_bytes).unwrap();

        assert_eq!(
            identity1.verifying_key_bytes(),
            identity2.verifying_key_bytes()
        );
    }

    #[test]
    fn test_invalid_key_bytes() {
        let invalid_bytes = vec![0u8; 16];
        let result = AgentIdentity::from_bytes(&invalid_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn test_did_document() {
        let identity = AgentIdentity::generate().unwrap();
        let doc = identity.to_did_document();

        assert_eq!(doc.id, identity.did());
        assert!(!doc.verification_method.is_empty());
        assert!(!doc.authentication.is_empty());
        assert!(!doc.assertion_method.is_empty());

        doc.validate().unwrap();
    }

    #[test]
    fn test_did_document_validation() {
        let identity = AgentIdentity::generate().unwrap();
        let mut doc = identity.to_did_document();

        // Valid document
        assert!(doc.validate().is_ok());

        // Invalid: empty ID
        doc.id = String::new();
        assert!(doc.validate().is_err());

        // Invalid: wrong DID format
        doc.id = "not-a-did".to_string();
        assert!(doc.validate().is_err());
    }

    #[test]
    fn test_multiple_identities() {
        let identity1 = AgentIdentity::generate().unwrap();
        let identity2 = AgentIdentity::generate().unwrap();

        assert_ne!(identity1.id(), identity2.id());
        assert_ne!(identity1.did(), identity2.did());
        assert_ne!(
            identity1.verifying_key_bytes(),
            identity2.verifying_key_bytes()
        );
    }

    #[test]
    fn test_cross_identity_verification() {
        let identity1 = AgentIdentity::generate().unwrap();
        let identity2 = AgentIdentity::generate().unwrap();

        let message = b"test message";
        let signature = identity1.sign(message).unwrap();

        // Should fail to verify with different identity
        let is_valid = identity2.verify(message, &signature).unwrap();
        assert!(!is_valid);
    }
}