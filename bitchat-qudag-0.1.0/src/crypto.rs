//! Quantum-resistant cryptography implementation for BitChat-QuDAG integration

use aes_gcm::{Aes256Gcm, Key as AesKey, Nonce as AesNonce};
use argon2::{
    password_hash::{PasswordHash, SaltString},
    Argon2, PasswordHasher, PasswordVerifier,
};
use base64::{engine::general_purpose, Engine as _};
use blake3::Hasher;
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use x25519_dalek::{EphemeralSecret, PublicKey, SharedSecret};
use zeroize::{Zeroize, ZeroizeOnDrop};

// Quantum-resistant imports
use oqs::{
    kem::{
        Algorithm as KemAlgorithm, Ciphertext, Kem, PublicKey as KemPublicKey,
        SecretKey as KemSecretKey, SharedSecret as OqsSharedSecret,
    },
    sig::{
        Algorithm as SigAlgorithm, PublicKey as SigPublicKey, SecretKey as SigSecretKey, Sig,
        Signature as OqsSignature,
    },
};

use crate::error::{BitChatError, Result};

pub mod noise;

/// Cryptographic modes supported by the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CryptoMode {
    /// Use only quantum-resistant algorithms (ML-KEM/ML-DSA)
    QuantumResistant,
    /// Use only traditional algorithms (BitChat style)
    Traditional,
    /// Use both for maximum security
    Hybrid,
}

impl Default for CryptoMode {
    fn default() -> Self {
        Self::Hybrid
    }
}

/// Quantum-resistant key encapsulation algorithms
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum KemAlgorithmType {
    /// ML-KEM-768 (Kyber)
    MlKem768,
    /// Classic McEliece (alternative)
    ClassicMcEliece,
}

/// Quantum-resistant signature algorithms
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SigAlgorithmType {
    /// ML-DSA-65 (Dilithium)
    MlDsa65,
    /// Falcon-512
    Falcon512,
}

/// Quantum-resistant key pair
pub struct QuantumKeyPair {
    /// KEM secret key
    kem_secret: KemSecretKey,
    /// KEM public key
    kem_public: KemPublicKey,
    /// Signature secret key
    sig_secret: SigSecretKey,
    /// Signature public key
    sig_public: SigPublicKey,
    /// KEM algorithm used
    kem_algorithm: KemAlgorithmType,
    /// Signature algorithm used
    sig_algorithm: SigAlgorithmType,
}

impl QuantumKeyPair {
    /// Generate new quantum-resistant key pair
    pub fn generate(kem_algo: KemAlgorithmType, sig_algo: SigAlgorithmType) -> Result<Self> {
        // Initialize KEM
        let kem_alg = match kem_algo {
            KemAlgorithmType::MlKem768 => KemAlgorithm::Kyber512,
            KemAlgorithmType::ClassicMcEliece => KemAlgorithm::ClassicMcEliece348864,
        };

        let kem = Kem::new(kem_alg)
            .map_err(|e| BitChatError::Crypto(format!("Failed to initialize KEM: {:?}", e)))?;

        let (kem_public, kem_secret) = kem.keypair().map_err(|e| {
            BitChatError::Crypto(format!("Failed to generate KEM keypair: {:?}", e))
        })?;

        // Initialize signature
        let sig_alg = match sig_algo {
            SigAlgorithmType::MlDsa65 => SigAlgorithm::Dilithium2,
            SigAlgorithmType::Falcon512 => SigAlgorithm::Falcon512,
        };

        let sig = Sig::new(sig_alg).map_err(|e| {
            BitChatError::Crypto(format!("Failed to initialize signature: {:?}", e))
        })?;

        let (sig_public, sig_secret) = sig.keypair().map_err(|e| {
            BitChatError::Crypto(format!("Failed to generate signature keypair: {:?}", e))
        })?;

        Ok(Self {
            kem_secret,
            kem_public,
            sig_secret,
            sig_public,
            kem_algorithm: kem_algo,
            sig_algorithm: sig_algo,
        })
    }

