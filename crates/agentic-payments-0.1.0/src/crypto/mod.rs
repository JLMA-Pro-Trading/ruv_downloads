//! Cryptographic operations for agentic-payments
//!
//! This module provides Ed25519 signature operations, key management,
//! DID support, and batch verification capabilities.

pub mod identity;
pub mod signature;
pub mod keys;
pub mod batch;

pub use identity::{AgentIdentity, DidDocument};
pub use signature::{SignatureManager, SignatureResult};
pub use keys::{KeyPair, KeyManager, StoredKey};
pub use batch::{BatchVerifier, BatchResult, VerificationItem};

use crate::error::{CryptoError, Error, Result};
use ed25519_dalek::{
    Signature as Ed25519Signature,
    Signer,
    Verifier,
    VerifyingKey,
    SigningKey,
};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

/// Ed25519 signature wrapper with serialization support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    #[serde(with = "signature_serde")]
    inner: Ed25519Signature,
}

impl Signature {
    /// Create a new signature from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        let inner = Ed25519Signature::from_slice(bytes)
            .map_err(|e| Error::Crypto(CryptoError::InvalidSignature {
                details: format!("Invalid signature bytes: {}", e),
            }))?;
        Ok(Self { inner })
    }

    /// Get the signature as bytes
    pub fn to_bytes(&self) -> [u8; 64] {
        self.inner.to_bytes()
    }

    /// Get a reference to the inner Ed25519 signature
    pub fn as_inner(&self) -> &Ed25519Signature {
        &self.inner
    }

    /// Convert to inner Ed25519 signature
    pub fn into_inner(self) -> Ed25519Signature {
        self.inner
    }
}

impl From<Ed25519Signature> for Signature {
    fn from(inner: Ed25519Signature) -> Self {
        Self { inner }
    }
}

// Note: AsRef<[u8]> removed because Ed25519Signature::to_bytes() returns by value
// Use Signature::to_bytes() instead

/// Serialization module for Ed25519 signatures
mod signature_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(sig: &Ed25519Signature, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let bytes = sig.to_bytes();
        serializer.serialize_bytes(&bytes)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> std::result::Result<Ed25519Signature, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = serde::Deserialize::deserialize(deserializer)?;
        Ed25519Signature::from_slice(&bytes)
            .map_err(|e| serde::de::Error::custom(format!("Invalid signature: {}", e)))
    }
}

/// Verify a single Ed25519 signature
pub fn verify_signature(
    public_key: &VerifyingKey,
    message: &[u8],
    signature: &Signature,
) -> Result<bool> {
    match public_key.verify(message, signature.as_inner()) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Sign a message with Ed25519
pub fn sign_message(
    signing_key: &SigningKey,
    message: &[u8],
) -> Result<Signature> {
    let signature = signing_key.sign(message);
    Ok(Signature::from(signature))
}

/// Generate a new Ed25519 keypair
pub fn generate_keypair() -> Result<(SigningKey, VerifyingKey)> {
    let mut rng = rand::rngs::OsRng;
    let signing_key = SigningKey::generate(&mut rng);
    let verifying_key = signing_key.verifying_key();
    Ok((signing_key, verifying_key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_roundtrip() {
        let (signing_key, verifying_key) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();
        let is_valid = verify_signature(&verifying_key, message, &signature).unwrap();

        assert!(is_valid);
    }

    #[test]
    fn test_signature_bytes() {
        let (signing_key, _) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();
        let bytes = signature.to_bytes();
        let restored = Signature::from_bytes(&bytes).unwrap();

        assert_eq!(signature.to_bytes(), restored.to_bytes());
    }

    #[test]
    fn test_invalid_signature() {
        let (_, verifying_key) = generate_keypair().unwrap();
        let (other_signing_key, _) = generate_keypair().unwrap();

        let message = b"test message";
        let signature = sign_message(&other_signing_key, message).unwrap();

        let is_valid = verify_signature(&verifying_key, message, &signature).unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_signature_serialization() {
        let (signing_key, _) = generate_keypair().unwrap();
        let message = b"test message";

        let signature = sign_message(&signing_key, message).unwrap();
        let json = serde_json::to_string(&signature).unwrap();
        let restored: Signature = serde_json::from_str(&json).unwrap();

        assert_eq!(signature.to_bytes(), restored.to_bytes());
    }
}