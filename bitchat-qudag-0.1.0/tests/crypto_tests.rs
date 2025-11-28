//! Unit tests for cryptographic operations

use bitchat_qudag::crypto::{CryptoMode, HybridCrypto, KeyPair, SessionKey};
use proptest::prelude::*;

#[cfg(test)]
mod crypto_mode_tests {
    use super::*;

    #[test]
    fn test_crypto_mode_default() {
        let mode = CryptoMode::default();
        assert_eq!(mode, CryptoMode::Hybrid);
    }

    #[test]
    fn test_crypto_mode_serialization() {
        let modes = vec![
            CryptoMode::QuantumResistant,
            CryptoMode::Traditional,
            CryptoMode::Hybrid,
        ];

        for mode in modes {
            let serialized = serde_json::to_string(&mode).unwrap();
            let deserialized: CryptoMode = serde_json::from_str(&serialized).unwrap();
            assert_eq!(mode, deserialized);
        }
    }
}

#[cfg(test)]
mod key_pair_tests {
    use super::*;

    #[test]
    fn test_key_pair_generation() {
        let key_pair = KeyPair::generate();

        // Verify key sizes
        assert_eq!(key_pair.exchange_public_bytes().len(), 32);
        assert_eq!(key_pair.verifying_key_bytes().len(), 32);

        // Ensure exchange secret is present after generation
        assert!(key_pair.exchange_secret.is_some());
    }

    #[test]
    fn test_multiple_key_pair_generation() {
        let key_pair1 = KeyPair::generate();
        let key_pair2 = KeyPair::generate();

        // Ensure different keys are generated
        assert_ne!(
            key_pair1.exchange_public_bytes(),
            key_pair2.exchange_public_bytes()
        );
        assert_ne!(
            key_pair1.verifying_key_bytes(),
            key_pair2.verifying_key_bytes()
        );
    }
}

#[cfg(test)]
mod session_key_tests {
    use super::*;

    #[test]
    fn test_session_key_creation() {
        let session_key = SessionKey::generate();
        assert_eq!(session_key.key.len(), 32);
        assert_eq!(session_key.nonce.len(), 12);
        assert!(session_key.created_at.elapsed().unwrap().as_secs() < 1);
    }

    #[test]
    fn test_session_key_expiration() {
        let session_key = SessionKey::generate();
        assert!(!session_key.is_expired());

        // Test with custom expiry
        let mut expired_key = SessionKey::generate();
        expired_key.expires_at =
            Some(std::time::SystemTime::now() - std::time::Duration::from_secs(60));
        assert!(expired_key.is_expired());
    }
}

#[cfg(test)]
mod hybrid_crypto_tests {
    use super::*;

    #[test]
    fn test_hybrid_crypto_creation() {
        let crypto = HybridCrypto::new(CryptoMode::Hybrid);
        assert_eq!(crypto.mode(), CryptoMode::Hybrid);
    }

    #[test]
    fn test_encryption_decryption() {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);
        let plaintext = b"Hello, BitChat-QuDAG!";

        // Generate keys
        let key_pair1 = KeyPair::generate();
        let key_pair2 = KeyPair::generate();

        // Encrypt
        let encrypted = crypto
            .encrypt_message(plaintext, &key_pair1, &key_pair2.exchange_public_bytes())
            .unwrap();

        // Verify encryption changed the data
        assert_ne!(&encrypted.ciphertext[..], plaintext);
        assert!(!encrypted.nonce.is_empty());
        assert!(!encrypted.ephemeral_public.is_empty());

        // Decrypt
        let decrypted = crypto
            .decrypt_message(&encrypted, &key_pair2, &key_pair1.exchange_public_bytes())
            .unwrap();