    /// Encapsulate to generate shared secret
    pub fn encapsulate(&self, peer_public: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let kem_alg = match self.kem_algorithm {
            KemAlgorithmType::MlKem768 => KemAlgorithm::Kyber512,
            KemAlgorithmType::ClassicMcEliece => KemAlgorithm::ClassicMcEliece348864,
        };

        let kem = Kem::new(kem_alg)
            .map_err(|e| BitChatError::Crypto(format!("Failed to initialize KEM: {:?}", e)))?;

        let peer_key = kem
            .public_key_from_bytes(peer_public)
            .ok_or_else(|| BitChatError::Crypto("Invalid peer public key".to_string()))?;

        let (ciphertext, shared_secret) = kem
            .encapsulate(&peer_key)
            .map_err(|e| BitChatError::Crypto(format!("Encapsulation failed: {:?}", e)))?;

        Ok((
            ciphertext.as_ref().to_vec(),
            shared_secret.as_ref().to_vec(),
        ))
    }

    /// Decapsulate to recover shared secret
    pub fn decapsulate(&self, ciphertext: &[u8]) -> Result<Vec<u8>> {
        let kem_alg = match self.kem_algorithm {
            KemAlgorithmType::MlKem768 => KemAlgorithm::Kyber512,
            KemAlgorithmType::ClassicMcEliece => KemAlgorithm::ClassicMcEliece348864,
        };

        let kem = Kem::new(kem_alg)
            .map_err(|e| BitChatError::Crypto(format!("Failed to initialize KEM: {:?}", e)))?;

        let ct = kem
            .ciphertext_from_bytes(ciphertext)
            .ok_or_else(|| BitChatError::Crypto("Invalid ciphertext".to_string()))?;

        let shared_secret = kem
            .decapsulate(&self.kem_secret, &ct)
            .map_err(|e| BitChatError::Crypto(format!("Decapsulation failed: {:?}", e)))?;

        Ok(shared_secret.as_ref().to_vec())
    }

    /// Sign data
    pub fn sign(&self, data: &[u8]) -> Result<Vec<u8>> {
        let sig_alg = match self.sig_algorithm {
            SigAlgorithmType::MlDsa65 => SigAlgorithm::Dilithium2,
            SigAlgorithmType::Falcon512 => SigAlgorithm::Falcon512,
        };

        let sig = Sig::new(sig_alg).map_err(|e| {
            BitChatError::Crypto(format!("Failed to initialize signature: {:?}", e))
        })?;

        let signature = sig
            .sign(data, &self.sig_secret)
            .map_err(|e| BitChatError::Crypto(format!("Signing failed: {:?}", e)))?;

        Ok(signature.as_ref().to_vec())
    }

    /// Verify signature
    pub fn verify(&self, data: &[u8], signature: &[u8], public_key: &[u8]) -> Result<bool> {
        let sig_alg = match self.sig_algorithm {
            SigAlgorithmType::MlDsa65 => SigAlgorithm::Dilithium2,
            SigAlgorithmType::Falcon512 => SigAlgorithm::Falcon512,
        };

        let sig = Sig::new(sig_alg).map_err(|e| {
            BitChatError::Crypto(format!("Failed to initialize signature: {:?}", e))
        })?;

        let pubkey = sig
            .public_key_from_bytes(public_key)
            .ok_or_else(|| BitChatError::Crypto("Invalid public key".to_string()))?;

        let sig_obj = sig
            .signature_from_bytes(signature)
            .ok_or_else(|| BitChatError::Crypto("Invalid signature".to_string()))?;

        Ok(sig.verify(data, &sig_obj, &pubkey).is_ok())
    }

    /// Get KEM public key bytes
    pub fn kem_public_bytes(&self) -> Vec<u8> {
        self.kem_public.as_ref().to_vec()
    }

    /// Get signature public key bytes
    pub fn sig_public_bytes(&self) -> Vec<u8> {
        self.sig_public.as_ref().to_vec()
    }
}

/// Traditional cryptographic key pair
pub struct TraditionalKeyPair {
    /// Private key for signing
    signing_key: SigningKey,
    /// Public key for verification
    verifying_key: VerifyingKey,
    /// Key exchange secret
    exchange_secret: Option<EphemeralSecret>,
    /// Public key for key exchange
    exchange_public: PublicKey,
}

impl TraditionalKeyPair {
    /// Generate a new key pair
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let exchange_secret = EphemeralSecret::random_from_rng(OsRng);
        let exchange_public = PublicKey::from(&exchange_secret);

        Self {
            signing_key,
            verifying_key,
            exchange_secret: Some(exchange_secret),
            exchange_public,
        }
    }

    /// Get public key bytes for exchange
    pub fn exchange_public_bytes(&self) -> [u8; 32] {
        self.exchange_public.to_bytes()
    }

    /// Get verifying key bytes
    pub fn verifying_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }
}

