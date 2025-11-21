//! HMAC-SHA256 signature verification for webhook security
//!
//! This module provides HMAC-SHA256 signature generation and verification
//! for webhook payloads, ensuring cryptographic integrity and authenticity.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Generate HMAC-SHA256 signature for a payload
///
/// # Arguments
/// * `secret` - The shared secret key (typically 32 bytes)
/// * `payload` - The data to sign
///
/// # Returns
/// Hex-encoded HMAC signature (64 characters)
///
/// # Example
/// ```no_run
/// use agentic_payments::acp::hmac::generate_signature;
///
/// let secret = b"my_webhook_secret";
/// let payload = b"webhook_payload_data";
/// let signature = generate_signature(secret, payload).unwrap();
/// assert_eq!(signature.len(), 64); // SHA256 hex = 64 chars
/// ```
pub fn generate_signature(secret: &[u8], payload: &[u8]) -> Result<String, String> {
    let mut mac = HmacSha256::new_from_slice(secret)
        .map_err(|e| format!("HMAC initialization failed: {}", e))?;

    mac.update(payload);
    let result = mac.finalize();
    Ok(hex::encode(result.into_bytes()))
}

/// Verify HMAC-SHA256 signature using constant-time comparison
///
/// # Arguments
/// * `secret` - The shared secret key
/// * `payload` - The data that was signed
/// * `signature` - The hex-encoded signature to verify
///
/// # Returns
/// `true` if signature is valid, `false` otherwise
///
/// # Security
/// Uses constant-time comparison to prevent timing attacks
///
/// # Example
/// ```no_run
/// use agentic_payments::acp::hmac::{generate_signature, verify_signature};
///
/// let secret = b"my_webhook_secret";
/// let payload = b"webhook_payload_data";
/// let signature = generate_signature(secret, payload).unwrap();
///
/// assert!(verify_signature(secret, payload, &signature).unwrap());
/// assert!(!verify_signature(secret, payload, "invalid_sig").unwrap());
/// ```
pub fn verify_signature(secret: &[u8], payload: &[u8], signature: &str) -> Result<bool, String> {
    let expected = generate_signature(secret, payload)?;
    Ok(constant_time_compare(&expected, signature))
}

/// Constant-time string comparison to prevent timing attacks
///
/// This implementation ensures that the comparison takes the same amount of time
/// regardless of where the strings differ, preventing attackers from using timing
/// information to forge signatures.
fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }

    // XOR all bytes and accumulate. Result is 0 only if all bytes match
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_generation() {
        let secret = b"test_secret_key_12345678901234567890";
        let payload = b"test_payload_data";

        let sig = generate_signature(secret, payload).unwrap();

        // SHA256 produces 32 bytes = 64 hex characters
        assert_eq!(sig.len(), 64);
        assert!(sig.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_signature_verification_valid() {
        let secret = b"test_secret";
        let payload = b"test_payload";

        let sig = generate_signature(secret, payload).unwrap();
        assert!(verify_signature(secret, payload, &sig).unwrap());
    }

    #[test]
    fn test_signature_verification_invalid() {
        let secret = b"test_secret";
        let payload = b"test_payload";
        let invalid_sig = "0000000000000000000000000000000000000000000000000000000000000000";

        assert!(!verify_signature(secret, payload, invalid_sig).unwrap());
    }

    #[test]
    fn test_signature_verification_wrong_payload() {
        let secret = b"test_secret";
        let payload1 = b"original_payload";
        let payload2 = b"modified_payload";

        let sig = generate_signature(secret, payload1).unwrap();
        assert!(!verify_signature(secret, payload2, &sig).unwrap());
    }

    #[test]
    fn test_signature_verification_wrong_secret() {
        let secret1 = b"secret_key_1";
        let secret2 = b"secret_key_2";
        let payload = b"test_payload";

        let sig = generate_signature(secret1, payload).unwrap();
        assert!(!verify_signature(secret2, payload, &sig).unwrap());
    }

    #[test]
    fn test_constant_time_compare_equal() {
        let a = "abcdef1234567890";
        let b = "abcdef1234567890";
        assert!(constant_time_compare(a, b));
    }

    #[test]
    fn test_constant_time_compare_different() {
        let a = "abcdef1234567890";
        let b = "abcdef1234567891"; // Last char different
        assert!(!constant_time_compare(a, b));
    }

    #[test]
    fn test_constant_time_compare_different_length() {
        let a = "abcdef";
        let b = "abcdef12";
        assert!(!constant_time_compare(a, b));
    }

    #[test]
    fn test_deterministic_signatures() {
        let secret = b"consistent_secret";
        let payload = b"consistent_payload";

        let sig1 = generate_signature(secret, payload).unwrap();
        let sig2 = generate_signature(secret, payload).unwrap();

        assert_eq!(sig1, sig2, "Signatures should be deterministic");
    }

    #[test]
    fn test_empty_payload() {
        let secret = b"test_secret";
        let payload = b"";

        let sig = generate_signature(secret, payload).unwrap();
        assert!(verify_signature(secret, payload, &sig).unwrap());
    }

    #[test]
    fn test_large_payload() {
        let secret = b"test_secret";
        let payload = vec![0u8; 10_000]; // 10KB payload

        let sig = generate_signature(secret, &payload).unwrap();
        assert!(verify_signature(secret, &payload, &sig).unwrap());
    }
}