        assert_eq!(&decrypted[..], plaintext);
    }

    #[test]
    fn test_sign_verify() {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);
        let message = b"Sign this message";

        let key_pair = KeyPair::generate();

        // Sign
        let signature = crypto.sign_message(message, &key_pair).unwrap();
        assert_eq!(signature.len(), 64); // Ed25519 signature size

        // Verify
        let is_valid = crypto
            .verify_message(message, &signature, &key_pair.verifying_key_bytes())
            .unwrap();
        assert!(is_valid);

        // Verify with wrong message
        let is_valid = crypto
            .verify_message(
                b"Different message",
                &signature,
                &key_pair.verifying_key_bytes(),
            )
            .unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_derive_shared_secret() {
        let crypto = HybridCrypto::new(CryptoMode::Hybrid);

        let key_pair1 = KeyPair::generate();
        let key_pair2 = KeyPair::generate();

        // Derive shared secret from both sides
        let secret1 = crypto
            .derive_shared_secret(&key_pair1, &key_pair2.exchange_public_bytes())
            .unwrap();

        let secret2 = crypto
            .derive_shared_secret(&key_pair2, &key_pair1.exchange_public_bytes())
            .unwrap();

        // Both sides should derive the same secret
        assert_eq!(secret1, secret2);
        assert_eq!(secret1.len(), 32);
    }

    #[test]
    fn test_hash_data() {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);
        let data = b"Hash this data";

        let hash = crypto.hash_data(data);
        assert_eq!(hash.len(), 32); // Blake3 hash size

        // Same data should produce same hash
        let hash2 = crypto.hash_data(data);
        assert_eq!(hash, hash2);

        // Different data should produce different hash
        let hash3 = crypto.hash_data(b"Different data");
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_generate_key_from_password() {
        let crypto = HybridCrypto::new(CryptoMode::Hybrid);
        let password = "strong_password_123";
        let salt = b"random_salt_value";

        let key = crypto.generate_key_from_password(password, salt).unwrap();
        assert_eq!(key.len(), 32);

        // Same password and salt should produce same key
        let key2 = crypto.generate_key_from_password(password, salt).unwrap();
        assert_eq!(key, key2);

        // Different password should produce different key
        let key3 = crypto
            .generate_key_from_password("different_password", salt)
            .unwrap();
        assert_ne!(key, key3);

        // Different salt should produce different key
        let key4 = crypto
            .generate_key_from_password(password, b"different_salt")
            .unwrap();
        assert_ne!(key, key4);
    }
}

// Property-based tests
proptest! {
    #[test]
    fn test_encrypt_decrypt_roundtrip(plaintext: Vec<u8>) {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);
        let key_pair1 = KeyPair::generate();
        let key_pair2 = KeyPair::generate();

        // Skip empty messages
        if plaintext.is_empty() {
            return Ok(());
        }

        let encrypted = crypto.encrypt_message(
            &plaintext,
            &key_pair1,
            &key_pair2.exchange_public_bytes()
        ).unwrap();

        let decrypted = crypto.decrypt_message(
            &encrypted,
            &key_pair2,
            &key_pair1.exchange_public_bytes()
        ).unwrap();

        prop_assert_eq!(&decrypted[..], &plaintext[..]);
    }

    #[test]
    fn test_sign_verify_consistency(message: Vec<u8>) {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);
        let key_pair = KeyPair::generate();

        if message.is_empty() {
            return Ok(());
        }

        let signature = crypto.sign_message(&message, &key_pair).unwrap();
        let is_valid = crypto.verify_message(
            &message,
            &signature,
            &key_pair.verifying_key_bytes()
        ).unwrap();

        prop_assert!(is_valid);
    }

    #[test]
    fn test_hash_consistency(data: Vec<u8>) {
        let crypto = HybridCrypto::new(CryptoMode::Traditional);

        let hash1 = crypto.hash_data(&data);
        let hash2 = crypto.hash_data(&data);

        prop_assert_eq!(hash1, hash2);
        prop_assert_eq!(hash1.len(), 32);
    }
}