/// Session key for encrypted communication with key rotation
#[derive(Debug, Clone, ZeroizeOnDrop)]
pub struct SessionKey {
    /// Current symmetric key for encryption
    key: [u8; 32],
    /// Previous key for decryption during rotation
    previous_key: Option<[u8; 32]>,
    /// Key derivation timestamp
    timestamp: u64,
    /// Key usage counter
    usage_count: u64,
    /// Maximum usage count before rekeying
    max_usage: u64,
    /// Key generation number
    generation: u32,
    /// Rekeying in progress
    rekeying: bool,
}

impl SessionKey {
    /// Create a new session key
    pub fn new(shared_secret: &[u8]) -> Result<Self> {
        let hkdf = Hkdf::<Sha256>::new(Some(b"bitchat-qudag-v1"), shared_secret);
        let mut key = [0u8; 32];

        hkdf.expand(b"session-key-v1", &mut key)
            .map_err(|_| BitChatError::Crypto("HKDF expansion failed".to_string()))?;

        Ok(Self {
            key,
            previous_key: None,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            usage_count: 0,
            max_usage: 1000,
            generation: 0,
            rekeying: false,
        })
    }

    /// Derive next generation key
    pub fn rotate_key(&mut self) -> Result<()> {
        // Keep the old key for decryption during transition
        self.previous_key = Some(self.key);
        self.rekeying = true;

        // Derive new key from old key
        let hkdf = Hkdf::<Sha256>::new(Some(&self.key), b"key-rotation");
        let mut new_key = [0u8; 32];

        let info = format!("generation-{}", self.generation + 1);
        hkdf.expand(info.as_bytes(), &mut new_key)
            .map_err(|_| BitChatError::Crypto("Key rotation failed".to_string()))?;

        self.key = new_key;
        self.generation += 1;
        self.usage_count = 0;
        self.timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(())
    }

    /// Complete rekeying process
    pub fn complete_rekeying(&mut self) {
        self.previous_key = None;
        self.rekeying = false;
    }

    /// Check if key needs renewal
    pub fn needs_renewal(&self) -> bool {
        self.usage_count >= self.max_usage || self.age() > 86400 // 24 hours
    }

    /// Increment usage counter
    pub fn increment_usage(&mut self) {
        self.usage_count += 1;
    }

    /// Get age in seconds
    pub fn age(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            - self.timestamp
    }
}

/// Hybrid cryptography implementation with quantum resistance
pub struct HybridCrypto {
    /// Cryptographic mode
    mode: CryptoMode,
    /// Traditional key pair
    traditional_keypair: TraditionalKeyPair,
    /// Quantum-resistant key pair
    quantum_keypair: QuantumKeyPair,
    /// Session keys with peers
    session_keys: HashMap<String, SessionKey>,
    /// ChaCha20-Poly1305 cipher for traditional crypto
    chacha_cipher: ChaCha20Poly1305,
    /// AES-GCM cipher for additional encryption
    aes_cipher: Aes256Gcm,
    /// Password hasher
    password_hasher: Argon2<'static>,
}

impl HybridCrypto {
    /// Create a new hybrid crypto instance
    pub fn new(mode: CryptoMode) -> Result<Self> {
        let traditional_keypair = TraditionalKeyPair::generate();
        let quantum_keypair =
            QuantumKeyPair::generate(KemAlgorithmType::MlKem768, SigAlgorithmType::MlDsa65)?;

        // Generate a temporary master key
        let mut master_key = [0u8; 32];
        OsRng.fill_bytes(&mut master_key);

        let chacha_cipher = ChaCha20Poly1305::new(Key::from_slice(&master_key));
        let aes_cipher = Aes256Gcm::new(aes_gcm::Key::<Aes256Gcm>::from_slice(&master_key));

        // Zeroize the master key after use
        master_key.zeroize();

        Ok(Self {
            mode,
            traditional_keypair,
            quantum_keypair,
            session_keys: HashMap::new(),
            chacha_cipher,
            aes_cipher,
            password_hasher: Argon2::default(),
        })
    }

    /// Get local public keys for key exchange
    pub fn local_public_keys(&self) -> PublicKeys {
        PublicKeys {
            traditional_exchange: self.traditional_keypair.exchange_public_bytes(),
            traditional_verify: self.traditional_keypair.verifying_key_bytes(),
            quantum_kem: self.quantum_keypair.kem_public_bytes(),
            quantum_sig: self.quantum_keypair.sig_public_bytes(),
        }
    }

    /// Perform hybrid key exchange with a peer
    pub fn key_exchange(
        &mut self,
        peer_id: &str,
        peer_keys: &PublicKeys,
    ) -> Result<KeyExchangeResult> {
        match self.mode {
            CryptoMode::Traditional => self.traditional_key_exchange(peer_id, peer_keys),
            CryptoMode::QuantumResistant => self.quantum_key_exchange(peer_id, peer_keys),
            CryptoMode::Hybrid => self.hybrid_key_exchange(peer_id, peer_keys),
        }
    }

    /// Traditional key exchange (X25519)
    fn traditional_key_exchange(
        &mut self,
        peer_id: &str,
        peer_keys: &PublicKeys,
    ) -> Result<KeyExchangeResult> {
        let peer_public_key = PublicKey::from(peer_keys.traditional_exchange);

        let exchange_secret = self
            .traditional_keypair
            .exchange_secret
            .take()
            .ok_or_else(|| BitChatError::Crypto("Exchange secret already used".to_string()))?;

        let shared_secret = exchange_secret.diffie_hellman(&peer_public_key);
        let session_key = SessionKey::new(shared_secret.as_bytes())?;

        let shared_secret_bytes = shared_secret.as_bytes().to_vec();
        self.session_keys.insert(peer_id.to_string(), session_key);

        Ok(KeyExchangeResult {
            shared_secret: shared_secret_bytes,
            mode: CryptoMode::Traditional,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        })
    }

    /// Quantum-resistant key exchange (ML-KEM)
    fn quantum_key_exchange(
        &mut self,
        peer_id: &str,
        peer_keys: &PublicKeys,
    ) -> Result<KeyExchangeResult> {
        let (ciphertext, shared_secret) =
            self.quantum_keypair.encapsulate(&peer_keys.quantum_kem)?;
        let session_key = SessionKey::new(&shared_secret)?;

        self.session_keys.insert(peer_id.to_string(), session_key);

        Ok(KeyExchangeResult {
            shared_secret,
            mode: CryptoMode::QuantumResistant,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        })
    }

    /// Hybrid key exchange (both traditional and quantum)
    fn hybrid_key_exchange(
        &mut self,
        peer_id: &str,
        peer_keys: &PublicKeys,
    ) -> Result<KeyExchangeResult> {
        // Perform traditional exchange
        let traditional_result = self.traditional_key_exchange(peer_id, peer_keys)?;

        // Perform quantum exchange
        let (_, quantum_secret) = self.quantum_keypair.encapsulate(&peer_keys.quantum_kem)?;

        // Combine both secrets using HKDF
        let mut combined_secret = Vec::new();
        combined_secret.extend_from_slice(&traditional_result.shared_secret);
        combined_secret.extend_from_slice(&quantum_secret);

        let hkdf = Hkdf::<Sha256>::new(Some(b"hybrid-key-exchange"), &combined_secret);
        let mut final_key = [0u8; 32];

        hkdf.expand(b"hybrid-session-key", &mut final_key)
            .map_err(|_| BitChatError::Crypto("HKDF expansion failed".to_string()))?;

        let session_key = SessionKey::new(&final_key)?;
        self.session_keys.insert(peer_id.to_string(), session_key);

        // Zeroize sensitive data
        combined_secret.zeroize();
        final_key.zeroize();

        Ok(KeyExchangeResult {
            shared_secret: quantum_secret,
            mode: CryptoMode::Hybrid,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        })
    }

    /// Encrypt data using the configured crypto mode
    pub async fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        match self.mode {
            CryptoMode::Traditional => self.encrypt_traditional(data).await,
            CryptoMode::QuantumResistant => self.encrypt_quantum_resistant(data).await,
            CryptoMode::Hybrid => self.encrypt_hybrid(data).await,
        }
    }

    /// Decrypt data using the configured crypto mode
    pub async fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        match self.mode {
            CryptoMode::Traditional => self.decrypt_traditional(data).await,
            CryptoMode::QuantumResistant => self.decrypt_quantum_resistant(data).await,
            CryptoMode::Hybrid => self.decrypt_hybrid(data).await,
        }
    }

    /// Encrypt data for a specific peer with key rotation support
    pub async fn encrypt_for_peer(&mut self, peer_id: &str, data: &[u8]) -> Result<Vec<u8>> {
        // Check if key needs rotation
        let needs_rotation = {
            let session_key = self.session_keys.get(peer_id).ok_or_else(|| {
                BitChatError::Crypto(format!("No session key for peer {}", peer_id))
            })?;
            session_key.needs_renewal()
        };

        if needs_rotation {
            let session_key = self.session_keys.get_mut(peer_id).unwrap();
            session_key.rotate_key()?;
        }

        // Get the key and encrypt
        let session_key = self.session_keys.get_mut(peer_id).unwrap();
        session_key.increment_usage();
        let key = session_key.key;
        let generation = session_key.generation;

        let mut encrypted = self.encrypt_with_key(&key, data).await?;

        // Prepend generation number for key rotation support
        let mut result = Vec::new();
        result.extend_from_slice(&generation.to_be_bytes());
        result.extend_from_slice(&encrypted);

        Ok(result)
    }

    /// Decrypt data from a specific peer with key rotation support
    pub async fn decrypt_from_peer(&mut self, peer_id: &str, data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 4 {
            return Err(BitChatError::Crypto(
                "Data too short for peer decryption".to_string(),
            ));
        }

        let generation = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
        let encrypted_data = &data[4..];

        // Get the key and check rekeying status
        let (key, should_complete_rekeying) = {
            let session_key = self.session_keys.get_mut(peer_id).ok_or_else(|| {
                BitChatError::Crypto(format!("No session key for peer {}", peer_id))
            })?;

            session_key.increment_usage();

            // Check if we need to use the previous key (during rotation)
            let key = if session_key.rekeying && generation == session_key.generation - 1 {
                session_key.previous_key.ok_or_else(|| {
                    BitChatError::Crypto("Previous key not available during rekeying".to_string())
                })?
            } else if generation == session_key.generation {
                session_key.key
            } else {
                return Err(BitChatError::Crypto(format!(
                    "Key generation mismatch: {} vs {}",
                    generation, session_key.generation
                )));
            };

            let should_complete = session_key.rekeying && generation == session_key.generation;
            (key, should_complete)
        };

        let decrypted = self.decrypt_with_key(&key, encrypted_data).await?;

        // Complete rekeying if needed
        if should_complete_rekeying {
            if let Some(session_key) = self.session_keys.get_mut(peer_id) {
                session_key.complete_rekeying();
            }
        }

        Ok(decrypted)
    }

    /// Sign data using configured mode
    pub fn sign(&self, data: &[u8]) -> Result<SignatureResult> {
        match self.mode {
            CryptoMode::Traditional => {
                let signature = self.traditional_keypair.signing_key.sign(data);
                Ok(SignatureResult {
                    signature: signature.to_bytes().to_vec(),
                    algorithm: SignatureAlgorithm::Ed25519,
                })
            }
            CryptoMode::QuantumResistant => {
                let signature = self.quantum_keypair.sign(data)?;
                Ok(SignatureResult {
                    signature,
                    algorithm: SignatureAlgorithm::MlDsa65,
                })
            }
            CryptoMode::Hybrid => {
                // Sign with both algorithms
                let traditional_sig = self.traditional_keypair.signing_key.sign(data);
                let quantum_sig = self.quantum_keypair.sign(data)?;

                let mut combined = Vec::new();
                combined.push(0x01); // Hybrid marker
                combined
                    .extend_from_slice(&(traditional_sig.to_bytes().len() as u32).to_be_bytes());
                combined.extend_from_slice(&traditional_sig.to_bytes());
                combined.extend_from_slice(&quantum_sig);

                Ok(SignatureResult {
                    signature: combined,
                    algorithm: SignatureAlgorithm::Hybrid,
                })
            }
        }
    }

    /// Verify signature using configured mode
    pub fn verify(
        &self,
        data: &[u8],
        signature_result: &SignatureResult,
        public_keys: &PublicKeys,
    ) -> Result<bool> {
        match signature_result.algorithm {
            SignatureAlgorithm::Ed25519 => {
                let signature = Signature::from_bytes(
                    signature_result
                        .signature
                        .as_slice()
                        .try_into()
                        .map_err(|_| {
                            BitChatError::Crypto("Invalid signature length".to_string())
                        })?,
                );

                let verifying_key = VerifyingKey::from_bytes(&public_keys.traditional_verify)
                    .map_err(|e| BitChatError::Crypto(format!("Invalid public key: {}", e)))?;

                Ok(verifying_key.verify(data, &signature).is_ok())
            }
            SignatureAlgorithm::MlDsa65 => self.quantum_keypair.verify(
                data,
                &signature_result.signature,
                &public_keys.quantum_sig,
            ),
            SignatureAlgorithm::Hybrid => {
                if signature_result.signature.is_empty() || signature_result.signature[0] != 0x01 {
                    return Err(BitChatError::Crypto(
                        "Invalid hybrid signature marker".to_string(),
                    ));
                }

                let trad_len = u32::from_be_bytes([
                    signature_result.signature[1],
                    signature_result.signature[2],
                    signature_result.signature[3],
                    signature_result.signature[4],
                ]) as usize;

                if signature_result.signature.len() < 5 + trad_len {
                    return Err(BitChatError::Crypto(
                        "Invalid hybrid signature length".to_string(),
                    ));
                }

                let trad_sig = &signature_result.signature[5..5 + trad_len];
                let quantum_sig = &signature_result.signature[5 + trad_len..];

                // Verify both signatures
                let trad_result = {
                    let signature = Signature::from_bytes(trad_sig.try_into().map_err(|_| {
                        BitChatError::Crypto("Invalid traditional signature".to_string())
                    })?);

                    let verifying_key = VerifyingKey::from_bytes(&public_keys.traditional_verify)
                        .map_err(|e| {
                        BitChatError::Crypto(format!("Invalid public key: {}", e))
                    })?;

                    verifying_key.verify(data, &signature).is_ok()
                };

                let quantum_result =
                    self.quantum_keypair
                        .verify(data, quantum_sig, &public_keys.quantum_sig)?;

                Ok(trad_result && quantum_result)
            }
        }
    }

    /// Traditional encryption (ChaCha20-Poly1305)
    async fn encrypt_traditional(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let nonce = Nonce::from_slice(&nonce);

        let ciphertext = self
            .chacha_cipher
            .encrypt(nonce, data)
            .map_err(|e| BitChatError::Crypto(format!("ChaCha20 encryption failed: {}", e)))?;

        let mut result = vec![0x00]; // Traditional marker
        result.extend_from_slice(nonce.as_ref());
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Traditional decryption (ChaCha20-Poly1305)
    async fn decrypt_traditional(&self, data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 13 || data[0] != 0x00 {
            return Err(BitChatError::Crypto(
                "Invalid traditional encryption format".to_string(),
            ));
        }

        let nonce = Nonce::from_slice(&data[1..13]);
        let ciphertext = &data[13..];

        let plaintext = self
            .chacha_cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| BitChatError::Crypto(format!("ChaCha20 decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    /// Quantum-resistant encryption using AES-256-GCM
    async fn encrypt_quantum_resistant(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let nonce = AesNonce::from_slice(&nonce);

        let ciphertext = self
            .aes_cipher
            .encrypt(nonce, data)
            .map_err(|e| BitChatError::Crypto(format!("AES-GCM encryption failed: {}", e)))?;

        let mut result = vec![0x01]; // Quantum-resistant marker
        result.extend_from_slice(nonce.as_ref());
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Quantum-resistant decryption using AES-256-GCM
    async fn decrypt_quantum_resistant(&self, data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 13 || data[0] != 0x01 {
            return Err(BitChatError::Crypto(
                "Invalid quantum-resistant encryption format".to_string(),
            ));
        }

        let nonce = AesNonce::from_slice(&data[1..13]);
        let ciphertext = &data[13..];

        let plaintext = self
            .aes_cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| BitChatError::Crypto(format!("AES-GCM decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    /// Hybrid encryption (both traditional and quantum-resistant)
    async fn encrypt_hybrid(&self, data: &[u8]) -> Result<Vec<u8>> {
        // First encrypt with traditional crypto
        let traditional_encrypted = self.encrypt_traditional(data).await?;

        // Then encrypt with quantum-resistant crypto
        let quantum_encrypted = self
            .encrypt_quantum_resistant(&traditional_encrypted)
            .await?;

        // Add hybrid marker
        let mut result = vec![0x02]; // Hybrid marker
        result.extend_from_slice(&quantum_encrypted[1..]); // Skip quantum marker

        Ok(result)
    }

    /// Hybrid decryption (both traditional and quantum-resistant)
    async fn decrypt_hybrid(&self, data: &[u8]) -> Result<Vec<u8>> {
        if data.is_empty() || data[0] != 0x02 {
            return Err(BitChatError::Crypto(
                "Invalid hybrid encryption marker".to_string(),
            ));
        }

        // Reconstruct quantum-resistant format
        let mut quantum_data = vec![0x01]; // Add back quantum marker
        quantum_data.extend_from_slice(&data[1..]);

        // First decrypt with quantum-resistant crypto
        let quantum_decrypted = self.decrypt_quantum_resistant(&quantum_data).await?;

        // Then decrypt with traditional crypto
        let traditional_decrypted = self.decrypt_traditional(&quantum_decrypted).await?;

        Ok(traditional_decrypted)
    }

    /// Encrypt with specific key
    async fn encrypt_with_key(&self, key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>> {
        let cipher = ChaCha20Poly1305::new(Key::from_slice(key));

        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let nonce = Nonce::from_slice(&nonce);

        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| BitChatError::Crypto(format!("Key encryption failed: {}", e)))?;

        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Decrypt with specific key
    async fn decrypt_with_key(&self, key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 12 {
            return Err(BitChatError::Crypto(
                "Data too short for key decryption".to_string(),
            ));
        }

        let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| BitChatError::Crypto(format!("Key decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    /// Hash data using BLAKE3
    pub fn hash(&self, data: &[u8]) -> [u8; 32] {
        let mut hasher = Hasher::new();
        hasher.update(data);
        *hasher.finalize().as_bytes()
    }

    /// Generate HMAC
    pub fn hmac(&self, key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
        type HmacSha256 = Hmac<Sha256>;

        use hmac::Mac;
        let mut mac = <HmacSha256 as Mac>::new_from_slice(key)
            .map_err(|e| BitChatError::Crypto(format!("HMAC key error: {}", e)))?;

        mac.update(data);
        Ok(mac.finalize().into_bytes().to_vec())
    }

    /// Derive key from password using Argon2
    pub fn derive_key_from_password(&self, password: &str, salt: &[u8]) -> Result<[u8; 32]> {
        let salt_string = SaltString::from_b64(&general_purpose::STANDARD.encode(salt))
            .map_err(|e| BitChatError::Crypto(format!("Invalid salt: {}", e)))?;

        let password_hash = self
            .password_hasher
            .hash_password(password.as_bytes(), &salt_string)
            .map_err(|e| BitChatError::Crypto(format!("Password hashing failed: {}", e)))?;

        let mut key = [0u8; 32];
        key.copy_from_slice(&password_hash.hash.unwrap().as_bytes()[..32]);
        Ok(key)
    }

    /// Generate random bytes
    pub fn random_bytes(&self, len: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; len];
        OsRng.fill_bytes(&mut bytes);
        bytes
    }

    /// Clean up expired session keys
    pub fn cleanup_expired_keys(&mut self, max_age: u64) {
        self.session_keys.retain(|_, key| key.age() < max_age);
    }
}

/// Public keys structure for key exchange
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicKeys {
    /// Traditional X25519 public key
    pub traditional_exchange: [u8; 32],
    /// Traditional Ed25519 verifying key
    pub traditional_verify: [u8; 32],
    /// Quantum-resistant KEM public key
    pub quantum_kem: Vec<u8>,
    /// Quantum-resistant signature public key
    pub quantum_sig: Vec<u8>,
}

/// Key exchange result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyExchangeResult {
    /// Shared secret
    pub shared_secret: Vec<u8>,
    /// Crypto mode used
    pub mode: CryptoMode,
    /// Exchange timestamp
    pub timestamp: u64,
}

/// Signature algorithm types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SignatureAlgorithm {
    /// Traditional Ed25519
    Ed25519,
    /// Quantum-resistant ML-DSA-65
    MlDsa65,
    /// Hybrid (both)
    Hybrid,
}

/// Signature result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureResult {
    /// The signature bytes
    pub signature: Vec<u8>,
    /// Algorithm used
    pub algorithm: SignatureAlgorithm,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_quantum_resistant_crypto() {
        let crypto = HybridCrypto::new(CryptoMode::QuantumResistant).unwrap();
        let test_data = b"test quantum resistant encryption";

        let encrypted = crypto.encrypt(test_data).await.unwrap();
        let decrypted = crypto.decrypt(&encrypted).await.unwrap();

        assert_eq!(test_data.to_vec(), decrypted);
        assert_eq!(encrypted[0], 0x01); // Quantum marker
    }

    #[tokio::test]
    async fn test_hybrid_crypto() {
        let crypto = HybridCrypto::new(CryptoMode::Hybrid).unwrap();
        let test_data = b"test hybrid encryption with quantum resistance";

        let encrypted = crypto.encrypt(test_data).await.unwrap();
        let decrypted = crypto.decrypt(&encrypted).await.unwrap();

        assert_eq!(test_data.to_vec(), decrypted);
        assert_eq!(encrypted[0], 0x02); // Hybrid marker
    }

    #[tokio::test]
    async fn test_quantum_key_exchange() {
        let mut crypto1 = HybridCrypto::new(CryptoMode::QuantumResistant).unwrap();
        let mut crypto2 = HybridCrypto::new(CryptoMode::QuantumResistant).unwrap();

        let keys1 = crypto1.local_public_keys();
        let keys2 = crypto2.local_public_keys();

        let result1 = crypto1.key_exchange("peer2", &keys2).unwrap();
        let result2 = crypto2.key_exchange("peer1", &keys1).unwrap();

        assert_eq!(result1.mode, CryptoMode::QuantumResistant);
        assert_eq!(result2.mode, CryptoMode::QuantumResistant);
    }

    #[test]
    fn test_quantum_signatures() {
        let crypto = HybridCrypto::new(CryptoMode::QuantumResistant).unwrap();
        let test_data = b"test quantum signature";

        let sig_result = crypto.sign(test_data).unwrap();
        let public_keys = crypto.local_public_keys();

        assert_eq!(sig_result.algorithm, SignatureAlgorithm::MlDsa65);

        let is_valid = crypto.verify(test_data, &sig_result, &public_keys).unwrap();
        assert!(is_valid);

        // Test with tampered data
        let tampered_data = b"tampered quantum signature";
        let is_invalid = crypto
            .verify(tampered_data, &sig_result, &public_keys)
            .unwrap();
        assert!(!is_invalid);
    }

    #[test]
    fn test_hybrid_signatures() {
        let crypto = HybridCrypto::new(CryptoMode::Hybrid).unwrap();
        let test_data = b"test hybrid signature";

        let sig_result = crypto.sign(test_data).unwrap();
        let public_keys = crypto.local_public_keys();

        assert_eq!(sig_result.algorithm, SignatureAlgorithm::Hybrid);
        assert_eq!(sig_result.signature[0], 0x01); // Hybrid marker

        let is_valid = crypto.verify(test_data, &sig_result, &public_keys).unwrap();
        assert!(is_valid);
    }

    #[tokio::test]
    async fn test_key_rotation() {
        let mut crypto1 = HybridCrypto::new(CryptoMode::Traditional).unwrap();
        let mut crypto2 = HybridCrypto::new(CryptoMode::Traditional).unwrap();

        let keys1 = crypto1.local_public_keys();
        let keys2 = crypto2.local_public_keys();

        crypto1.key_exchange("peer2", &keys2).unwrap();
        crypto2.key_exchange("peer1", &keys1).unwrap();

        // Force key rotation by setting high usage count
        if let Some(session_key) = crypto1.session_keys.get_mut("peer2") {
            session_key.usage_count = session_key.max_usage - 1;
        }

        let test_data = b"test key rotation";

        // This should trigger rotation
        let encrypted = crypto1.encrypt_for_peer("peer2", test_data).await.unwrap();

        // Should be able to decrypt with rotation support
        let decrypted = crypto2
            .decrypt_from_peer("peer1", &encrypted)
            .await
            .unwrap();

        assert_eq!(test_data.to_vec(), decrypted);
    }

    #[test]
    fn test_hmac_generation() {
        let crypto = HybridCrypto::new(CryptoMode::Traditional).unwrap();
        let key = b"test-hmac-key";
        let data = b"test hmac data";

        let hmac1 = crypto.hmac(key, data).unwrap();
        let hmac2 = crypto.hmac(key, data).unwrap();

        assert_eq!(hmac1, hmac2);
        assert_eq!(hmac1.len(), 32);

        // Different data should produce different HMAC
        let different_data = b"different hmac data";
        let hmac3 = crypto.hmac(key, different_data).unwrap();
        assert_ne!(hmac1, hmac3);
    }
}
